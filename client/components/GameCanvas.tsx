'use client';

import { useEffect, useRef, forwardRef } from 'react';
import type { GameStatePayload, FoodState } from '@/types/game';
import { drawFish } from './rendering/drawFish';
import { drawMinimap } from './rendering/drawMinimap';
import { drawLeaderboard } from './rendering/drawLeaderboard';
import { calculateCamera } from './rendering/camera';

interface Props {
    gameState: GameStatePayload | null;
    worldWidth: number;
    worldHeight: number;
}

const GameCanvas = forwardRef<HTMLCanvasElement, Props>(
    function GameCanvas({ gameState, worldWidth, worldHeight }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const animationFrameRef = useRef<number | undefined>(undefined);
        const backgroundImageRef = useRef<HTMLImageElement | null>(null);

        // Preload background image
        useEffect(() => {
            const img = new Image();
            img.src = '/background.jpg';
            img.onload = () => {
                backgroundImageRef.current = img;
            };
        }, []);

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || !gameState) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const render = () => {
                // Clear canvas
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const player = gameState.you;

                // Calculate camera position
                const { cameraX, cameraY } = calculateCamera(
                    player.x,
                    player.y,
                    canvas.width,
                    canvas.height,
                    worldWidth,
                    worldHeight
                );

                // === MAIN GAME VIEW ===
                ctx.save();
                ctx.translate(cameraX, cameraY);

                // Draw background
                if (backgroundImageRef.current) {
                    const pattern = ctx.createPattern(backgroundImageRef.current, 'repeat');
                    if (pattern) {
                        ctx.fillStyle = pattern;
                        ctx.fillRect(0, 0, worldWidth, worldHeight);
                    }
                } else {
                    // Fallback solid color
                    ctx.fillStyle = '#0c4a6e';
                    ctx.fillRect(0, 0, worldWidth, worldHeight);
                }

                // Draw world border
                ctx.strokeStyle = '#ff6b6b';
                ctx.lineWidth = 20;
                ctx.strokeRect(0, 0, worldWidth, worldHeight);

                // Draw food
                gameState.food.forEach((food: FoodState) => {
                    ctx.fillStyle = '#10b981'; // Green food
                    ctx.beginPath();
                    ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Draw other players
                gameState.others.forEach((otherPlayer) => {
                    if (otherPlayer.alive !== false) {
                        drawFish(ctx, otherPlayer, false);
                    }
                });

                // Draw player (on top)
                if (player.alive !== false) {
                    drawFish(ctx, player, true);
                } else {
                    // Player is dead - show death screen
                    ctx.restore();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('You died!', canvas.width / 2, canvas.height / 2 - 20);

                    if (player.respawnIn && player.respawnIn > 0) {
                        ctx.font = '20px Arial';
                        ctx.fillText(
                            `Respawning in ${player.respawnIn.toFixed(1)}s`,
                            canvas.width / 2,
                            canvas.height / 2 + 20
                        );
                    }
                    animationFrameRef.current = requestAnimationFrame(render);
                    return;
                }

                ctx.restore();

                // === UI OVERLAYS ===
                drawMinimap(ctx, gameState, canvas, worldWidth, worldHeight, cameraX, cameraY);
                drawLeaderboard(ctx, gameState, canvas.width, player);

                // Request next frame
                animationFrameRef.current = requestAnimationFrame(render);
            };

            render();

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };
        }, [gameState, worldWidth, worldHeight]);

        return (
            <canvas
                ref={(el) => {
                    canvasRef.current = el;
                    if (typeof ref === 'function') {
                        ref(el);
                    } else if (ref) {
                        ref.current = el;
                    }
                }}
                width={1200}
                height={800}
                className="border-4 border-blue-900 rounded-lg"
            />
        );
    }
);

export default GameCanvas;
