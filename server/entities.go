package main

import (
	"math"
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
	Rotation    float64 // Angle in radians
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
	p.Rotation = 0
	p.Alive = true
	p.RespawnTime = 0
	p.KilledBy = ""
}

// GetHitboxConfig returns the hitbox configuration for this player's model
func (p *Player) GetHitboxConfig() HitboxConfig {
	if config, ok := FishHitboxConfigs[p.Model]; ok {
		return config
	}
	return DefaultHitboxConfig
}

// GetMouthHitbox returns the circular mouth hitbox for eating
func (p *Player) GetMouthHitbox() Circle {
	config := p.GetHitboxConfig()
	
	// Cap the size at MaxPlayerSize for hitbox calculation
	cappedSize := Min(p.Size, MaxPlayerSize)
	
	// Mouth radius is a fraction of the capped size
	mouthRadius := cappedSize * config.MouthSizeRatio
	
	// Mouth position is offset in front of the fish
	offsetDistance := cappedSize * config.MouthOffsetRatio
	mouthX := p.Position.X + math.Cos(p.Rotation)*offsetDistance
	mouthY := p.Position.Y + math.Sin(p.Rotation)*offsetDistance
	
	return Circle{
		Center: Vec2{X: mouthX, Y: mouthY},
		Radius: mouthRadius,
	}
}

// GetBodyHitbox returns the rectangular body hitbox for bouncing
func (p *Player) GetBodyHitbox() OrientedRect {
	config := p.GetHitboxConfig()
	
	// Cap the size at MaxPlayerSize for hitbox calculation
	cappedSize := Min(p.Size, MaxPlayerSize)
	
	return OrientedRect{
		Center:   p.Position,
		Width:    cappedSize * config.BodyWidthRatio,
		Height:   cappedSize * config.BodyHeightRatio,
		Rotation: p.Rotation,
	}
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
