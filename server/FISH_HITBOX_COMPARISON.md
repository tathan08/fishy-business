# Fish Hitbox Visual Comparison

This document explains why each fish has different hitbox ratios.

## Visual Shape Analysis

### 🗡️ Swordfish (3.5:0.8 ratio)
```
     (Mouth)
        ↓
    ━━━━●━━━━━━━━━━━━━━━━━━━○━━━━━►  ← Long sword extends far forward
        ↑                      ↑
      Body                   Tail
   (sleek & thin)
```
- **Long pointed sword/bill** extending ~80% forward
- **Very elongated** body (4:1 aspect ratio)
- **Mouth far forward** to match sword tip
- Config: Width 3.5x, Height 0.8x, Mouth offset 1.8x

---

### 🦈 Shark (3.0:0.9 ratio)
```
        (Mouth)
          ↓
       ━━━●━━━━━━━━━━━○━━━►  ← Streamlined predator
          ↑            ↑
    Large mouth      Tail
```
- **Streamlined predator** shape
- **Large mouth** for attacking (35% size)
- **Elongated but sleek** (3:1 aspect ratio)
- Config: Width 3.0x, Height 0.9x, Mouth offset 1.4x

---

### 🐟 Sacabambaspis (2.5:1.0 ratio) - DEFAULT
```
      (Mouth)
        ↓
      ━●━━━━━━○━►  ← Balanced prehistoric fish
       ↑      ↑
     Mouth  Tail
```
- **Elongated oval** shape (2.5:1 aspect ratio)
- **Balanced proportions** - default hitbox
- **Standard mouth** positioning
- Config: Width 2.5x, Height 1.0x, Mouth offset 1.2x

---

### 🫧 Blobfish (2.2:1.3 ratio)
```
        (Mouth)
          ↓
      ╔═══●═══╗
      ║  ○○   ║  ← Wide, blobby, and tall
      ║       ║
      ╚═══════╝
```
- **Wide and blobby** appearance
- **Flattened but tall** (shorter than wide)
- **Large droopy mouth** (35% size)
- **Not very streamlined** - more square-ish
- Config: Width 2.2x, Height 1.3x, Mouth offset 1.0x

---

### 🐡 Pufferfish (1.2:1.2 ratio)
```
       (Mouth)
         ↓
      ╔══●══╗
      ║  ○  ║  ← Nearly perfect sphere
      ╚═════╝
```
- **Nearly circular** when puffed (1:1 aspect ratio)
- **Small round mouth** at front
- **Equal width and height** - spherical hitbox
- **Shortest forward reach** - mouth close to center
- Config: Width 1.2x, Height 1.2x, Mouth offset 0.6x

---

## Hitbox Size Comparison (at size 20)

| Fish | Body Width | Body Height | Mouth Radius | Mouth Reach | Shape |
|------|------------|-------------|--------------|-------------|-------|
| Swordfish | 70 | 16 | 5 | 36 forward | ━━━━━━━━━━► |
| Shark | 60 | 18 | 7 | 28 forward | ━━━━━► |
| Sacabambaspis | 50 | 20 | 6 | 24 forward | ━━━► (default) |
| Blobfish | 44 | 26 | 7 | 20 forward | ▬▬▬ |
| Pufferfish | 24 | 24 | 6 | 12 forward | ● (sphere) |

## Gameplay Implications

### Advantages by Fish Type

**Swordfish**
- ✅ Longest forward reach for eating
- ✅ Easiest to hit targets in front
- ❌ Thin body is vulnerable from sides
- ❌ Hard to maneuver in tight spaces

**Shark**
- ✅ Great balance of reach and size
- ✅ Large mouth hitbox (35%)
- ✅ Streamlined for pursuit
- ➖ Standard predator advantages

**Sacabambaspis**
- ➖ Balanced all-around
- ➖ No particular advantage or disadvantage
- ✅ Good starter fish

**Blobfish**
- ✅ Wider body for blocking
- ✅ Taller profile for vertical space
- ❌ Shorter reach
- ➖ Slow/defensive playstyle

**Pufferfish**
- ✅ Smallest target (circular)
- ✅ Hard to hit from any angle
- ❌ Shortest eating reach
- ❌ Must get very close to eat

## Balancing Philosophy

1. **Shape follows form**: Hitbox matches visual appearance
2. **Trade-offs**: Long reach = thin body (vulnerable)
3. **No strictly better option**: Each fish has pros/cons
4. **Skill expression**: Different fish reward different playstyles
5. **Visual clarity**: What you see is what you get

## Testing Checklist

- [ ] Swordfish can eat from sword tip distance
- [ ] Pufferfish must get close to eat (shortest reach)
- [ ] Blobfish body is wider than swordfish body
- [ ] Shark has largest mouth hitbox (35%)
- [ ] All fish bounce appropriately off each other
- [ ] Hitboxes cap at MaxPlayerSize (200)
