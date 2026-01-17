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
	RaceDistance         = 1000.0 // Distance to complete the race
	RaceMaxPlayers       = 8      // Maximum players per race
	RaceLobbyWaitTime    = 10     // Seconds to wait for more players before starting
	RaceCountdownTime    = 3      // Seconds of countdown before race starts
	BaseSpeed            = 50.0   // Base forward speed
	MouthBoostMultiplier = 2.5    // Speed multiplier when mouth is open
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
	mu              sync.RWMutex
}

// RacingPlayer represents a player in a race
type RacingPlayer struct {
	ID                string
	Name              string
	Model             string
	Client            *RacingClient
	Distance          float64   // Distance traveled (0 to RaceDistance)
	Speed             float64   // Current speed
	MouthOpenCount    int       // Number of times mouth was opened
	MouthCloseCount   int       // Number of times mouth was closed
	LastMouthState    bool      // Last known mouth state (true = open)
	MouthActionTimes  []float64 // Timestamps of mouth actions for calculating speed
	FinishTime        float64   // Time taken to finish (in seconds)
	Finished          bool
	Ready             bool      // Player has clicked ready
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
	Type       string `json:"type"`
	Name       string `json:"name,omitempty"`
	Model      string `json:"model,omitempty"`
	MouthOpen  bool   `json:"mouthOpen,omitempty"`
	Ready      bool   `json:"ready,omitempty"`
	Seq        uint32 `json:"seq,omitempty"`
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
	Distance float64 `json:"distance"`
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
		ID:             client.ID,
		Name:           playerName,
		Model:          model,
		Client:         client,
		Distance:       0,
		Speed:          0,
		LastMouthState: false,
		MouthActionTimes: make([]float64, 0),
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
	defer r.mu.Unlock()
	
	// Only handle ready in lobby state
	if r.State != RaceStateLobby {
		return
	}
	
	player, exists := r.Players[playerID]
	if !exists {
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
		r.StartRaceCountdown()
	} else {
		// Broadcast updated state to show ready status
		r.BroadcastState()
	}
}

// StartRaceCountdown begins the countdown before the race starts
func (r *Race) StartRaceCountdown() {
	r.State = RaceStateCountdown
	r.CountdownStart = time.Now()
	
	log.Printf("Race %s starting countdown with %d players", r.ID, len(r.Players))
	
	go func() {
		time.Sleep(time.Duration(RaceCountdownTime) * time.Second)
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
	
	// Start race update loop
	go r.RaceLoop()
}

// RaceLoop updates race state at 60Hz
func (r *Race) RaceLoop() {
	ticker := time.NewTicker(time.Millisecond * 16) // ~60 FPS
	defer ticker.Stop()
	
	for r.State == RaceStateRacing {
		<-ticker.C
		r.UpdateRace(0.016) // 16ms = 0.016s
	}
}

// UpdateRace updates all player positions
func (r *Race) UpdateRace(dt float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	allFinished := true
	
	for _, player := range r.Players {
		if !player.Finished {
			// Move player forward based on speed
			player.Distance += player.Speed * dt
			
			// Check if player finished
			if player.Distance >= RaceDistance {
				player.Distance = RaceDistance
				player.Finished = true
				player.FinishTime = time.Since(r.StartTime).Seconds()
				
				// Calculate mouth actions per minute
				if player.FinishTime > 0 {
					totalActions := float64(player.MouthOpenCount + player.MouthCloseCount)
					player.FinishTime = math.Max(player.FinishTime, 0.001) // Prevent division by zero
					mapm := (totalActions / player.FinishTime) * 60.0
					
					result := RaceResult{
						PlayerID:              player.ID,
						Name:                  player.Name,
						Model:                 player.Model,
						FinishTime:            player.FinishTime,
						MouthActionsPerMinute: mapm,
						Rank:                  len(r.FinishedPlayers) + 1,
					}
					r.FinishedPlayers = append(r.FinishedPlayers, result)
					
					log.Printf("Player %s finished! Time: %.2fs, MAPM: %.2f", player.Name, player.FinishTime, mapm)
				}
			} else {
				allFinished = false
			}
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
	defer r.mu.RUnlock()
	
	for _, player := range r.Players {
		if player.Client == nil {
			continue
		}
		
		// Build player states
		playerStates := make([]RacePlayerState, 0, len(r.Players))
		var yourProgress RacePlayerState
		
		for _, p := range r.Players {
			state := RacePlayerState{
				ID:       p.ID,
				Name:     p.Name,
				Model:    p.Model,
				Distance: p.Distance,
				Progress: p.Distance / RaceDistance,
				Finished: p.Finished,
				Ready:    p.Ready,
			}
			playerStates = append(playerStates, state)
			
			if p.ID == player.ID {
				yourProgress = state
			}
		}
		
		// Count ready players
		readyCount := 0
		for _, p := range r.Players {
			if p.Ready {
				readyCount++
			}
		}
		
		// Calculate time remaining for countdown
		var timeRemaining float64
		if r.State == RaceStateCountdown {
			elapsed := time.Since(r.CountdownStart).Seconds()
			timeRemaining = math.Max(0, float64(RaceCountdownTime)-elapsed)
		} else if r.State == RaceStateLobby {
			// This would need more complex logic to track lobby start time
			timeRemaining = float64(RaceLobbyWaitTime)
		}
		
		payload := RaceStatePayload{
			RaceState:     r.StateString(),
			TimeRemaining: timeRemaining,
			Players:       playerStates,
			YourProgress:  yourProgress,
			ReadyCount:    readyCount,
			TotalPlayers:  len(r.Players),
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

// HandleMouthInput processes mouth open/close events
func (r *Race) HandleMouthInput(playerID string, mouthOpen bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	player, exists := r.Players[playerID]
	if !exists || r.State != RaceStateRacing {
		return
	}
	
	// Detect mouth state change
	if mouthOpen != player.LastMouthState {
		currentTime := time.Since(r.StartTime).Seconds()
		player.MouthActionTimes = append(player.MouthActionTimes, currentTime)
		
		if mouthOpen {
			player.MouthOpenCount++
		} else {
			player.MouthCloseCount++
		}
		
		player.LastMouthState = mouthOpen
	}
	
	// Update speed based on mouth state
	if mouthOpen {
		player.Speed = BaseSpeed * MouthBoostMultiplier
	} else {
		player.Speed = BaseSpeed
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

// DisconnectPlayer removes a player from the race
func (r *Race) DisconnectPlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if player, exists := r.Players[playerID]; exists {
		log.Printf("Player %s disconnected from race %s", player.Name, r.ID)
		delete(r.Players, playerID)
		
		// If race is in lobby/countdown and no players left, we could clean up
		if len(r.Players) == 0 && r.State != RaceStateRacing {
			log.Printf("Race %s has no players in lobby, will be cleaned up", r.ID)
		}
	}
}
