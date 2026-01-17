# Fishy Business - Backend Server

A real-time multiplayer PvP fish simulator backend built with Go and WebSockets.

## Architecture

- **Single Global World**: All players connect to one shared ocean
- **Authoritative Server**: Server is the source of truth for all game state
- **60Hz Game Loop**: Physics and collision detection run at 60 ticks per second
- **20Hz Broadcast**: State updates sent to clients 20 times per second
- **Spatial Partitioning**: Quadtree for efficient collision detection
- **Interest Management**: Players only receive updates about nearby entities

## Project Structure

```
server/
├── main.go          # Entry point and HTTP server setup
├── world.go         # World state management and game loop
├── entities.go      # Player and Food data structures
├── network.go       # WebSocket handling and client management
├── protocol.go      # Message types for client-server communication
├── quadtree.go      # Spatial partitioning for collision detection
├── math.go          # Vector math utilities
├── utils.go         # Helper functions
├── config.go        # Game configuration constants
└── go.mod           # Go module dependencies
```

## Building and Running

### Prerequisites

- Go 1.21 or higher

### Install Dependencies

```bash
cd server
go mod download
```

### Build

```bash
go build -o fishy-business-server
```

### Run

```bash
./fishy-business-server
```

Or directly:

```bash
go run .
```

The server will start on `http://localhost:8080` with WebSocket endpoint at `ws://localhost:8080/ws`.

## WebSocket Protocol

### Client → Server Messages

#### JOIN
```json
{
  "type": "join",
  "name": "PlayerName"
}
```

#### INPUT (sent ~20Hz)
```json
{
  "type": "input",
  "dirX": 0.707,
  "dirY": 0.707,
  "boost": false,
  "seq": 142
}
```

#### PING
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### WELCOME (sent once after JOIN)
```json
{
  "type": "welcome",
  "payload": {
    "id": "uuid",
    "worldWidth": 4000,
    "worldHeight": 4000
  }
}
```

#### STATE (sent ~20Hz)
```json
{
  "type": "state",
  "payload": {
    "you": {
      "id": "uuid",
      "x": 1234.5,
      "y": 567.8,
      "size": 45.2,
      "score": 320,
      "alive": true,
      "seq": 142,
      "killedBy": null,
      "respawnIn": null
    },
    "others": [
      {"id": "abc", "name": "Bob", "x": 1300, "y": 600, "size": 30}
    ],
    "food": [
      {"id": 1001, "x": 1250, "y": 580, "r": 7}
    ],
    "leaderboard": [
      {"name": "Alice", "score": 1500}
    ]
  }
}
```

#### PONG
```json
{
  "type": "pong"
}
```

## Game Mechanics

### Movement
- Players send input direction (normalized vector) and boost flag
- Server applies velocity smoothing using lerp
- Boost multiplies speed by 1.8x but costs size over time

### Eating
- Players can eat food to grow
- Larger fish can eat smaller fish (need to be 1.1x bigger)
- Eating another player gives score bonus and increases size

### Respawning
- Dead players respawn after 3 seconds
- Players respawn at random position with initial size

### View Distance
- Players only receive updates about entities within 800 pixels
- Reduces network bandwidth significantly

## Configuration

All game parameters can be adjusted in [config.go](config.go):

- World size: 4000x4000
- Player speeds, sizes, boost costs
- Food spawn rates and values
- Tick rates and broadcast rates
- View distance

## Architecture Details

### Concurrency Model

1. **Main Goroutine**: HTTP server and setup
2. **Game Loop Goroutine**: Single thread that owns world state, runs at 60Hz
3. **Broadcast Loop Goroutine**: Sends state updates at 20Hz
4. **Per-Client Read Pumps**: N goroutines reading WebSocket messages
5. **Per-Client Write Pumps**: N goroutines writing to WebSocket

### Data Flow

```
Client → ReadPump → InputQueue (buffered channel)
                         ↓
                    Game Loop (drains queue)
                         ↓
                    World.Update()
                         ↓
                    Broadcast Loop → WritePump → Client
```

### Spatial Partitioning

The quadtree is rebuilt every tick and used for:
- Finding nearby players for collision detection
- Interest management (only send nearby entities to clients)
- Efficient O(log n) queries instead of O(n²) comparisons

## Performance Considerations

- Input queue is buffered (10,000 capacity) to handle bursts
- Non-blocking sends to prevent slow clients from blocking server
- Write channels per client prevent head-of-line blocking
- Spatial partitioning reduces collision checks from O(n²) to O(n log n)
- Interest management reduces network bandwidth by ~90%

## Deployment

### Deploy to Fly.io

1. **Install Fly CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login to Fly.io**
   ```bash
   fly auth login
   ```

3. **Launch the app** (first time)
   ```bash
   cd server
   fly launch
   ```
   
   Follow the prompts:
   - Choose app name (or use generated one)
   - Select region (e.g., `sin` for Singapore)
   - Don't create a database
   - Don't deploy yet

4. **Update fly.toml** (if needed)
   - Adjust `app` name
   - Change `primary_region` to your preferred region
   - Modify `memory_mb` if needed (256MB is sufficient for testing)

5. **Deploy**
   ```bash
   fly deploy
   ```

6. **Get your WebSocket URL**
   ```bash
   fly info
   ```
   
   Your WebSocket endpoint will be: `wss://your-app-name.fly.dev/ws`

7. **View logs**
   ```bash
   fly logs
   ```

8. **Scale if needed**
   ```bash
   # Scale to multiple regions
   fly scale count 2 --region sin,syd
   
   # Increase memory
   fly scale memory 512
   ```

### Environment Configuration

The app uses the following default port:
- **8080**: HTTP/WebSocket port (automatically mapped by Fly.io)

### Monitoring

```bash
# View app status
fly status

# Open dashboard
fly dashboard

# View metrics
fly metrics
```

## Future Enhancements

- Multiple rooms/instances for horizontal scaling
- Redis for shared leaderboards across servers
- Binary protocol (MessagePack/Protobuf) instead of JSON
- Client-side prediction reconciliation
- Entity interpolation on client
- Matchmaking service
- Database persistence for player stats

## License

MIT
