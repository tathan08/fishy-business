# 🏁 Fish Racing

Fish Racing is a typeracer-style multiplayer game where players compete by opening and closing their mouths to boost their fish forward!

## How It Works

### Game Concept
- Players race their fish to reach the finish line first
- Opening your mouth gives a speed boost (2.5x multiplier)
- The faster you open and close your mouth, the faster you move
- Your performance is measured in **Mouth Actions Per Minute (MAPM)** - similar to WPM in typeracer

### Race Flow
1. **Lobby** - Players join and wait for more racers (max 8 players, 10s wait time)
2. **Countdown** - 3-second countdown before race starts
3. **Racing** - Open/close mouth rapidly to move forward (race distance: 1000 units)
4. **Results** - Final rankings with finish times and MAPM scores

## Technical Architecture

### Server (Go)
- **racing.go** - Core race logic, player state, race management
- **racing_network.go** - WebSocket handlers for racing clients
- **main.go** - Adds `/ws/racing` WebSocket endpoint

Key Features:
- Lobby system with automatic race start
- Real-time mouth state tracking
- 60Hz game loop for smooth racing
- Automatic MAPM calculation based on mouth actions per minute
- Support for up to 8 concurrent players per race

### Client (Next.js + TypeScript)
- **racingConnection.ts** - WebSocket connection handler for racing
- **racingFaceTracking.ts** - MediaPipe face tracking for mouth detection
- **app/racing/page.tsx** - Racing game UI and visualization

Key Features:
- Real-time mouth tracking with MediaPipe Face Landmarker
- Canvas-based race visualization
- Visual feedback for mouth state (BOOSTING indicator)
- Multi-stage UI (lobby → countdown → racing → results)

## Environment Variables

Add to your `.env` file:
```
NEXT_PUBLIC_RACING_WS_URL=ws://localhost:8080/ws/racing
```

For production:
```
NEXT_PUBLIC_RACING_WS_URL=wss://your-domain.com/ws/racing
```

## Running Locally

### Start Server
```bash
cd server
go run .
```

Server will start on `http://localhost:8080` with racing endpoint at `/ws/racing`

### Start Client
```bash
cd client
npm run dev
```

Navigate to `http://localhost:3000/racing` to play!

## Game Constants

Adjustable in `server/racing.go`:
- `RaceDistance` = 1000.0 (distance to finish)
- `RaceMaxPlayers` = 8 (max players per race)
- `RaceLobbyWaitTime` = 10 seconds
- `RaceCountdownTime` = 3 seconds
- `BaseSpeed` = 50.0 (normal forward speed)
- `MouthBoostMultiplier` = 2.5 (speed when mouth is open)

## Mouth Detection

The system uses MediaPipe Face Landmarker to detect mouth state:
- Calculates mouth aspect ratio (height/width)
- Threshold: 0.15 (adjustable in `racingFaceTracking.ts`)
- 3-frame smoothing to prevent flickering
- Real-time state updates at 60Hz

## Race Results

At the end of each race, players receive:
- **Rank** - Final placement (1st, 2nd, 3rd, etc.)
- **Finish Time** - Total seconds to complete
- **MAPM** - Mouth Actions Per Minute score

Formula: `MAPM = (totalMouthActions / finishTimeSeconds) * 60`

## Multiplayer

- Multiple races can run simultaneously
- Automatic lobby creation when previous race starts
- Disconnection handling (players can leave without breaking the race)
- Real-time state synchronization for all players

## Future Enhancements

Potential additions:
- Power-ups and obstacles on the track
- Different fish models with unique stats
- Tournament mode with multiple rounds
- Replay system to watch races
- Leaderboard with best MAPM scores
- Practice mode for single player
