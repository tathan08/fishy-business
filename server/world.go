package main

import (
	"log"
	"math"
	"sort"
	"sync"
	"time"
)

// World represents the game world state
type World struct {
	Players    map[string]*Player
	Food       map[uint64]*Food
	InputQueue chan PlayerInput
	Quadtree   *Quadtree
	NextFoodID uint64
	mu         sync.RWMutex
}

// NewWorld creates a new world
func NewWorld() *World {
	return &World{
		Players:    make(map[string]*Player),
		Food:       make(map[uint64]*Food),
		InputQueue: make(chan PlayerInput, InputQueueSize),
		NextFoodID: 1,
	}
}

// Start begins the game loop
func (w *World) Start() {
	// Spawn initial food
	for i := 0; i < MaxFoodCount; i++ {
		w.SpawnFood()
	}

	// Start game loop
	go w.GameLoop()
	go w.BroadcastLoop()
}

// GameLoop runs the main game tick at 60Hz
func (w *World) GameLoop() {
	ticker := time.NewTicker(time.Duration(TickInterval) * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		w.Update(float64(TickInterval) / 1000.0)
	}
}

// BroadcastLoop sends state updates to clients at 15Hz
func (w *World) BroadcastLoop() {
	stateTicker := time.NewTicker(time.Second / BroadcastRate)
	leaderboardTicker := time.NewTicker(time.Second) // Leaderboard at 1Hz
	defer stateTicker.Stop()
	defer leaderboardTicker.Stop()

	for {
		select {
		case <-stateTicker.C:
			w.BroadcastState() // Send state without leaderboard
		case <-leaderboardTicker.C:
			w.BroadcastLeaderboard() // Send leaderboard separately
		}
	}
}

// Update updates the game state for one tick
func (w *World) Update(dt float64) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 1. Process input queue
	w.ProcessInputs()

	// 2. Update physics
	w.UpdatePhysics(dt)

	// 3. Rebuild quadtree
	w.RebuildQuadtree()

	// 4. Detect collisions
	w.DetectCollisions()

	// 5. Handle deaths and respawns
	w.HandleRespawns(dt)

	// 6. Spawn food
	w.SpawnFoodIfNeeded()
}

// ProcessInputs drains the input queue and updates player input state
func (w *World) ProcessInputs() {
	for {
		select {
		case input := <-w.InputQueue:
			if player, exists := w.Players[input.PlayerID]; exists && player.Alive {
				// Store the input direction and boost state
				// This persists until the next input update
				player.InputDirection = input.Direction
				player.InputBoost = input.Boost
				player.LastSeq = input.Seq
			}
		default:
			return
		}
	}
}

// UpdatePhysics updates positions and velocities
func (w *World) UpdatePhysics(dt float64) {
	for _, player := range w.Players {
		if !player.Alive {
			continue
		}

		// Apply velocity based on current input state (persists between input updates)
		targetVelocity := player.InputDirection.Mul(PlayerSpeed)
		if player.InputBoost {
			targetVelocity = targetVelocity.Mul(BoostMultiplier)
		}
		
		// Smoothly interpolate to target velocity
		player.Velocity = Lerp(player.Velocity, targetVelocity, VelocityLerp)

		// Update position
		player.Position = player.Position.Add(player.Velocity.Mul(dt))

		// Update rotation based on velocity (for hitbox calculations)
		if player.Velocity.Length() > 0.1 {
			player.Rotation = math.Atan2(player.Velocity.Y, player.Velocity.X)
		}

		// Clamp to world bounds (hard border)
		if player.Position.X < 0 {
			player.Position.X = 0
			player.Velocity.X = 0 // Stop horizontal movement
		} else if player.Position.X > WorldWidth {
			player.Position.X = WorldWidth
			player.Velocity.X = 0
		}

		if player.Position.Y < 0 {
			player.Position.Y = 0
			player.Velocity.Y = 0 // Stop vertical movement
		} else if player.Position.Y > WorldHeight {
			player.Position.Y = WorldHeight
			player.Velocity.Y = 0
		}

		// Deduct size if boosting
		if player.Velocity.Length() > PlayerSpeed*1.5 && player.Size > MinPlayerSize {
			player.Size -= BoostCostPerSec * dt
			if player.Size < MinPlayerSize {
				player.Size = MinPlayerSize
			}
		}
	}
}

// RebuildQuadtree rebuilds the spatial partitioning structure
func (w *World) RebuildQuadtree() {
	w.Quadtree = NewQuadtree(Rect{X: 0, Y: 0, Width: WorldWidth, Height: WorldHeight}, 4)

	// Insert all players
	for _, player := range w.Players {
		if player.Alive {
			w.Quadtree.Insert(&PlayerEntity{Player: player})
		}
	}

	// Insert all food
	for _, food := range w.Food {
		w.Quadtree.Insert(&FoodEntity{Food: food})
	}
}

// DetectCollisions checks for collisions between entities
func (w *World) DetectCollisions() {
	// First pass: Check for eating (mouth vs body/food)
	for _, player := range w.Players {
		if !player.Alive {
			continue
		}

		playerMouth := player.GetMouthHitbox()

		// Query nearby entities
		nearby := w.Quadtree.QueryCircle(player.Position, ViewDistance, nil)

		for _, entity := range nearby {
			switch e := entity.(type) {
			case *PlayerEntity:
				// Skip self
				if e.ID == player.ID {
					continue
				}

				// Check if player's mouth can eat the other player's body
				otherBody := e.GetBodyHitbox()
				if CircleOrientedRectCollision(playerMouth, otherBody) {
					// Bigger fish eats smaller fish
					if player.Size >= e.Size*SizeMultiplier {
						w.EatPlayer(player, e.Player)
					}
				}

			case *FoodEntity:
				// Check if player's mouth OR body collects food (food is circular)
				foodCircle := Circle{
					Center: e.Position,
					Radius: e.Size,
				}
				
				// Check mouth hitbox
				mouthCollision := CircleCircleCollision(playerMouth, foodCircle)
				
				// Check body hitbox
				playerBody := player.GetBodyHitbox()
				bodyCollision := CircleOrientedRectCollision(foodCircle, playerBody)
				
				if mouthCollision || bodyCollision {
					w.EatFood(player, e.Food)
				}
			}
		}
	}

	// Second pass: Check for body-to-body bouncing
	players := make([]*Player, 0, len(w.Players))
	for _, p := range w.Players {
		if p.Alive {
			players = append(players, p)
		}
	}

	for i := 0; i < len(players); i++ {
		for j := i + 1; j < len(players); j++ {
			p1 := players[i]
			p2 := players[j]

			// Check if bodies collide
			body1 := p1.GetBodyHitbox()
			body2 := p2.GetBodyHitbox()

			collides, separation := OrientedRectCollision(body1, body2)
			if collides {
				// Apply bounce force
				// Push both players apart
				force := BounceStrength
				p1.Velocity = p1.Velocity.Add(separation.Mul(-force * 0.016)) // dt approximation
				p2.Velocity = p2.Velocity.Add(separation.Mul(force * 0.016))
			}
		}
	}
}

// EatPlayer handles one player eating another
func (w *World) EatPlayer(eater, eaten *Player) {
	if !eaten.Alive {
		return
	}

	// Transfer size
	eater.Size += eaten.Size * 0.5
	if eater.Size > MaxPlayerSize {
		eater.Size = MaxPlayerSize
	}

	// Update score
	eater.Score += eaten.Score + 100

	// Kill eaten player
	eaten.Alive = false
	eaten.KilledBy = eater.Name
	eaten.RespawnTime = RespawnDelay

	log.Printf("Player %s ate player %s", eater.Name, eaten.Name)
}

// EatFood handles a player eating food
func (w *World) EatFood(player *Player, food *Food) {
	// Increase player size
	player.Size += FoodValue
	if player.Size > MaxPlayerSize {
		player.Size = MaxPlayerSize
	}

	// Increase score
	player.Score += 1

	// Remove food
	delete(w.Food, food.ID)
}

// HandleRespawns updates respawn timers and respawns dead players
func (w *World) HandleRespawns(dt float64) {
	for _, player := range w.Players {
		if !player.Alive {
			player.RespawnTime -= dt
			if player.RespawnTime <= 0 {
				player.Respawn()
				log.Printf("Player %s respawned", player.Name)
			}
		}
	}
}

// SpawnFoodIfNeeded spawns food if below target count
func (w *World) SpawnFoodIfNeeded() {
	toSpawn := MaxFoodCount - len(w.Food)
	if toSpawn > 0 {
		for i := 0; i < toSpawn && i < FoodSpawnRate; i++ {
			w.SpawnFood()
		}
	}
}

// SpawnFood creates a new food item
func (w *World) SpawnFood() {
	food := NewFood(w.NextFoodID)
	w.Food[food.ID] = food
	w.NextFoodID++
}

// BroadcastState sends game state without leaderboard
func (w *World) BroadcastState() {
	w.mu.RLock()
	defer w.mu.RUnlock()

	for _, player := range w.Players {
		if player.Client == nil {
			continue
		}

		// Build state without leaderboard
		state := w.BuildStateForPlayer(player, nil)

		// Send to client
		player.Client.SendMessage(ServerMessage{
			Type:    "state",
			Payload: state,
		})
	}
}

// BroadcastLeaderboard sends leaderboard updates separately
func (w *World) BroadcastLeaderboard() {
	w.mu.RLock()
	defer w.mu.RUnlock()

	leaderboard := w.GetLeaderboard()

	for _, player := range w.Players {
		if player.Client == nil {
			continue
		}

		player.Client.SendMessage(ServerMessage{
			Type:    "leaderboard",
			Payload: leaderboard,
		})
	}
}

// Broadcast sends state to all connected clients (legacy - for compatibility)
func (w *World) Broadcast() {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// Build leaderboard
	leaderboard := w.GetLeaderboard()

	for _, player := range w.Players {
		if player.Client == nil {
			continue
		}

		// Build personalized state
		state := w.BuildStateForPlayer(player, leaderboard)

		// Send to client
		player.Client.SendMessage(ServerMessage{
			Type:    "state",
			Payload: state,
		})
	}
}

// BuildStateForPlayer creates a game state message for a specific player
func (w *World) BuildStateForPlayer(player *Player, leaderboard []LeaderboardEntry) GameStatePayload {
	// Player's own state
	you := PlayerState{
		ID:       player.ID,
		Name:     player.Name,
		X:        player.Position.X,
		Y:        player.Position.Y,
		VelX:     player.Velocity.X,
		VelY:     player.Velocity.Y,
		Rotation: player.Rotation,
		Size:     player.Size,
		Score:    player.Score,
		Alive:    player.Alive,
		Seq:      player.LastSeq,
		Model:    player.Model,
	}

	if !player.Alive {
		you.KilledBy = &player.KilledBy
		you.RespawnIn = &player.RespawnTime
	}

	// Other players within view distance
	others := make([]OtherPlayerState, 0)
	newPlayers := make([]PlayerInfoPayload, 0) // Track new players for this client
	
	for _, other := range w.Players {
		if other.ID == player.ID || !other.Alive {
			continue
		}

		distance := Distance(player.Position, other.Position)
		if distance <= ViewDistance {
			// Check if this is the first time this client sees this player
			if !player.Client.SeenPlayers[other.ID] {
				player.Client.mu.Lock()
				player.Client.SeenPlayers[other.ID] = true
				player.Client.mu.Unlock()
				
				// Queue player info message
				newPlayers = append(newPlayers, PlayerInfoPayload{
					ID:    other.ID,
					Name:  other.Name,
					Model: other.Model,
				})
			}
			
			others = append(others, OtherPlayerState{
				ID:       other.ID,
				X:        other.Position.X,
				Y:        other.Position.Y,
				VelX:     other.Velocity.X,
				VelY:     other.Velocity.Y,
				Rotation: other.Rotation,
				Size:     other.Size,
				// Name and Model removed - sent once via PlayerInfo
			})
		}
	}
	
	// Send new player info messages immediately
	for _, info := range newPlayers {
		player.Client.SendMessage(ServerMessage{
			Type:    "playerInfo",
			Payload: info,
		})
	}

	// Food within view distance
	food := make([]FoodState, 0)
	for _, f := range w.Food {
		distance := Distance(player.Position, f.Position)
		if distance <= ViewDistance {
			food = append(food, FoodState{
				ID: f.ID,
				X:  f.Position.X,
				Y:  f.Position.Y,
				R:  f.Size,
			})
		}
	}

	return GameStatePayload{
		You:         you,
		Others:      others,
		Food:        food,
		Leaderboard: leaderboard,
	}
}

// GetLeaderboard returns the top 10 players by score
func (w *World) GetLeaderboard() []LeaderboardEntry {
	players := make([]*Player, 0, len(w.Players))
	for _, p := range w.Players {
		players = append(players, p)
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].Score > players[j].Score
	})

	leaderboard := make([]LeaderboardEntry, 0, 10)
	for i := 0; i < len(players) && i < 10; i++ {
		leaderboard = append(leaderboard, LeaderboardEntry{
			Name:  players[i].Name,
			Score: players[i].Score,
		})
	}

	return leaderboard
}

// AddPlayer adds a new player to the world
func (w *World) AddPlayer(player *Player) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.Players[player.ID] = player
	log.Printf("Added player %s to world. Total players: %d", player.ID, len(w.Players))
}

// Disconnect removes a player when they disconnect
func (w *World) Disconnect(client *Client) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if client.Player != nil {
		delete(w.Players, client.Player.ID)
		log.Printf("Player %s disconnected. Total players: %d", client.Player.ID, len(w.Players))
	}

	close(client.Send)
}
