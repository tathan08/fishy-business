import type { PlayerState, FishModel } from '@/types/game';

// Cache for loaded fish model images
const imageCache: Record<string, HTMLImageElement | null> = {};
const imageLoadAttempts: Record<string, boolean> = {};

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
    
    // Try to load/get the image
    const img = loadFishImage(model);
    
    ctx.save();

    // Draw the fish image or fallback to shape
    if (img && img.complete && img.naturalHeight !== 0) {
        // Draw the image
        const imgSize = size * 2.5; // Make image slightly larger than circle would be
        
        // Apply color tint for player vs others
        if (isPlayer) {
            ctx.globalAlpha = 1;
            // Draw with yellow tint for player
            ctx.filter = 'brightness(1.2) sepia(0.3) hue-rotate(-10deg)';
        } else {
            ctx.globalAlpha = 0.9;
        }
        
        ctx.drawImage(
            img,
            fish.x - imgSize / 2,
            fish.y - imgSize / 2,
            imgSize,
            imgSize
        );
    } else {
        // Fallback to drawn shapes
        drawFishShape(ctx, fish, isPlayer, model);
    }

    ctx.restore();

    // Draw username above fish
    ctx.fillStyle = isPlayer ? '#fbbf24' : '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(fish.name || 'Unknown', fish.x, fish.y - size - 10);

    // Draw size indicator
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(size.toFixed(0), fish.x, fish.y + 4);
}

function drawFishShape(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    isPlayer: boolean,
    model: FishModel
) {
    const size = fish.size;
    const baseColor = isPlayer ? '#fbbf24' : '#60a5fa';

    // Simple fish shape as fallback
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    
    // Basic fish body
    ctx.ellipse(fish.x, fish.y, size * 1.2, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(fish.x - size * 1.2, fish.y);
    ctx.lineTo(fish.x - size * 1.8, fish.y - size * 0.6);
    ctx.lineTo(fish.x - size * 1.8, fish.y + size * 0.6);
    ctx.closePath();
    ctx.fill();
    
    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.5, fish.y - size * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
}
