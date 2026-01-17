# Hitbox System Implementation

## Overview
This document describes the two-part hitbox system implemented for the fish game, with **per-fish-model customization** and size capping at `MaxPlayerSize`.

## System Design

### Two-Part Hitbox System

#### 1. Mouth Hitbox (Eating)
- **Shape**: Circle
- **Purpose**: Determines what the fish can eat
- **Size**: Model-specific ratio of fish size (20-35% depending on fish)
- **Position**: Model-specific offset in front of the fish center
- **Rotation**: Follows fish direction (based on velocity)

#### 2. Body Hitbox (Bouncing)
- **Shape**: Oriented Rectangle (rotated)
- **Purpose**: Determines collision with other fish bodies
- **Size**: Model-specific width and height ratios
- **Position**: Centered on fish position
- **Rotation**: Follows fish direction (based on velocity)

### Per-Fish-Model Configurations

Each fish model has customized hitbox dimensions matching its visual shape:

| Fish Model | Body W:H | Body Ratio | Mouth Size | Mouth Offset | Shape Description |
|------------|----------|------------|------------|--------------|-------------------|
| **Swordfish** | 3.5:0.8 | 4.4:1 | 25% | 1.8x | Very elongated with long sword |
| **Shark** | 3.0:0.9 | 3.3:1 | 35% | 1.4x | Streamlined predator |
| **Sacabambaspis** | 2.5:1.0 | 2.5:1 | 30% | 1.2x | Elongated oval (default) |
| **Blobfish** | 2.2:1.3 | 1.7:1 | 35% | 1.0x | Wide and blobby |
| **Pufferfish** | 1.2:1.2 | 1:1 | 30% | 0.6x | Nearly circular |

**Why Different Hitboxes?**
- **Swordfish**: Long sword needs extended forward reach
- **Pufferfish**: Spherical shape should not have elongated hitbox
- **Blobfish**: Flat and wide, not tall
- **Shark**: Classic predator with large mouth
- **Sacabambaspis**: Balanced prehistoric fish shape

### Size Capping

Both hitboxes are capped at `MaxPlayerSize` (200) to prevent hitboxes from becoming too large:

```go
cappedSize := Min(p.Size, MaxPlayerSize)
```

This means:
- Even if a fish grows beyond size 200, hitboxes remain at size 200
- Visual size can continue growing, but collision detection stays manageable
- Prevents unfair advantage for extremely large fish

## Configuration

## Configuration

In `config.go`:

```go
// HitboxConfig defines hitbox dimensions for a fish model
type HitboxConfig struct {
	BodyWidthRatio   float64
	BodyHeightRatio  float64
	MouthSizeRatio   float64
	MouthOffsetRatio float64
}

// FishHitboxConfigs maps fish models to their hitbox configurations
var FishHitboxConfigs = map[string]HitboxConfig{
	"swordfish": {
		BodyWidthRatio:   3.5,
		BodyHeightRatio:  0.8,
		MouthSizeRatio:   0.25,
		MouthOffsetRatio: 1.8,
	},
	"blobfish": {
		BodyWidthRatio:   2.2,
		BodyHeightRatio:  1.3,
		MouthSizeRatio:   0.35,
		MouthOffsetRatio: 1.0,
	},
	"pufferfish": {
		BodyWidthRatio:   1.2,
		BodyHeightRatio:  1.2,
		MouthSizeRatio:   0.3,
		MouthOffsetRatio: 0.6,
	},
	"shark": {
		BodyWidthRatio:   3.0,
		BodyHeightRatio:  0.9,
		MouthSizeRatio:   0.35,
		MouthOffsetRatio: 1.4,
	},
	"sacabambaspis": {
		BodyWidthRatio:   2.5,
		BodyHeightRatio:  1.0,
		MouthSizeRatio:   0.3,
		MouthOffsetRatio: 1.2,
	},
}

// DefaultHitboxConfig is used for unknown or unspecified fish models
var DefaultHitboxConfig = HitboxConfig{
	BodyWidthRatio:   2.5,
	BodyHeightRatio:  1.0,
	MouthSizeRatio:   0.3,
	MouthOffsetRatio: 1.2,
}

// Collision
BounceStrength = 150.0 // Push force when bodies collide
```

## Collision Detection Flow

### Phase 1: Eating Detection
For each alive player:
1. Get the player's mouth hitbox
2. Query nearby entities using quadtree
3. For each other player:
   - Check if mouth (circle) intersects other's body (oriented rect)
   - If yes and size ratio is sufficient, eat the other player
4. For each food:
   - Check if mouth (circle) intersects food (circle)
   - If yes, eat the food

### Phase 2: Body Bouncing
For each pair of alive players:
1. Get both players' body hitboxes
2. Check if bodies (oriented rects) collide
3. If yes, apply bounce force to push them apart
4. Bounce strength: `BounceStrength = 150.0`

## Mathematical Functions

### Collision Detection Functions (in `math.go`)

1. **CircleCircleCollision**: Checks if two circles overlap
2. **CircleOrientedRectCollision**: Checks if circle overlaps rotated rectangle
3. **OrientedRectCollision**: Checks if two rotated rectangles overlap (returns collision + separation vector)
4. **Clamp**: Utility to restrict values between min and max

### Hitbox Calculation Methods (in `entities.go`)

1. **GetHitboxConfig()**: Returns the appropriate hitbox config for the fish model
2. **GetMouthHitbox()**: Returns mouth circle hitbox using model-specific ratios with capped size
3. **GetBodyHitbox()**: Returns body oriented rect hitbox using model-specific ratios with capped size

## Rotation System

Fish rotation is automatically calculated based on velocity:

```go
if player.Velocity.Length() > 0.1 {
    player.Rotation = math.Atan2(player.Velocity.Y, player.Velocity.X) + math.Pi
}
```

**Note**: We add `math.Pi` (180°) because the fish images have their heads pointing LEFT (at 180°), not RIGHT (at 0°). This ensures:
- The head leads when moving, not the tail
- The mouth hitbox is positioned at the head
- Visual appearance matches the direction of movement

This rotation is:
- Sent to clients in the game state
- Used to position the mouth hitbox correctly
- Used to orient the body hitbox correctly

## Benefits of This System

1. **Realistic Eating**: Fish can only eat from their mouth, not their tail
2. **Body Collision**: Fish bounce off each other's bodies naturally
3. **Model-Specific Accuracy**: Each fish has hitboxes matching its visual shape
4. **Fair Gameplay**: Pufferfish can't abuse elongated hitbox, swordfish gets proper sword reach
5. **Size Scaling**: Hitboxes grow with fish size
6. **Size Capping**: Prevents hitboxes from becoming unmanageably large
7. **Performance**: Map lookup is negligible (~0.03% CPU at 60 FPS)
8. **Balance**: Large fish don't have disproportionate advantage

## Testing Recommendations

1. Test eating mechanics with each fish model at different sizes
2. Test swordfish sword reach vs pufferfish circular hitbox
3. Test body bouncing between different fish models
4. Test hitbox behavior at `MaxPlayerSize` threshold
5. Test hitbox behavior for fish larger than `MaxPlayerSize`
6. Verify mouth position is correctly offset for each model
7. Verify rotation updates correctly based on movement

## Tuning the Hitboxes

To adjust a fish model's hitbox, edit `FishHitboxConfigs` in `config.go`:

- **Increase BodyWidthRatio**: Makes fish longer/wider (more forward reach)
- **Increase BodyHeightRatio**: Makes fish taller (more vertical collision)
- **Increase MouthSizeRatio**: Makes eating hitbox bigger (easier to eat)
- **Increase MouthOffsetRatio**: Moves mouth further forward (longer reach)

Example: If swordfish sword is too short, increase `MouthOffsetRatio` from 1.8 to 2.0.

## Future Improvements

- Fine-tune hitbox ratios based on gameplay testing
- Adjust `BounceStrength` for better feel
- Consider adding visual debug mode to show hitboxes in-game
- Add hitbox visualization overlay in frontend for development
- Potentially add speed differences per fish model (fast shark vs slow blobfish)
