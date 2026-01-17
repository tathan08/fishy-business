package main

import (
	"sync"
	"time"
)

// Player represents a player fish in the game
type Player struct {
	ID          string
	Name        string
	Model       string
	Position    Vec2
	Velocity    Vec2
	Size        float64
	Score       int
	Alive       bool
	RespawnTime float64
	KilledBy    string
	LastSeq     uint32
	Client      *Client
	mu          sync.RWMutex
}

// NewPlayer creates a new player at a random position
func NewPlayer(id, name, model string, client *Client) *Player {
	if model == "" {
		model = "swordfish" // Default model
	}
	return &Player{
		ID:       id,
		Name:     name,
		Model:    model,
		Position: Vec2{X: RandomFloat(100, WorldWidth-100), Y: RandomFloat(100, WorldHeight-100)},
		Velocity: Vec2{X: 0, Y: 0},
		Size:     InitialPlayerSize,
		Score:    0,
		Alive:    true,
		Client:   client,
	}
}

// GetBounds returns the bounding box of the player
func (p *Player) GetBounds() Rect {
	return Rect{
		X:      p.Position.X - p.Size,
		Y:      p.Position.Y - p.Size,
		Width:  p.Size * 2,
		Height: p.Size * 2,
	}
}

// Respawn resets player to initial state at a random position
func (p *Player) Respawn() {
	p.Position = Vec2{X: RandomFloat(100, WorldWidth-100), Y: RandomFloat(100, WorldHeight-100)}
	p.Velocity = Vec2{X: 0, Y: 0}
	p.Size = InitialPlayerSize
	p.Alive = true
	p.RespawnTime = 0
	p.KilledBy = ""
}

// Food represents a food item in the game
type Food struct {
	ID       uint64
	Position Vec2
	Size     float64
}

// NewFood creates a new food item at a random position
func NewFood(id uint64) *Food {
	return &Food{
		ID:       id,
		Position: Vec2{X: RandomFloat(0, WorldWidth), Y: RandomFloat(0, WorldHeight)},
		Size:     RandomFloat(MinFoodSize, MaxFoodSize),
	}
}

// GetBounds returns the bounding box of the food
func (f *Food) GetBounds() Rect {
	return Rect{
		X:      f.Position.X - f.Size,
		Y:      f.Position.Y - f.Size,
		Width:  f.Size * 2,
		Height: f.Size * 2,
	}
}

// PlayerInput represents input from a client
type PlayerInput struct {
	PlayerID  string
	Direction Vec2
	Boost     bool
	Seq       uint32
	Timestamp time.Time
}
