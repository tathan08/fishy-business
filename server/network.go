package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:    2048,
	WriteBufferSize:   8192, // Larger for batching
	EnableCompression: true, // Enable compression like slither.io
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Client represents a connected WebSocket client
type Client struct {
	ID          string
	Conn        *websocket.Conn
	Send        chan []byte
	World       *World
	Player      *Player
	SeenPlayers map[string]bool // Track which players this client has seen
	mu          sync.Mutex
}

// NewClient creates a new client
func NewClient(id string, conn *websocket.Conn, world *World) *Client {
	return &Client{
		ID:          id,
		Conn:        conn,
		Send:        make(chan []byte, WriteChannelSize),
		World:       world,
		SeenPlayers: make(map[string]bool),
	}
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		c.World.Disconnect(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg ClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		c.HandleMessage(msg)
	}
}

// WritePump sends messages to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(time.Duration(PingInterval) * time.Millisecond)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Batch multiple messages together (like slither.io)
			batched := message
			
			// Drain additional queued messages and append them
			batchLoop:
			for i := 0; i < 10; i++ { // Max 10 messages per batch
				select {
				case nextMsg := <-c.Send:
					batched = append(batched, nextMsg...)
				default:
					break batchLoop
				}
			}

			// Send batched binary message
			if err := c.Conn.WriteMessage(websocket.BinaryMessage, batched); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// HandleMessage processes incoming client messages
func (c *Client) HandleMessage(msg ClientMessage) {
	switch msg.Type {
	case "join":
		c.HandleJoin(msg)
	case "input":
		c.HandleInput(msg)
	case "ping":
		c.SendMessage(ServerMessage{Type: "pong"})
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// HandleJoin processes a join message
func (c *Client) HandleJoin(msg ClientMessage) {
	name := msg.Name
	if len(name) > MaxPlayerNameLen {
		name = name[:MaxPlayerNameLen]
	}
	if name == "" {
		name = "Fish"
	}

	model := msg.Model
	if model == "" {
		model = "swordfish" // Default model
	}

	player := NewPlayer(c.ID, name, model, c)
	c.Player = player
	c.World.AddPlayer(player)

	// Send welcome message
	c.SendMessage(ServerMessage{
		Type: "welcome",
		Payload: WelcomePayload{
			ID:          c.ID,
			WorldWidth:  WorldWidth,
			WorldHeight: WorldHeight,
		},
	})

	log.Printf("Player %s (%s) joined", name, c.ID)
}

// HandleInput processes an input message
func (c *Client) HandleInput(msg ClientMessage) {
	if c.Player == nil {
		return
	}

	// Normalize direction vector
	direction := Vec2{X: msg.DirX, Y: msg.DirY}
	if direction.Length() > 0 {
		direction = direction.Normalize()
	}

	input := PlayerInput{
		PlayerID:  c.ID,
		Direction: direction,
		Boost:     msg.Boost,
		Seq:       msg.Seq,
		Timestamp: time.Now(),
	}

	// Try to send to input queue (non-blocking)
	select {
	case c.World.InputQueue <- input:
	default:
		// Queue full, drop input
		log.Printf("Input queue full, dropping input from %s", c.ID)
	}
}

// SendMessage sends a message to the client
func (c *Client) SendMessage(msg ServerMessage) {
	// Try binary encoding first
	data, err := EncodeBinaryMessage(msg)
	if err != nil {
		log.Printf("Error encoding binary message: %v", err)
		return
	}
	
	// If binary encoding succeeded, send as binary
	if data != nil {
		select {
		case c.Send <- data:
		default:
			// Channel full, client too slow
			log.Printf("Client %s send channel full, closing connection", c.ID)
			c.World.Disconnect(c)
		}
		return
	}
	
	// Fallback to JSON for unsupported message types
	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case c.Send <- jsonData:
	default:
		// Channel full, client too slow
		log.Printf("Client %s send channel full, closing connection", c.ID)
		c.World.Disconnect(c)
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func HandleWebSocket(world *World) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		clientID := generateClientID()
		client := NewClient(clientID, conn, world)

		// Start read and write pumps
		go client.WritePump()
		go client.ReadPump()
	}
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return time.Now().Format("20060102150405") + "-" + string(rune(RandomInt(1000, 9999)))
}
