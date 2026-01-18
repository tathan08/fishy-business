package main

import "unsafe"

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
	Name        string  `json:"name"`
	Model       string  `json:"model"`
	WorldWidth  float64 `json:"worldWidth"`
	WorldHeight float64 `json:"worldHeight"`
}

// GameStatePayload contains the current game state for a player
type GameStatePayload struct {
	You         PlayerState        `json:"you"`
	Others      []OtherPlayerState `json:"others"`
	Food        []FoodState        `json:"food"`
	Powerups    []PowerupState     `json:"powerups"`
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
	PowerupActive bool  `json:"powerupActive,omitempty"`
	PowerupDuration float64 `json:"powerupDuration,omitempty"`
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
	PowerupActive bool `json:"powerupActive,omitempty"`
}

// FoodState represents a food item's state
type FoodState struct {
	ID uint64  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	R  float64 `json:"r"`
}

// PowerupState represents a powerup item's state
type PowerupState struct {
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

// PlayerInfoPayload contains player metadata (sent once)
type PlayerInfoPayload struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model"`
}

// AllPlayersPayload contains all player positions for shark vision powerup
type AllPlayersPayload struct {
	Players []PlayerPosition `json:"players"`
}

// PlayerPosition is a minimal position data for all players
type PlayerPosition struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
}

// Binary Protocol Implementation
// Message Types
const (
	MsgTypeWelcome     byte = 1
	MsgTypeState       byte = 2
	MsgTypePong        byte = 3
	MsgTypeLeaderboard byte = 4
	MsgTypePlayerInfo  byte = 5 // Send player name/model once
	MsgTypeAllPlayers  byte = 6 // Send all player positions for shark vision
)

// EncodeBinaryMessage encodes a server message into binary format
func EncodeBinaryMessage(msg ServerMessage) ([]byte, error) {
	switch msg.Type {
	case "welcome":
		return encodeWelcome(msg.Payload.(WelcomePayload))
	case "state":
		return encodeGameState(msg.Payload.(GameStatePayload))
	case "leaderboard":
		return encodeLeaderboard(msg.Payload.([]LeaderboardEntry))
	case "playerInfo":
		return encodePlayerInfo(msg.Payload.(PlayerInfoPayload))
	case "allPlayers":
		return encodeAllPlayers(msg.Payload.(AllPlayersPayload))
	case "pong":
		return []byte{MsgTypePong}, nil
	default:
		return nil, nil
	}
}

func encodeWelcome(payload WelcomePayload) ([]byte, error) {
	capacity := 1 + 2 + len(payload.ID) + 2 + len(payload.Name) + 2 + len(payload.Model) + 16
	buf := make([]byte, 0, capacity)
	
	buf = append(buf, MsgTypeWelcome)
	
	// ID string
	buf = appendString(buf, payload.ID)
	// Name string
	buf = appendString(buf, payload.Name)
	// Model string
	buf = appendString(buf, payload.Model)
	
	// World dimensions (float64)
	oldLen := len(buf)
	buf = append(buf, make([]byte, 16)...)
	putFloat64(buf[oldLen:], payload.WorldWidth)
	putFloat64(buf[oldLen+8:], payload.WorldHeight)
	
	return buf, nil
}

func encodeGameState(state GameStatePayload) ([]byte, error) {
	// Estimate size (no leaderboard - sent separately)
	capacity := 1 + 64 + len(state.Others)*32 + len(state.Food)*20 + len(state.Powerups)*20
	buf := make([]byte, 0, capacity)
	
	buf = append(buf, MsgTypeState)
	
	// Encode player state (no ID/name/model)
	buf = encodePlayerState(buf, state.You)
	
	// Encode others count + data
	buf = append(buf, byte(len(state.Others)>>8), byte(len(state.Others)))
	for _, other := range state.Others {
		buf = encodeOtherPlayer(buf, other)
	}
	
	// Encode food count + data
	buf = append(buf, byte(len(state.Food)>>8), byte(len(state.Food)))
	for _, food := range state.Food {
		buf = encodeFoodState(buf, food)
	}
	
	// Encode powerups count + data
	buf = append(buf, byte(len(state.Powerups)>>8), byte(len(state.Powerups)))
	for _, powerup := range state.Powerups {
		buf = encodePowerupState(buf, powerup)
	}
	
	// Leaderboard is sent separately at lower frequency
	
	return buf, nil
}

func encodePlayerState(buf []byte, player PlayerState) []byte {
	// Flags byte: bit 0 = alive, bit 1 = has killedBy, bit 2 = has respawnIn, bit 3 = powerupActive
	flags := byte(0)
	if player.Alive {
		flags |= 1
	}
	if player.KilledBy != nil {
		flags |= 2
	}
	if player.RespawnIn != nil {
		flags |= 4
	}
	if player.PowerupActive {
		flags |= 8
	}
	buf = append(buf, flags)
	
	// Only send dynamic data (no ID, Name, Model - those are sent once)
	// Position and velocity (float32 for bandwidth)
	buf = appendFloat32(buf, float32(player.X))
	buf = appendFloat32(buf, float32(player.Y))
	buf = appendFloat32(buf, float32(player.VelX))
	buf = appendFloat32(buf, float32(player.VelY))
	buf = appendFloat32(buf, float32(player.Rotation))
	buf = appendFloat32(buf, float32(player.Size))
	
	// Score and seq (uint32)
	buf = appendUint32(buf, uint32(player.Score))
	buf = appendUint32(buf, player.Seq)
	
	// Optional fields
	if player.KilledBy != nil {
		buf = appendString(buf, *player.KilledBy)
	}
	if player.RespawnIn != nil {
		buf = appendFloat32(buf, float32(*player.RespawnIn))
	}
	if player.PowerupActive {
		buf = appendFloat32(buf, float32(player.PowerupDuration))
	}
	
	return buf
}

func encodeOtherPlayer(buf []byte, player OtherPlayerState) []byte {
	// Only send ID (for lookup) and position data - no name/model
	buf = appendString(buf, player.ID)
	buf = appendFloat32(buf, float32(player.X))
	buf = appendFloat32(buf, float32(player.Y))
	buf = appendFloat32(buf, float32(player.VelX))
	buf = appendFloat32(buf, float32(player.VelY))
	buf = appendFloat32(buf, float32(player.Rotation))
	buf = appendFloat32(buf, float32(player.Size))
	
	// Add powerup active flag (1 byte)
	if player.PowerupActive {
		buf = append(buf, 1)
	} else {
		buf = append(buf, 0)
	}
	
	return buf
}

func encodeFoodState(buf []byte, food FoodState) []byte {
	buf = appendUint64(buf, food.ID)
	buf = appendFloat32(buf, float32(food.X))
	buf = appendFloat32(buf, float32(food.Y))
	buf = appendFloat32(buf, float32(food.R))
	return buf
}

func encodePowerupState(buf []byte, powerup PowerupState) []byte {
	buf = appendUint64(buf, powerup.ID)
	buf = appendFloat32(buf, float32(powerup.X))
	buf = appendFloat32(buf, float32(powerup.Y))
	buf = appendFloat32(buf, float32(powerup.R))
	return buf
}

func encodeLeaderboardEntry(buf []byte, entry LeaderboardEntry) []byte {
	buf = appendString(buf, entry.Name)
	buf = appendUint32(buf, uint32(entry.Score))
	return buf
}

func encodeLeaderboard(entries []LeaderboardEntry) ([]byte, error) {
	buf := make([]byte, 0, len(entries)*32)
	buf = append(buf, MsgTypeLeaderboard)
	buf = append(buf, byte(len(entries)))
	
	for _, entry := range entries {
		buf = encodeLeaderboardEntry(buf, entry)
	}
	
	return buf, nil
}

func encodePlayerInfo(info PlayerInfoPayload) ([]byte, error) {
	buf := make([]byte, 0, 64)
	buf = append(buf, MsgTypePlayerInfo)
	buf = appendString(buf, info.ID)
	buf = appendString(buf, info.Name)
	buf = appendString(buf, info.Model)
	return buf, nil
}

func encodeAllPlayers(payload AllPlayersPayload) ([]byte, error) {
	capacity := 1 + 2 + len(payload.Players)*20
	buf := make([]byte, 0, capacity)
	buf = append(buf, MsgTypeAllPlayers)
	
	// Player count
	buf = append(buf, byte(len(payload.Players)>>8), byte(len(payload.Players)))
	
	// Encode each player position
	for _, p := range payload.Players {
		buf = appendString(buf, p.ID)
		buf = appendFloat32(buf, float32(p.X))
		buf = appendFloat32(buf, float32(p.Y))
	}
	
	return buf, nil
}

// Helper functions
func appendString(buf []byte, s string) []byte {
	length := uint16(len(s))
	buf = append(buf, byte(length>>8), byte(length))
	return append(buf, []byte(s)...)
}

func appendFloat32(buf []byte, f float32) []byte {
	bits := uint32(0)
	if f != 0 {
		bits = *(*uint32)(unsafe.Pointer(&f))
	}
	return append(buf, byte(bits>>24), byte(bits>>16), byte(bits>>8), byte(bits))
}

func appendUint32(buf []byte, u uint32) []byte {
	return append(buf, byte(u>>24), byte(u>>16), byte(u>>8), byte(u))
}

func appendUint64(buf []byte, u uint64) []byte {
	return append(buf, byte(u>>56), byte(u>>48), byte(u>>40), byte(u>>32),
		byte(u>>24), byte(u>>16), byte(u>>8), byte(u))
}

func putFloat64(buf []byte, f float64) {
	bits := *(*uint64)(unsafe.Pointer(&f))
	buf[0] = byte(bits >> 56)
	buf[1] = byte(bits >> 48)
	buf[2] = byte(bits >> 40)
	buf[3] = byte(bits >> 32)
	buf[4] = byte(bits >> 24)
	buf[5] = byte(bits >> 16)
	buf[6] = byte(bits >> 8)
	buf[7] = byte(bits)
}
