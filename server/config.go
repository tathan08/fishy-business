package main

const (
	// World configuration
	WorldWidth  = 4000.0
	WorldHeight = 4000.0

	// Game loop configuration
	TickRate      = 30              // Game updates per second
	BroadcastRate = 15              // State broadcasts per second
	TickInterval  = 1000 / TickRate // milliseconds

	// Player configuration
	InitialPlayerSize = 20.0
	MinPlayerSize     = 10.0
	MaxPlayerSize     = 200.0
	PlayerSpeed       = 200.0 // base speed
	BoostMultiplier   = 2.0   // slower boost speed
	BoostCostPerSec   = 3.0   // size loss per second when boosting
	ViewDistance      = 600.0 // how far players can see (reduced for bandwidth)

	// Food configuration
	MaxFoodCount  = 300
	FoodSpawnRate = 10 // food items spawned per second
	MinFoodSize   = 3.0
	MaxFoodSize   = 10.0
	FoodValue     = 2.0 // size gained when eating food

	// Gameplay
	RespawnDelay   = 3.0 // seconds
	SizeMultiplier = 1.1 // need to be this much bigger to eat another fish
	VelocityLerp   = 0.1 // smoothing factor for velocity changes

	// Network
	InputQueueSize   = 10000
	WriteChannelSize = 256
	PingInterval     = 2000 // milliseconds
	MaxPlayerNameLen = 20

	// Collision
	BounceStrength = 150.0 // Push force when bodies collide
)

// HitboxConfig defines hitbox dimensions for a fish model
type HitboxConfig struct {
	BodyWidthRatio   float64
	BodyHeightRatio  float64
	MouthSizeRatio   float64
	MouthOffsetRatio float64
}

// FishHitboxConfigs maps fish models to their hitbox configurations
var FishHitboxConfigs = map[string]HitboxConfig{
	"swordfish": {
		BodyWidthRatio:   1.3,  // Balanced
		BodyHeightRatio:  0.6,  // Sleek and thin
		MouthSizeRatio:   0.25, // Smaller pointed mouth
		MouthOffsetRatio: 0.6,  // Forward positioned
	},
	"blobfish": {
		BodyWidthRatio:   1.3,  // Compact and blobby
		BodyHeightRatio:  1.3,  // Taller but flattened
		MouthSizeRatio:   0.35, // Large droopy mouth
		MouthOffsetRatio: 0.6,  // Close to center
	},
	"pufferfish": {
		BodyWidthRatio:   1.2, // Nearly circular when puffed
		BodyHeightRatio:  1.2, // Equal width and height
		MouthSizeRatio:   0.4, // Round mouth
		MouthOffsetRatio: 0.6, // Close to center (spherical)
	},
	"shark": {
		BodyWidthRatio:   1.8,  // Streamlined predator
		BodyHeightRatio:  0.9,  // Sleek profile
		MouthSizeRatio:   0.35, // Large predator mouth
		MouthOffsetRatio: 0.9,  // Forward positioned
	},
	"sacabambaspis": {
		BodyWidthRatio:   2.0, // Elongated oval prehistoric fish
		BodyHeightRatio:  1.0, // Moderate height
		MouthSizeRatio:   0.4, // Standard mouth
		MouthOffsetRatio: 0.9, // Front positioned
	},
}

// DefaultHitboxConfig is used for unknown or unspecified fish models
var DefaultHitboxConfig = HitboxConfig{
	BodyWidthRatio:   2.5,
	BodyHeightRatio:  1.0,
	MouthSizeRatio:   0.3,
	MouthOffsetRatio: 1.2,
}
