import type { PlayerState, FishModel } from '@/types/game';

// Cache for loaded fish model images
const imageCache: Record<string, HTMLImageElement | null> = {};
const imageLoadAttempts: Record<string, boolean> = {};

// Hitbox configurations matching server (for debugging visualization)
const HITBOX_CONFIGS = {
    swordfish: {
        bodyWidthRatio: 1.3,
        bodyHeightRatio: 0.6,
        mouthSizeRatio: 0.25,
        mouthOffsetRatio: 0.6,
    },
    blobfish: {
        bodyWidthRatio: 1.3,
        bodyHeightRatio: 0.8,
        mouthSizeRatio: 0.35,
        mouthOffsetRatio: 0.6,
    },
    pufferfish: {
        bodyWidthRatio: 1.1,
        bodyHeightRatio: 1.2,
        mouthSizeRatio: 0.625,
        mouthOffsetRatio: 0.25,
    },
    shark: {
        bodyWidthRatio: 1.8,
        bodyHeightRatio: 0.9,
        mouthSizeRatio: 0.5,
        mouthOffsetRatio: 0.9,
    },
    sacabambaspis: {
        bodyWidthRatio: 2.0,
        bodyHeightRatio: 1.0,
        mouthSizeRatio: 0.4,
        mouthOffsetRatio: 0.9,
    },
};

const DEFAULT_HITBOX = {
    bodyWidthRatio: 2.5,
    bodyHeightRatio: 1.0,
    mouthSizeRatio: 0.3,
    mouthOffsetRatio: 1.2,
};

// Debug flag - set to true to see hitboxes
const DEBUG_HITBOXES = true;

/**
 * Draw powerup effects for active powerups
 */
function drawPowerupEffect(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    model: FishModel,
    angle: number
) {
    const size = fish.size;

    switch (model) {
        case 'swordfish':
            // Range increase - show red aura around mouth
            ctx.save();
            ctx.translate(fish.x, fish.y);
            ctx.rotate(angle);
            
            const config = HITBOX_CONFIGS.swordfish;
            const mouthRadius = size * config.mouthSizeRatio * 2.0; // Match server: 2x radius
            const mouthOffset = size * config.mouthOffsetRatio * 1.5; // Match server: 1.5x offset
            
            // Draw multiple rings for emphasis
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
            
            // Outer ring
            ctx.strokeStyle = '#ff000044';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(-mouthOffset, 0, mouthRadius * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner ring
            ctx.strokeStyle = '#ff000088';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(-mouthOffset, 0, mouthRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
            break;

        case 'blobfish':
            // Invulnerability - golden shield effect
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffd700';
            ctx.strokeStyle = '#ffd70088';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(fish.x, fish.y, size * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;

        case 'pufferfish':
            // Size increase - pulsing red outline
            ctx.save();
            const pulse = Math.sin(Date.now() / 200) * 0.2 + 1;
            ctx.shadowBlur = 15 * pulse;
            ctx.shadowColor = '#ff0000';
            ctx.strokeStyle = '#ff000066';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(fish.x, fish.y, size * 1.3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;

        case 'shark':
            // Vision powerup - scanning rings
            ctx.save();
            const scanTime = (Date.now() % 2000) / 2000;
            const scanRadius = size * (1 + scanTime * 3);
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - scanTime})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(fish.x, fish.y, scanRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            break;

        case 'sacabambaspis':
            // Ball form - draw 10 copies in a circle
            ctx.save();
            for (let i = 0; i < 10; i++) {
                const copyAngle = (i / 10) * Math.PI * 2;
                const copyX = fish.x + Math.cos(copyAngle) * size * 1.5;
                const copyY = fish.y + Math.sin(copyAngle) * size * 1.5;
                
                ctx.globalAlpha = 0.5;
                ctx.translate(copyX, copyY);
                ctx.rotate(copyAngle + Math.PI / 2);
                
                // Draw small version
                const img = loadFishImage(model);
                if (img && img.complete && img.naturalHeight !== 0) {
                    const imgSize = size * 1.2;
                    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                }
                
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            }
            ctx.restore();
            break;
    }
}

/**
 * Preload a fish model image
 */
function loadFishImage(model: FishModel): HTMLImageElement | null {
    if (imageCache[model]) {
        return imageCache[model];
    }

    if (imageLoadAttempts[model]) {
        return null; // Already tried to load, failed
    }

    imageLoadAttempts[model] = true;
    const img = new Image();
    img.src = `/fish-models/${model}.png`;

    img.onload = () => {
        imageCache[model] = img;
    };

    img.onerror = () => {
        imageCache[model] = null;
    };

    return null;
}

/**
 * Draw a fish on the canvas with model-specific appearance
 */
export function drawFish(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    isPlayer: boolean
) {
    const model = (fish.model || 'swordfish') as FishModel;
    const size = fish.size;

    // Use rotation from backend if available, otherwise calculate from velocity
    let angle = 0;
    if (fish.rotation !== undefined) {
        // Add 180° because fish images point LEFT, but backend rotation assumes RIGHT
        angle = fish.rotation + Math.PI;
    } else if (fish.velX !== undefined && fish.velY !== undefined) {
        const speed = Math.sqrt(fish.velX * fish.velX + fish.velY * fish.velY);
        if (speed > 0.1) {
            // Add 180° for left-facing fish images
            angle = Math.atan2(fish.velY, fish.velX) + Math.PI;
        }
    }

    // Draw powerup effects if active
    if (fish.powerupActive) {
        drawPowerupEffect(ctx, fish, model, angle);
    }

    // Try to load/get the image
    const img = loadFishImage(model);

    ctx.save();

    // Translate to fish position and rotate
    ctx.translate(fish.x, fish.y);
    ctx.rotate(angle);

    // Draw the fish image or fallback to shape
    if (img && img.complete && img.naturalHeight !== 0) {
        // Draw the image
        const imgSize = size * 2.5; // Make image slightly larger than circle would be

        // Apply transparency for player vs others
        if (isPlayer) {
            ctx.globalAlpha = 1;
            // No filter - better performance!
        } else {
            ctx.globalAlpha = 0.85;
        }

        ctx.drawImage(
            img,
            -imgSize / 2,
            -imgSize / 2,
            imgSize,
            imgSize
        );
    } else {
        // Fallback to drawn shapes
        drawFishShape(ctx, size, isPlayer, model);
    }

    // Draw debug hitboxes
    drawDebugHitboxes(ctx, fish, angle);

    ctx.restore();

    // Draw username above fish (not rotated)
    ctx.fillStyle = isPlayer ? '#fbbf24' : '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(fish.name || 'Unknown', fish.x, fish.y - size - 10);

    // Draw size indicator (not rotated)
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(size.toFixed(0), fish.x, fish.y + 4);
}

function drawFishShape(
    ctx: CanvasRenderingContext2D,
    size: number,
    isPlayer: boolean,
    model: FishModel
) {
    const baseColor = isPlayer ? '#fbbf24' : '#60a5fa';

    // Simple fish shape as fallback (drawn at origin, will be rotated by parent)
    ctx.fillStyle = baseColor;
    ctx.beginPath();

    // Basic fish body
    ctx.ellipse(0, 0, size * 1.2, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-size * 1.2, 0);
    ctx.lineTo(-size * 1.8, -size * 0.6);
    ctx.lineTo(-size * 1.8, size * 0.6);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw debug hitboxes for the fish
 */
function drawDebugHitboxes(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    angle: number
) {
    if (!DEBUG_HITBOXES) return;

    const model = (fish.model || 'swordfish') as FishModel;
    const config = HITBOX_CONFIGS[model] || DEFAULT_HITBOX;
    const size = Math.min(fish.size, 200); // Cap at MaxPlayerSize

    // Body hitbox (oriented rectangle) - drawn in rotated context
    const bodyWidth = size * config.bodyWidthRatio;
    const bodyHeight = size * config.bodyHeightRatio;

    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);

    // Mouth hitbox (circle) - drawn in rotated context
    const mouthRadius = size * config.mouthSizeRatio;
    const mouthOffset = size * config.mouthOffsetRatio;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Negate offset because fish images are flipped 180°
    ctx.arc(-mouthOffset, 0, mouthRadius, 0, Math.PI * 2);
    ctx.stroke();
}
