import type { GameStatePayload, PlayerState } from '@/types/game';

/**
 * Draw minimap in top-right corner
 */
export function drawMinimap(
    ctx: CanvasRenderingContext2D,
    gameState: GameStatePayload,
    canvas: HTMLCanvasElement,
    worldWidth: number,
    worldHeight: number,
    cameraX: number,
    cameraY: number
) {
    const minimapSize = 200;
    const minimapX = canvas.width - minimapSize - 20;
    const minimapY = 20;
    const scale = minimapSize / Math.max(worldWidth, worldHeight);

    // Minimap background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);

    // Minimap border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);

    // Save context and scale for minimap
    ctx.save();
    ctx.translate(minimapX, minimapY);
    ctx.scale(scale, scale);

    // Draw world boundary on minimap
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, worldWidth, worldHeight);

    // Draw other players as small dots
    gameState.others.forEach((other: PlayerState) => {
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(other.x, other.y, 20, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw player (bigger, yellow)
    const player = gameState.you;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
    ctx.fill();

    // Draw viewport rectangle (shows what camera sees)
    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    const viewportX = -cameraX;
    const viewportY = -cameraY;

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 15;
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

    ctx.restore();

    // Minimap label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', minimapX + minimapSize / 2, minimapY - 5);
}
