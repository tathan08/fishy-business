/**
 * Draw kill feed on the canvas - shows top 3 kills below leaderboard, fades after 10 seconds
 */
export function drawKillFeed(
    ctx: CanvasRenderingContext2D,
    killFeed: Array<{ message: string; timestamp: number }>,
    canvasWidth: number,
    leaderboardLength: number
) {
    // Position below leaderboard (leaderboard starts at 240, each entry is 25px)
    const leaderboardHeight = 50 + (leaderboardLength * 25) + 10; // title + entries + padding
    const startY = 240 + leaderboardHeight + 10; // 10px gap below leaderboard

    const now = Date.now();

    // Only show max 3 kills with fade effect
    killFeed.slice(0, 3).forEach((kill, index) => {
        const age = (now - kill.timestamp) / 10000; // 0 to 1 over 10 seconds
        const alpha = Math.max(0, 1 - age);

        const y = startY + (index * 32);

        // Translucent background with fade
        ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * alpha})`;
        ctx.fillRect(canvasWidth - 330, y, 320, 28);

        // Kill message text with fade
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`💀 ${kill.message}`, canvasWidth - 320, y + 18);
    });
}
