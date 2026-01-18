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
	Conn        *websocket.Conn // Primary: high-freq position updates
	MetaConn    *websocket.Conn // Secondary: low-freq metadata
	Send        chan []byte
	MetaSend    chan []byte
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
		MetaSend:    make(chan []byte, WriteChannelSize),
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

// MetaWritePump sends metadata messages on the secondary WebSocket
func (c *Client) MetaWritePump() {
	defer func() {
		if c.MetaConn != nil {
			c.MetaConn.Close()
		}
	}()

	for {
		select {
		case message, ok := <-c.MetaSend:
			if c.MetaConn == nil {
				return
			}
			c.MetaConn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.MetaConn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Batch metadata messages
			batched := message
			batchLoop:
			for i := 0; i < 5; i++ { // Smaller batch for metadata
				select {
				case nextMsg := <-c.MetaSend:
					batched = append(batched, nextMsg...)
				default:
					break batchLoop
				}
			}

			// Send batched message
			if err := c.MetaConn.WriteMessage(websocket.BinaryMessage, batched); err != nil {
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

	// Send welcome message with player info
	c.SendMessage(ServerMessage{
		Type: "welcome",
		Payload: WelcomePayload{
			ID:          c.ID,
			Name:        name,
			Model:       model,
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

// SendMessage sends a message to the client (routes to appropriate socket)
func (c *Client) SendMessage(msg ServerMessage) {
	// Try binary encoding first
	data, err := EncodeBinaryMessage(msg)
	if err != nil {
		log.Printf("Error encoding binary message: %v", err)
		return
	}
	
	if data == nil {
		// Fallback to JSON for unsupported message types
		jsonData, err := json.Marshal(msg)
		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			return
		}
		data = jsonData
	}
	
	// Route to appropriate socket
	var targetChan chan []byte
	switch msg.Type {
	case "state":
		// High-frequency position updates -> primary socket
		targetChan = c.Send
	case "leaderboard", "playerInfo", "welcome", "allPlayers":
		// Low-frequency metadata -> secondary socket (if available)
		if c.MetaConn != nil {
			targetChan = c.MetaSend
		} else {
			targetChan = c.Send // Fallback to primary
		}
	default:
		targetChan = c.Send
	}

	select {
	case targetChan <- data:
	default:
		// Channel full, client too slow
		log.Printf("Client %s send channel full, closing connection", c.ID)
		c.World.Disconnect(c)
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket (primary socket)
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

// HandleMetaWebSocket upgrades HTTP connection to metadata WebSocket (secondary socket)
func HandleMetaWebSocket(world *World) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get client ID from query parameter
		clientID := r.URL.Query().Get("id")
		if clientID == "" {
			http.Error(w, "Missing client ID", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Meta WebSocket upgrade error: %v", err)
			return
		}

		// Find existing client and attach metadata socket
		world.mu.RLock()
		var client *Client
		for _, player := range world.Players {
			if player.Client != nil && player.Client.ID == clientID {
				client = player.Client
				break
			}
		}
		world.mu.RUnlock()

		if client == nil {
			log.Printf("Client %s not found for meta socket", clientID)
			conn.Close()
			return
		}

		// Attach metadata socket
		client.mu.Lock()
		client.MetaConn = conn
		client.mu.Unlock()

		log.Printf("Meta WebSocket connected for client %s", clientID)

		// Start metadata write pump
		go client.MetaWritePump()
	}
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return time.Now().Format("20060102150405") + "-" + string(rune(RandomInt(1000, 9999)))
}
