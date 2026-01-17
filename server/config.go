package main

const (
	// World configuration
	WorldWidth  = 4000.0
	WorldHeight = 4000.0

	// Game loop configuration
	TickRate      = 60              // Game updates per second
	BroadcastRate = 20              // State broadcasts per second
	TickInterval  = 1000 / TickRate // milliseconds

	// Player configuration
	InitialPlayerSize = 20.0
	MinPlayerSize     = 10.0
	MaxPlayerSize     = 200.0
	PlayerSpeed       = 200.0 // base speed
	BoostMultiplier   = 1.1   // slower boost speed
	BoostCostPerSec   = 2.0   // size loss per second when boosting
	ViewDistance      = 800.0 // how far players can see

	// Food configuration
	MaxFoodCount     = 500
	FoodSpawnRate    = 10 // food items spawned per second
	MinFoodSize      = 3.0
	MaxFoodSize      = 10.0
	FoodValue        = 2.0 // size gained when eating food

	// Gameplay
	RespawnDelay    = 3.0 // seconds
	SizeMultiplier  = 1.1 // need to be this much bigger to eat another fish
	VelocityLerp    = 0.1 // smoothing factor for velocity changes

	// Network
	InputQueueSize     = 10000
	WriteChannelSize   = 256
	PingInterval       = 2000 // milliseconds
	MaxPlayerNameLen   = 20
)
