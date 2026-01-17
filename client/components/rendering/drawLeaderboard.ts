import type { GameStatePayload, PlayerState } from '@/types/game';

/**
 * Draw leaderboard in top-right corner (below minimap)
 */
export function drawLeaderboard(
    ctx: CanvasRenderingContext2D,
    gameState: GameStatePayload,
    canvasWidth: number,
    player: PlayerState
) {
    const padding = 20;
    const lineHeight = 25;
    const startY = 240; // Below minimap

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(
        canvasWidth - 220,
        startY,
        200,
        lineHeight * (gameState.leaderboard.length + 2) + 10
    );

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Leaderboard', canvasWidth - 210, startY + 20);

    // Leaderboard entries
    ctx.font = '14px Arial';
    gameState.leaderboard.forEach((entry, index) => {
        const y = startY + 50 + index * lineHeight;
        const isCurrentPlayer = entry.name === player.name;

        ctx.fillStyle = isCurrentPlayer ? '#fbbf24' : '#ffffff';
        ctx.fillText(`${index + 1}. ${entry.name}`, canvasWidth - 210, y);
        ctx.fillText(entry.score.toFixed(0), canvasWidth - 50, y);
    });
}
