import type { PlayerState, FishModel } from '@/types/game';

/**
 * Draw a fish on the canvas with model-specific appearance
 */
export function drawFish(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    isPlayer: boolean
) {
    const model = fish.model || 'swordfish';
    
    // Save context
    ctx.save();

    // Draw based on model type
    switch (model) {
        case 'swordfish':
            drawSwordfish(ctx, fish, isPlayer);
            break;
        case 'blobfish':
            drawBlobfish(ctx, fish, isPlayer);
            break;
        case 'pufferfish':
            drawPufferfish(ctx, fish, isPlayer);
            break;
        case 'shark':
            drawShark(ctx, fish, isPlayer);
            break;
        case 'sacabambaspis':
            drawSacabambaspis(ctx, fish, isPlayer);
            break;
        default:
            drawDefaultFish(ctx, fish, isPlayer);
    }

    ctx.restore();

    // Draw username above fish
    ctx.fillStyle = isPlayer ? '#fbbf24' : '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(fish.name || 'Unknown', fish.x, fish.y - fish.size - 10);

    // Draw size indicator
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(fish.size.toFixed(0), fish.x, fish.y + 4);
}

function drawSwordfish(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    const baseColor = isPlayer ? '#fbbf24' : '#4682B4'; // Yellow or steel blue
    const size = fish.size;

    // Body (elongated ellipse)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(fish.x, fish.y, size * 1.2, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sword (long pointed nose)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(fish.x + size * 1.2, fish.y);
    ctx.lineTo(fish.x + size * 2, fish.y - 3);
    ctx.lineTo(fish.x + size * 2, fish.y + 3);
    ctx.closePath();
    ctx.fill();

    // Dorsal fin
    ctx.beginPath();
    ctx.moveTo(fish.x, fish.y - size * 0.6);
    ctx.lineTo(fish.x - size * 0.3, fish.y - size);
    ctx.lineTo(fish.x + size * 0.3, fish.y - size * 0.6);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.6, fish.y - size * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawBlobfish(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    const baseColor = isPlayer ? '#fbbf24' : '#FFB6C1'; // Yellow or pink
    const size = fish.size;

    // Droopy blob body
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(fish.x, fish.y, size, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Droopy nose
    ctx.beginPath();
    ctx.ellipse(fish.x + size * 0.7, fish.y, size * 0.4, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sad eyes
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.2, fish.y - size * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.2, fish.y + size * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Sad mouth
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.5, fish.y + size * 0.5, size * 0.3, 0.2, Math.PI - 0.2);
    ctx.stroke();
}

function drawPufferfish(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    const baseColor = isPlayer ? '#fbbf24' : '#FFA500'; // Yellow or orange
    const size = fish.size;

    // Round body
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(fish.x, fish.y, size, 0, Math.PI * 2);
    ctx.fill();

    // Spikes around the body
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 3;
    const spikeCount = 12;
    for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const startX = fish.x + Math.cos(angle) * size;
        const startY = fish.y + Math.sin(angle) * size;
        const endX = fish.x + Math.cos(angle) * (size + 8);
        const endY = fish.y + Math.sin(angle) * (size + 8);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.4, fish.y - size * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.4, fish.y + size * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawShark(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    const baseColor = isPlayer ? '#fbbf24' : '#708090'; // Yellow or slate gray
    const size = fish.size;

    // Body (streamlined)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(fish.x, fish.y, size * 1.5, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed head
    ctx.beginPath();
    ctx.moveTo(fish.x + size * 1.5, fish.y);
    ctx.lineTo(fish.x + size * 2, fish.y - size * 0.3);
    ctx.lineTo(fish.x + size * 2, fish.y + size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Dorsal fin (triangular)
    ctx.beginPath();
    ctx.moveTo(fish.x - size * 0.3, fish.y - size * 0.7);
    ctx.lineTo(fish.x - size * 0.5, fish.y - size * 1.3);
    ctx.lineTo(fish.x + size * 0.3, fish.y - size * 0.7);
    ctx.closePath();
    ctx.fill();

    // Tail fin
    ctx.beginPath();
    ctx.moveTo(fish.x - size * 1.5, fish.y);
    ctx.lineTo(fish.x - size * 2, fish.y - size * 0.6);
    ctx.lineTo(fish.x - size * 2, fish.y + size * 0.6);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.8, fish.y - size * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawSacabambaspis(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    const baseColor = isPlayer ? '#fbbf24' : '#8B7355'; // Yellow or brown
    const size = fish.size;

    // Flat armored body
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(fish.x, fish.y, size * 1.1, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head shield (wider front)
    ctx.beginPath();
    ctx.ellipse(fish.x + size * 0.5, fish.y, size * 0.7, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes on top (distinctive feature)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.7, fish.y - size * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fish.x + size * 0.7, fish.y + size * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (forward-facing)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fish.x + size * 1.2, fish.y, size * 0.2, Math.PI * 0.3, Math.PI * 1.7);
    ctx.stroke();
}

function drawDefaultFish(ctx: CanvasRenderingContext2D, fish: PlayerState, isPlayer: boolean) {
    // Fallback to simple circle
    ctx.fillStyle = isPlayer ? '#fbbf24' : '#60a5fa';
    ctx.beginPath();
    ctx.arc(fish.x, fish.y, fish.size, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + fish.size / 3, fish.y - fish.size / 4, 3, 0, Math.PI * 2);
    ctx.fill();
}
