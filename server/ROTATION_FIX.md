# Fish Rotation Fix - Before and After

## The Problem

Fish images in `client/public/fish-models/` have their **heads pointing LEFT** (180°), but the code was calculating rotation as if they pointed **RIGHT** (0°).

### Visual Representation

```
Fish Image Orientation:
    HEAD ←━━━━━━━━ TAIL
    (180°)        (0°)

Code Expected:
    TAIL ━━━━━━━━→ HEAD
    (0°)          (180°)
```

## What Was Happening (BEFORE FIX)

```
Player presses: W (move up)
Velocity: (0, -100)

Backend calculates:
  rotation = atan2(-100, 0) = -π/2 (-90°)
  
Fish renders with tail pointing up:
         TAIL
          ↑
    HEAD━━╋━━(body)
          
Mouth hitbox placed at tail ❌
```

## What Happens Now (AFTER FIX)

```
Player presses: W (move up)
Velocity: (0, -100)

Backend calculates:
  rotation = atan2(-100, 0) + π = -π/2 + π = π/2 (90°)
  
Fish renders with head pointing up:
         HEAD
          ↑
    (body)━━╋━━TAIL
          
Mouth hitbox placed at head ✅
```

## The Fix

In `server/world.go`:

```go
// BEFORE (WRONG)
if player.Velocity.Length() > 0.1 {
    player.Rotation = math.Atan2(player.Velocity.Y, player.Velocity.X)
}

// AFTER (CORRECT)
if player.Velocity.Length() > 0.1 {
    player.Rotation = math.Atan2(player.Velocity.Y, player.Velocity.X) + math.Pi
}
```

## Why Add π (180°)?

**π radians = 180 degrees**

This rotates the fish by 180°, flipping it from:
- **LEFT-facing** (how the images are drawn) 
- to **RIGHT-facing** (how the code expects)

Then the additional rotation from velocity direction is applied on top of that.

## Movement Examples

### Moving Right →

```
BEFORE FIX:
  ←━━━━━ (backwards, tail first) ❌

AFTER FIX:
  ━━━━━→ (forwards, head first) ✅
```

### Moving Up ↑

```
BEFORE FIX:
    ↑
  TAIL   (tail pointing up) ❌
    ↕
  HEAD

AFTER FIX:
  HEAD   (head pointing up) ✅
    ↕
  TAIL
    ↑
```

### Moving Diagonal ↗

```
BEFORE FIX:
    ⟋
   /  (tail leading) ❌
  ← TAIL
    HEAD

AFTER FIX:
  HEAD → (head leading) ✅
   \
    ⟋
```

## Impact on Hitboxes

### Mouth Hitbox (Eating)

**BEFORE**: Mouth hitbox was placed at the TAIL
```
    ●  ← Mouth hitbox (WRONG!)
    ↕
  ━━━━━ Fish body
    ↕
```

**AFTER**: Mouth hitbox correctly placed at the HEAD
```
  ━━━━━ Fish body
    ↕
    ●  ← Mouth hitbox (CORRECT!)
```

### Body Hitbox (Bouncing)

The body hitbox (oriented rectangle) rotates with the fish, so it's now aligned correctly with the visual appearance.

## Testing

After this fix, you should see:

✅ Fish head leads when you press WASD  
✅ Fish faces the direction it's moving  
✅ You can eat food/other fish from the HEAD, not the tail  
✅ The mouth hitbox is visible at the front of the fish  
✅ All 5 fish species move correctly  

## Why This Happened

The fish images were likely created/exported with heads facing left (standard orientation for many fish sprites), but the physics/rendering code assumed a right-facing default orientation (standard for many game engines).

Adding the 180° offset bridges this mismatch without needing to:
- Re-export all fish images
- Change the frontend rendering code
- Modify the hitbox calculation logic

## Files Changed

- ✏️ `server/world.go` - Added `+ math.Pi` to rotation calculation
- ✏️ `server/HITBOX_IMPLEMENTATION.md` - Updated documentation
- ✏️ `server/PRE_PUSH_CHECKLIST.md` - Added rotation fix to checklist
- ✨ `server/ROTATION_FIX.md` - This file
