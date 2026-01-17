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

// Binary Protocol Implementation
// Message Types
const (
	MsgTypeWelcome byte = 1
	MsgTypeState   byte = 2
	MsgTypePong    byte = 3
)

// EncodeBinaryMessage encodes a server message into binary format
func EncodeBinaryMessage(msg ServerMessage) ([]byte, error) {
	switch msg.Type {
	case "welcome":
		return encodeWelcome(msg.Payload.(WelcomePayload))
	case "state":
		return encodeGameState(msg.Payload.(GameStatePayload))
	case "pong":
		return []byte{MsgTypePong}, nil
	default:
		return nil, nil
	}
}

func encodeWelcome(payload WelcomePayload) ([]byte, error) {
	buf := make([]byte, 1+len(payload.ID)+2+8+8)
	buf[0] = MsgTypeWelcome
	
	// ID string (length + bytes)
	idLen := uint16(len(payload.ID))
	buf[1] = byte(idLen >> 8)
	buf[2] = byte(idLen)
	copy(buf[3:], payload.ID)
	
	offset := 3 + len(payload.ID)
	
	// World dimensions (float64)
	putFloat64(buf[offset:], payload.WorldWidth)
	putFloat64(buf[offset+8:], payload.WorldHeight)
	
	return buf, nil
}

func encodeGameState(state GameStatePayload) ([]byte, error) {
	// Estimate size
	capacity := 1 + 256 + len(state.Others)*64 + len(state.Food)*20 + len(state.Leaderboard)*64
	buf := make([]byte, 0, capacity)
	
	buf = append(buf, MsgTypeState)
	
	// Encode player state
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
	
	// Encode leaderboard count + data
	buf = append(buf, byte(len(state.Leaderboard)>>8), byte(len(state.Leaderboard)))
	for _, entry := range state.Leaderboard {
		buf = encodeLeaderboardEntry(buf, entry)
	}
	
	return buf, nil
}

func encodePlayerState(buf []byte, player PlayerState) []byte {
	// Flags byte: bit 0 = alive, bit 1 = has killedBy, bit 2 = has respawnIn
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
	buf = append(buf, flags)
	
	// ID length + string
	buf = appendString(buf, player.ID)
	// Name length + string
	buf = appendString(buf, player.Name)
	// Model length + string
	buf = appendString(buf, player.Model)
	
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
	
	return buf
}

func encodeOtherPlayer(buf []byte, player OtherPlayerState) []byte {
	buf = appendString(buf, player.ID)
	buf = appendString(buf, player.Name)
	buf = appendString(buf, player.Model)
	buf = appendFloat32(buf, float32(player.X))
	buf = appendFloat32(buf, float32(player.Y))
	buf = appendFloat32(buf, float32(player.VelX))
	buf = appendFloat32(buf, float32(player.VelY))
	buf = appendFloat32(buf, float32(player.Rotation))
	buf = appendFloat32(buf, float32(player.Size))
	return buf
}

func encodeFoodState(buf []byte, food FoodState) []byte {
	buf = appendUint64(buf, food.ID)
	buf = appendFloat32(buf, float32(food.X))
	buf = appendFloat32(buf, float32(food.Y))
	buf = appendFloat32(buf, float32(food.R))
	return buf
}

func encodeLeaderboardEntry(buf []byte, entry LeaderboardEntry) []byte {
	buf = appendString(buf, entry.Name)
	buf = appendUint32(buf, uint32(entry.Score))
	return buf
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
