# Rendering Utilities

This folder contains modular rendering functions for the game canvas.

## Files

### `camera.ts`
Calculates camera position that follows the player while staying within world bounds.

**Exports:**
- `calculateCamera()` - Returns `{ cameraX, cameraY }`

### `drawFish.ts`
Renders individual fish on the canvas.

**Exports:**
- `drawFish()` - Draws fish body, eye, username, and size

### `drawMinimap.ts`
Renders the minimap in the top-right corner.

**Exports:**
- `drawMinimap()` - Shows full world view with:
  - Yellow dot: Your fish
  - Blue dots: Other players
  - Green rectangle: Your viewport
  - Red border: World boundary

### `drawLeaderboard.ts`
Renders the leaderboard below the minimap.

**Exports:**
- `drawLeaderboard()` - Shows top players with scores

## Usage

```typescript
import { drawFish } from './rendering/drawFish';
import { drawMinimap } from './rendering/drawMinimap';
import { drawLeaderboard } from './rendering/drawLeaderboard';
import { calculateCamera } from './rendering/camera';

// In your render loop:
const { cameraX, cameraY } = calculateCamera(...);
drawFish(ctx, player, true);
drawMinimap(ctx, gameState, canvas, worldWidth, worldHeight, cameraX, cameraY);
drawLeaderboard(ctx, gameState, canvas.width, player);
```

## Benefits of Modular Structure

- **Easy debugging**: Each rendering function is isolated
- **Testable**: Can test each function independently
- **Maintainable**: Changes to one component don't affect others
- **Reusable**: Can import only what you need
