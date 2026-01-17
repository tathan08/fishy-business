package main

// ClientMessage represents incoming messages from clients
type ClientMessage struct {
	Type  string  `json:"type"`
	Name  string  `json:"name,omitempty"`
	Model string  `json:"model,omitempty"`
	DirX  float64 `json:"dirX,omitempty"`
	DirY  float64 `json:"dirY,omitempty"`
	Boost bool    `json:"boost,omitempty"`
	Seq   uint32  `json:"seq,omitempty"`
}

// ServerMessage represents outgoing messages to clients
type ServerMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// WelcomePayload is sent after a player joins
type WelcomePayload struct {
	ID          string  `json:"id"`
	WorldWidth  float64 `json:"worldWidth"`
	WorldHeight float64 `json:"worldHeight"`
}

// GameStatePayload contains the current game state for a player
type GameStatePayload struct {
	You         PlayerState        `json:"you"`
	Others      []OtherPlayerState `json:"others"`
	Food        []FoodState        `json:"food"`
	Leaderboard []LeaderboardEntry `json:"leaderboard"`
}

// PlayerState represents the player's own state
type PlayerState struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	X          float64  `json:"x"`
	Y          float64  `json:"y"`
	VelX       float64  `json:"velX"`
	VelY       float64  `json:"velY"`
	Rotation   float64  `json:"rotation"`
	Size       float64  `json:"size"`
	Score      int      `json:"score"`
	Alive      bool     `json:"alive"`
	Seq        uint32   `json:"seq"`
	Model      string   `json:"model,omitempty"`
	KilledBy   *string  `json:"killedBy,omitempty"`
	RespawnIn  *float64 `json:"respawnIn,omitempty"`
}

// OtherPlayerState represents another player's state
type OtherPlayerState struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	VelX     float64 `json:"velX"`
	VelY     float64 `json:"velY"`
	Rotation float64 `json:"rotation"`
	Size     float64 `json:"size"`
	Model    string  `json:"model,omitempty"`
}

// FoodState represents a food item's state
type FoodState struct {
	ID uint64  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	R  float64 `json:"r"`
}

// LeaderboardEntry represents a leaderboard entry
type LeaderboardEntry struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
}
