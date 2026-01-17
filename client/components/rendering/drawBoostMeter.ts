/**
 * Draw simple stamina bar below the player's fish
 */
export function drawBoostMeter(
    ctx: CanvasRenderingContext2D,
    boostMeter: number,
    isBoosting: boolean,
    fishX: number,
    fishY: number,
    fishSize: number
) {
    const barWidth = fishSize * 1.5; // Bar width scales with fish size
    const barHeight = 6;
    const barX = fishX - barWidth / 2;
    const barY = fishY + fishSize * 0.7 + 10; // Below the fish

    // Background (dark)
    ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Stamina fill
    const fillWidth = (boostMeter / 100) * barWidth;
    if (boostMeter > 30) {
        ctx.fillStyle = isBoosting ? '#3b82f6' : '#10b981'; // Blue when boosting, green otherwise
    } else if (boostMeter > 0) {
        ctx.fillStyle = '#eab308'; // Yellow when low
    } else {
        ctx.fillStyle = '#ef4444'; // Red when empty
    }
    ctx.fillRect(barX, barY, fillWidth, barHeight);
}
