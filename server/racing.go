package main

import (
	"log"
	"math"
	"sort"
	"sync"
	"time"
)

// Racing-specific constants
const (
	CyclesPerRace     = 50      // 50 cycles × 2% = 100% to finish
	CycleProgress     = 0.02    // Each cycle is 2% progress
	RaceMaxPlayers    = 8       // Maximum players per race
	RaceLobbyWaitTime = 10      // Seconds to wait for more players before starting
	RaceCountdownTime = 3       // Seconds of countdown before race starts
)

// RaceState represents the current state of a race
type RaceState int

const (
	RaceStateLobby RaceState = iota
	RaceStateCountdown
	RaceStateRacing
	RaceStateFinished
)

// RacingWorld manages fish racing game sessions
type RacingWorld struct {
	Races      map[string]*Race // Map of race ID to race
	WaitingLobby *Race          // Current lobby waiting for players
	mu         sync.RWMutex
}

// Race represents a single race session
type Race struct {
	ID              string
	State           RaceState
	Players         map[string]*RacingPlayer
	StartTime       time.Time
	CountdownStart  time.Time
	FinishedPlayers []RaceResult
	World           *RacingWorld // Reference to parent world
	mu              sync.RWMutex
}

// RacingPlayer represents a player in a race
type RacingPlayer struct {
	ID            string
	Name          string
	Model         string
	Client        *RacingClient
	MouthCycles   int       // Number of complete mouth cycles (open → close)
	Progress      float64   // Progress from 0.0 to 1.0 (0% to 100%)
	FinishTime    float64   // Time taken to finish (in seconds)
	Finished      bool
	Ready         bool      // Player has clicked ready
	LastUpdate    time.Time // Last time we received a state update
}

// RaceResult stores the final result for a player
type RaceResult struct {
	PlayerID        string  `json:"playerId"`
	Name            string  `json:"name"`
	Model           string  `json:"model"`
	FinishTime      float64 `json:"finishTime"`
	MouthActionsPerMinute float64 `json:"mouthActionsPerMinute"` // Similar to WPM
	Rank            int     `json:"rank"`
}

// RacingClientMessage represents incoming messages from racing clients
type RacingClientMessage struct {
	Type       string    `json:"type"`
	Name       string    `json:"name,omitempty"`
	Model      string    `json:"model,omitempty"`
	MouthOpen  bool      `json:"mouthOpen,omitempty"`
	MouthCycle int       `json:"mouthCycle,omitempty"`
	Ready      bool      `json:"ready,omitempty"`
	Seq        uint32    `json:"seq,omitempty"`
	FishState  FishState `json:"fishState,omitempty"`
}

// FishState represents the current state of a fish in racing
type FishState struct {
	MouthCycles int `json:"mouthCycles"`
}

// RacingServerMessage represents outgoing messages to racing clients
type RacingServerMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// RaceWelcomePayload is sent when a player joins a race
type RaceWelcomePayload struct {
	PlayerID   string    `json:"playerId"`
	RaceID     string    `json:"raceId"`
	Name       string    `json:"name"`
	Model      string    `json:"model"`
	RaceState  string    `json:"raceState"`
}

// RaceStatePayload contains the current race state
type RaceStatePayload struct {
	RaceState    string              `json:"raceState"`
	TimeRemaining float64            `json:"timeRemaining,omitempty"` // For countdown/lobby
	Players      []RacePlayerState   `json:"players"`
	YourProgress RacePlayerState     `json:"yourProgress"`
	ReadyCount   int                 `json:"readyCount"`
	TotalPlayers int                 `json:"totalPlayers"`
}

// RacePlayerState represents a player's state in the race
type RacePlayerState struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Model    string  `json:"model"`
	Progress float64 `json:"progress"` // 0.0 to 1.0
	Finished bool    `json:"finished"`
	Ready    bool    `json:"ready"`
}

// RaceResultsPayload contains final race results
type RaceResultsPayload struct {
	Results []RaceResult `json:"results"`
}

// NewRacingWorld creates a new racing world
func NewRacingWorld() *RacingWorld {
	world := &RacingWorld{
		Races: make(map[string]*Race),
	}
	
	// Create initial lobby
	world.WaitingLobby = world.CreateRace()
	
	return world
}

// CreateRace creates a new race session
func (rw *RacingWorld) CreateRace() *Race {
	race := &Race{
		ID:      generateClientID(),
		State:   RaceStateLobby,
		Players: make(map[string]*RacingPlayer),
		World:   rw,
	}
	
	rw.Races[race.ID] = race
	return race
}

// JoinRace adds a player to the waiting lobby
func (rw *RacingWorld) JoinRace(client *RacingClient, playerName, model string) *Race {
	rw.mu.Lock()
	
	race := rw.WaitingLobby
	race.mu.Lock()
	
	// Create player
	player := &RacingPlayer{
		ID:     client.ID,
		Name:   playerName,
		Model:  model,
		Client: client,
	}
	
	race.Players[client.ID] = player
	
	log.Printf("Player %s joined race %s (%d/%d players)", playerName, race.ID, len(race.Players), RaceMaxPlayers)
	
	// Unlock before broadcasting to avoid deadlock
	race.mu.Unlock()
	rw.mu.Unlock()
	
	// Broadcast state to all players so they see the new player
	race.BroadcastState()
	
	return race
}

// StartLobbyCountdown waits for more players or starts the race
func (r *Race) StartLobbyCountdown() {
	time.Sleep(time.Duration(RaceLobbyWaitTime) * time.Second)
	
	r.mu.Lock()
	defer r.mu.Unlock()
	
	// Only start if we're still in lobby and have players
	if r.State == RaceStateLobby && len(r.Players) > 0 {
		r.StartRaceCountdown()
	}
}

// HandlePlayerReady marks a player as ready and starts countdown if all ready
func (r *Race) HandlePlayerReady(playerID string) {
	r.mu.Lock()
	
	// Only handle ready in lobby state
	if r.State != RaceStateLobby {
		r.mu.Unlock()
		return
	}
	
	player, exists := r.Players[playerID]
	if !exists {
		r.mu.Unlock()
		return
	}
	
	player.Ready = true
	log.Printf("Player %s is ready (%s)", player.Name, r.ID)
	
	// Check if all players are ready
	allReady := true
	readyCount := 0
	for _, p := range r.Players {
		if p.Ready {
			readyCount++
		} else {
			allReady = false
		}
	}
	
	log.Printf("Race %s: %d/%d players ready", r.ID, readyCount, len(r.Players))
	
	// Start race if all players are ready (minimum 1 player)
	if allReady && len(r.Players) > 0 {
		log.Printf("All players ready! Starting race %s", r.ID)
		r.mu.Unlock() // Unlock before starting countdown to avoid deadlock
		r.StartRaceCountdown()
	} else {
		r.mu.Unlock() // Unlock before broadcasting
		// Broadcast updated state to show ready status
		r.BroadcastState()
	}
}

// StartRaceCountdown begins the countdown before the race starts
func (r *Race) StartRaceCountdown() {
	r.State = RaceStateCountdown
	r.CountdownStart = time.Now()
	
	log.Printf("Race %s starting countdown with %d players", r.ID, len(r.Players))
	
	// Create a new waiting lobby for future joiners
	if r.World != nil {
		go func() {
			r.World.mu.Lock()
			r.World.WaitingLobby = r.World.CreateRace()
			log.Printf("Created new waiting lobby: %s (old race %s starting countdown)", r.World.WaitingLobby.ID, r.ID)
			r.World.mu.Unlock()
		}()
	}
	
	// Broadcast countdown state to all players
	r.BroadcastState()
	
	go func() {
		// Broadcast updates every second during countdown
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		
		for i := 0; i < RaceCountdownTime; i++ {
			<-ticker.C
			// Broadcast updated countdown
			if r.State == RaceStateCountdown {
				r.BroadcastState()
			}
		}
		
		r.StartRace()
	}()
}

// StartRace begins the actual race
func (r *Race) StartRace() {
	r.mu.Lock()
	r.State = RaceStateRacing
	r.StartTime = time.Now()
	r.mu.Unlock()
	
	log.Printf("Race %s started!", r.ID)
	
	// Broadcast racing state to all players
	r.BroadcastState()
	
	// Start race update loop
	go r.RaceLoop()
}

// RaceLoop updates race state and broadcasts at regular intervals
func (r *Race) RaceLoop() {
	ticker := time.NewTicker(100 * time.Millisecond) // Broadcast every 100ms
	defer ticker.Stop()
	
	for {
		<-ticker.C
		
		// Check if race should end
		r.mu.Lock()
		if r.State != RaceStateRacing {
			r.mu.Unlock()
			break
		}
        
		// Auto-finish players who stall near the end
		for _, player := range r.Players {
			if !player.Finished && player.Progress >= 0.96 && !player.LastUpdate.IsZero() {
				if time.Since(player.LastUpdate) > 3*time.Second {
					player.Finished = true
					player.FinishTime = time.Since(r.StartTime).Seconds()
					log.Printf("Auto-finishing player %s at %.0f%% after stall", player.ID, player.Progress*100)
					r.FinishedPlayers = append(r.FinishedPlayers, RaceResult{
						PlayerID:   player.ID,
						Name:       player.Name,
						Model:      player.Model,
						FinishTime: player.FinishTime,
						MouthActionsPerMinute: (float64(player.MouthCycles*2) / player.FinishTime) * 60.0,
					})
				}
			}
		}

		// Check if all players finished
		allFinished := true
		for _, player := range r.Players {
			if !player.Finished {
				allFinished = false
				break
			}
		}
		r.mu.Unlock()
		
		if allFinished && r.HasPlayers() {
			r.EndRace()
			break
		}
		
		r.BroadcastState()
	}
}

// HasPlayers checks if race has any players
func (r *Race) HasPlayers() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) > 0
}

// UpdateRace is deprecated - use RaceLoop instead
func (r *Race) UpdateRace(dt float64) {
	// This function is no longer used
	r.mu.Lock()
	defer r.mu.Unlock()
	
	// Check if all players finished (progress is now updated by HandleFishStateUpdate)
	allFinished := true
	for _, player := range r.Players {
		if !player.Finished {
			allFinished = false
			break
		}
	}
	
	// If all players finished, end race
	if allFinished && len(r.Players) > 0 {
		r.EndRace()
	}
	
	// Broadcast state to all players
	r.BroadcastState()
}

// EndRace finalizes the race and sends results
func (r *Race) EndRace() {
	r.State = RaceStateFinished
	
	// Sort results by finish time
	sort.Slice(r.FinishedPlayers, func(i, j int) bool {
		return r.FinishedPlayers[i].FinishTime < r.FinishedPlayers[j].FinishTime
	})
	
	// Update ranks
	for i := range r.FinishedPlayers {
		r.FinishedPlayers[i].Rank = i + 1
	}
	
	log.Printf("Race %s finished!", r.ID)
	
	// Broadcast results
	r.BroadcastResults()
}

// BroadcastState sends current race state to all players
func (r *Race) BroadcastState() {
	r.mu.RLock()
	
	// Collect data while holding the read lock
	raceState := r.StateString()
	countdownStart := r.CountdownStart
	state := r.State
	players := make([]*RacingPlayer, 0, len(r.Players))
	
	// Collect players in sorted order by ID for consistency
	for _, p := range r.Players {
		players = append(players, p)
	}
	sort.Slice(players, func(i, j int) bool {
		return players[i].ID < players[j].ID
	})
	
	// Build player states in sorted order
	playersData := make([]RacePlayerState, 0, len(players))
	for _, p := range players {
		playersData = append(playersData, RacePlayerState{
			ID:       p.ID,
			Name:     p.Name,
			Model:    p.Model,
			Progress: p.Progress,
			Finished: p.Finished,
			Ready:    p.Ready,
		})
	}
	
	r.mu.RUnlock()
	
	// Send messages outside the lock
	for i, player := range players {
		if player.Client == nil {
			continue
		}
		
		// Calculate time remaining for countdown
		var timeRemaining float64
		if state == RaceStateCountdown {
			elapsed := time.Since(countdownStart).Seconds()
			timeRemaining = math.Max(0, float64(RaceCountdownTime)-elapsed)
		} else if state == RaceStateLobby {
			timeRemaining = float64(RaceLobbyWaitTime)
		}
		
		// Count ready players
		readyCount := 0
		for _, p := range playersData {
			if p.Ready {
				readyCount++
			}
		}
		
		payload := RaceStatePayload{
			RaceState:     raceState,
			TimeRemaining: timeRemaining,
			Players:       playersData,
			YourProgress:  playersData[i],
			ReadyCount:    readyCount,
			TotalPlayers:  len(playersData),
		}
		
		player.Client.SendMessage(RacingServerMessage{
			Type:    "raceState",
			Payload: payload,
		})
	}
}

// BroadcastResults sends final results to all players
func (r *Race) BroadcastResults() {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	payload := RaceResultsPayload{
		Results: r.FinishedPlayers,
	}
	
	for _, player := range r.Players {
		if player.Client != nil {
			player.Client.SendMessage(RacingServerMessage{
				Type:    "raceResults",
				Payload: payload,
			})
		}
	}
}

// StateString returns the race state as a string
func (r *Race) StateString() string {
	switch r.State {
	case RaceStateLobby:
		return "lobby"
	case RaceStateCountdown:
		return "countdown"
	case RaceStateRacing:
		return "racing"
	case RaceStateFinished:
		return "finished"
	default:
		return "unknown"
	}
}

// HandleFishStateUpdate processes a fish state update from a client
func (r *Race) HandleFishStateUpdate(playerID string, state FishState) {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("PANIC in HandleFishStateUpdate: %v", err)
		}
	}()

	log.Printf("HandleFishStateUpdate START for player %s", playerID)
	r.mu.Lock()
	defer r.mu.Unlock()
	log.Printf("HandleFishStateUpdate: acquired lock")

	// Ignore updates on finished races
	if r.State == RaceStateFinished {
		log.Printf("Ignoring state update for player %s - race %s is finished", playerID, r.ID)
		return
	}

	player, ok := r.Players[playerID]
	if !ok {
		log.Printf("Player %s not found in race %s", playerID, r.ID)
		return
	}

	log.Printf("HandleFishStateUpdate: found player, current cycles=%d, new cycles=%d", player.MouthCycles, state.MouthCycles)
	prevCycles := player.MouthCycles
	
	// Update mouth cycles from client
	player.MouthCycles = state.MouthCycles
	player.LastUpdate = time.Now()
	log.Printf("Received state update for %s: cycles=%d (was %d), race state: %s", playerID, state.MouthCycles, prevCycles, r.StateString())

	// Calculate progress: each cycle is 2%
	player.Progress = float64(player.MouthCycles) * CycleProgress

	// If cycles exceed target, clamp to finish
	if player.MouthCycles >= CyclesPerRace {
		player.Progress = 1.0
	}

	// Cap progress at 100%
	if player.Progress > 1.0 {
		player.Progress = 1.0
	}

	log.Printf("HandleFishStateUpdate: calculated progress=%.2f%%", player.Progress*100)

	// Check if player just finished
	if player.Progress >= 1.0 && !player.Finished {
		player.Finished = true
		player.FinishTime = time.Since(r.StartTime).Seconds()
		log.Printf("Player %s finished! Time: %.2fs, Cycles: %d", playerID, player.FinishTime, player.MouthCycles)

		// Add to results
		r.FinishedPlayers = append(r.FinishedPlayers, RaceResult{
			PlayerID:   playerID,
			Name:       player.Name,
			Model:      player.Model,
			FinishTime: player.FinishTime,
			MouthActionsPerMinute: (float64(player.MouthCycles*2) / player.FinishTime) * 60.0,
		})

		// Check if all players finished
		allFinished := true
		for _, p := range r.Players {
			if !p.Finished {
				allFinished = false
				break
			}
		}

		if allFinished {
			// Do not mutate state here; RaceLoop will finalize
			log.Printf("All players finished! Signaling RaceLoop to finalize race %s", r.ID)
		}
	}

	log.Printf("HandleFishStateUpdate: releasing lock")
}// DisconnectPlayer removes a player from the race
func (r *Race) DisconnectPlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if player, exists := r.Players[playerID]; exists {
		log.Printf("Player %s disconnected from race %s (state: %s)", player.Name, r.ID, r.StateString())
		delete(r.Players, playerID)
		
		// Clean up finished or empty races
		if len(r.Players) == 0 {
			if r.State == RaceStateFinished {
				log.Printf("Race %s finished and empty - cleaning up", r.ID)
				if r.World != nil {
					r.World.mu.Lock()
					delete(r.World.Races, r.ID)
					r.World.mu.Unlock()
				}
			} else if r.State == RaceStateLobby || r.State == RaceStateCountdown {
				log.Printf("Race %s empty in %s state - will clean up", r.ID, r.StateString())
			}
		}
	}
}
