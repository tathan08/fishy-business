/**
 * Calculate camera position that follows player but stays within world bounds
 */
export function calculateCamera(
    playerX: number,
    playerY: number,
    canvasWidth: number,
    canvasHeight: number,
    worldWidth: number,
    worldHeight: number
): { cameraX: number; cameraY: number } {
    // Center camera on player
    let cameraX = canvasWidth / 2 - playerX;
    let cameraY = canvasHeight / 2 - playerY;

    // Constrain camera to world boundaries
    const minX = canvasWidth - worldWidth;
    const minY = canvasHeight - worldHeight;

    // Keep camera within bounds
    cameraX = Math.min(0, Math.max(minX, cameraX));
    cameraY = Math.min(0, Math.max(minY, cameraY));

    return { cameraX, cameraY };
}
