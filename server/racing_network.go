package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// RacingClient represents a connected racing WebSocket client
type RacingClient struct {
	ID           string
	Conn         *websocket.Conn
	Send         chan []byte
	RacingWorld  *RacingWorld
	Race         *Race
	mu           sync.Mutex
}

// NewRacingClient creates a new racing client
func NewRacingClient(id string, conn *websocket.Conn, world *RacingWorld) *RacingClient {
	return &RacingClient{
		ID:          id,
		Conn:        conn,
		Send:        make(chan []byte, 256),
		RacingWorld: world,
	}
}

// HandleRacingWebSocket handles WebSocket connections for racing
func HandleRacingWebSocket(racingWorld *RacingWorld) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade racing connection: %v", err)
			return
		}

		clientID := generateClientID()
		client := NewRacingClient(clientID, conn, racingWorld)

		log.Printf("Racing client connected: %s", clientID)

		// Start goroutines
		go client.WritePump()
		go client.ReadPump()
	}
}

// ReadPump reads messages from the racing WebSocket
func (c *RacingClient) ReadPump() {
	defer func() {
		c.Disconnect()
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
				log.Printf("Racing WebSocket error: %v", err)
			}
			break
		}

		log.Printf("ReadPump received message from client %s: %s", c.ID, string(message))

		var msg RacingClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling racing message: %v", err)
			continue
		}

		log.Printf("ReadPump parsed message type: %s", msg.Type)
		c.HandleMessage(msg)
	}
}

// WritePump sends messages to the racing WebSocket
func (c *RacingClient) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
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

			log.Printf("WritePump sending message to client %s: %s", c.ID, string(message))

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				log.Printf("Error getting next writer for client %s: %v", c.ID, err)
				return
			}
			w.Write(message)

			// Add queued messages to current websocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				log.Printf("Error closing writer for client %s: %v", c.ID, err)
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

// HandleMessage processes incoming messages from racing clients
func (c *RacingClient) HandleMessage(msg RacingClientMessage) {
	log.Printf("HandleMessage called for client %s with message type: %s", c.ID, msg.Type)
	
	switch msg.Type {
	case "join":
		log.Printf("HandleMessage: Processing join case for client %s", c.ID)
		// Join the waiting lobby
		race := c.RacingWorld.JoinRace(c, msg.Name, msg.Model)
		log.Printf("HandleMessage: JoinRace returned, race ID: %s", race.ID)
		c.Race = race

		// Send welcome message
		log.Printf("HandleMessage: Creating welcome payload for client %s", c.ID)
		welcome := RaceWelcomePayload{
			PlayerID:  c.ID,
			RaceID:    race.ID,
			Name:      msg.Name,
			Model:     msg.Model,
			RaceState: race.StateString(),
		}

		log.Printf("HandleMessage: Sending welcome message for client %s", c.ID)
		c.SendMessage(RacingServerMessage{
			Type:    "welcome",
			Payload: welcome,
		})

		log.Printf("Player %s joined racing as %s, sent welcome to race %s", c.ID, msg.Name, race.ID)

	case "ready":
		// Player clicked ready
		if c.Race != nil {
			c.Race.HandlePlayerReady(c.ID)
		}

	case "mouthInput":
		// Process mouth open/close
		if c.Race != nil {
			c.Race.HandleMouthInput(c.ID, msg.MouthOpen)
		}

	case "ping":
		// Respond with pong
		c.SendMessage(RacingServerMessage{
			Type: "pong",
		})
	}
}

// SendMessage sends a message to the racing client
func (c *RacingClient) SendMessage(msg RacingServerMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling racing message: %v", err)
		return
	}

	log.Printf("SendMessage: Queuing %s message for client %s: %s", msg.Type, c.ID, string(data))

	select {
	case c.Send <- data:
		log.Printf("SendMessage: Successfully queued message for client %s", c.ID)
	default:
		log.Printf("Client %s send channel full, dropping message", c.ID)
	}
}

// Disconnect removes the client from the race
func (c *RacingClient) Disconnect() {
	if c.Race != nil {
		c.Race.DisconnectPlayer(c.ID)
	}
	close(c.Send)
	log.Printf("Racing client disconnected: %s", c.ID)
}
