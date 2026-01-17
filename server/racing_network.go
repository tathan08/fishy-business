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

		var msg RacingClientMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling racing message: %v", err)
			continue
		}

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

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
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
	switch msg.Type {
	case "join":
		// Join the waiting lobby
		race := c.RacingWorld.JoinRace(c, msg.Name, msg.Model)
		c.Race = race

		// Send welcome message
		welcome := RaceWelcomePayload{
			PlayerID:  c.ID,
			RaceID:    race.ID,
			Name:      msg.Name,
			Model:     msg.Model,
			RaceState: race.StateString(),
		}

		c.SendMessage(RacingServerMessage{
			Type:    "welcome",
			Payload: welcome,
		})

		log.Printf("Player %s joined racing as %s", c.ID, msg.Name)

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

	select {
	case c.Send <- data:
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
