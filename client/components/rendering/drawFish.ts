import type { PlayerState } from '@/types/game';

/**
 * Draw a fish on the canvas
 */
export function drawFish(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    isPlayer: boolean
) {
    // Fish body color
    ctx.fillStyle = isPlayer ? '#fbbf24' : '#60a5fa'; // Yellow for player, blue for others

    // Draw fish body (circle)
    ctx.beginPath();
    ctx.arc(fish.x, fish.y, fish.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(fish.x + fish.size / 3, fish.y - fish.size / 4, 3, 0, Math.PI * 2);
    ctx.fill();

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
