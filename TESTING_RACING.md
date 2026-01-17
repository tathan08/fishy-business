# Testing Fish Racing Locally

## Quick Start Guide

### 1. Start the Server

```bash
cd server
go run .
```

You should see:
```
Starting server on :8080
WebSocket endpoints:
  - Primary:  ws://localhost:8080/ws
  - Metadata: ws://localhost:8080/ws/meta
  - Racing:   ws://localhost:8080/ws/racing
```

### 2. Configure Environment

Make sure your `client/.env` has:
```
NEXT_PUBLIC_RACING_WS_URL=ws://localhost:8080/ws/racing
```

### 3. Start the Client

```bash
cd client
npm run dev
```

Navigate to: http://localhost:3000

### 4. Test Racing

1. Click **"🏁 FISH RACING"** button on home page
2. Enter your name
3. Click **"Start Racing!"**
4. Allow camera access when prompted
5. Open and close your mouth rapidly to move forward!

### Testing Multiplayer

Open multiple browser windows/tabs:
- Each window = 1 player
- First 8 players join the same lobby
- Race auto-starts after 10 seconds OR when 8 players join
- After race starts, new players go to a new lobby

### What to Expect

**Lobby Phase:**
- Shows "Waiting for Players..."
- Lists all players in the lobby
- Auto-starts after 10s or when full (8 players)

**Countdown Phase:**
- Shows 3... 2... 1... GO!
- Get ready to move your mouth!

**Racing Phase:**
- Canvas shows all racers with progress bars
- Your lane is highlighted (darker background)
- Green "BOOSTING" indicator when mouth is open
- Fish emoji (🐟) shows your position
- Progress percentage displayed

**Results Phase:**
- Final rankings (1st, 2nd, 3rd...)
- Finish times in seconds
- MAPM (Mouth Actions Per Minute) scores
- Gold/Silver/Bronze color coding

### Tips for Best Results

1. **Good Lighting** - Face tracking works best with proper lighting
2. **Center Your Face** - Stay centered in the camera view
3. **Exaggerate Movements** - Open your mouth wide for reliable detection
4. **Consistent Rhythm** - Find a steady pace rather than random movements
5. **No Glasses** - Remove glasses if you have tracking issues

### Troubleshooting

**Camera not working:**
- Check browser permissions
- Refresh the page and allow camera access
- Try a different browser (Chrome/Edge recommended)

**Face tracking not detecting mouth:**
- Ensure good lighting
- Move closer to camera
- Open mouth wider
- Check browser console for errors

**WebSocket not connecting:**
- Verify server is running on port 8080
- Check `.env` file has correct URL
- Look at browser console for connection errors

**Race not starting:**
- Need at least 1 player in lobby
- Wait 10 seconds for auto-start
- Or get 8 players to trigger immediate start

### Performance Monitoring

Open browser console to see:
- Connection status
- Face tracking initialization
- Mouth state changes
- Race state updates

### Expected Console Output

```
Connecting to racing server: ws://localhost:8080/ws/racing
Racing WebSocket connected
Joined race: <race-id>
Racing face tracking: Starting...
Racing face tracking: Camera access granted
Racing face tracking: MediaPipe loaded
Racing face tracking: Active!
```

### Server Console Output

```
Racing client connected: <client-id>
Player <name> joined racing as <client-id>
Player <name> joined race <race-id> (1/8 players)
Race <race-id> starting countdown with 1 players
Race <race-id> started!
Player <name> finished! Time: 15.23s, MAPM: 85.2
Race <race-id> finished!
```

## Demo Scenario

To showcase the full experience:

1. **Solo Test**: Join as 1 player, wait 10s for auto-start
2. **Multiplayer Test**: Open 3-4 browser tabs simultaneously
3. **Competitive Test**: Race with friends, compare MAPM scores!

Enjoy racing! 🐟🏁
