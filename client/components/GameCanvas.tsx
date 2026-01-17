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
        const previousStateRef = useRef<GameStatePayload | null>(null);
        const lastUpdateTimeRef = useRef<number>(Date.now());
        const lastFrameTimeRef = useRef<number>(0);
        const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
        const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

        // Create offscreen canvas with gradient background (much faster than image)
        useEffect(() => {
            // Create offscreen canvas for background
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = worldWidth;
            offscreenCanvas.height = worldHeight;
            const offscreenCtx = offscreenCanvas.getContext('2d');

            if (offscreenCtx) {
                // Draw ocean gradient background (top to bottom)
                const gradient = offscreenCtx.createLinearGradient(0, 0, 0, worldHeight);
                gradient.addColorStop(0, '#0a2463');    // Deep blue top
                gradient.addColorStop(0.5, '#1e3a5f');  // Mid blue
                gradient.addColorStop(1, '#0c2340');    // Dark blue bottom
                offscreenCtx.fillStyle = gradient;
                offscreenCtx.fillRect(0, 0, worldWidth, worldHeight);

                // Draw world border on offscreen canvas
                offscreenCtx.strokeStyle = '#ff6b6b';
                offscreenCtx.lineWidth = 20;
                offscreenCtx.strokeRect(0, 0, worldWidth, worldHeight);

                offscreenCanvasRef.current = offscreenCanvas;
                offscreenCtxRef.current = offscreenCtx;
            }
        }, [worldWidth, worldHeight]);

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || !gameState) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Store current state and update time
            if (previousStateRef.current === null ||
                previousStateRef.current.you.seq !== gameState.you.seq) {
                previousStateRef.current = gameState;
                lastUpdateTimeRef.current = Date.now();
            }

            const render = (currentTime: number) => {
                // Frame rate limiting (60 FPS)
                const targetFPS = 60;
                const frameInterval = 1000 / targetFPS;

                if (currentTime - lastFrameTimeRef.current < frameInterval) {
                    animationFrameRef.current = requestAnimationFrame(render);
                    return;
                }
                lastFrameTimeRef.current = currentTime;

                // Motion blur effect - semi-transparent fade instead of hard clear
                // This creates smooth trails that mask lag
                ctx.fillStyle = 'rgba(26, 26, 46, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Interpolate between updates for smoother rendering
                const now = Date.now();
                const timeSinceUpdate = (now - lastUpdateTimeRef.current) / 1000;

                // Cap interpolation to expected update interval (67ms for 15Hz)
                const maxInterpolationTime = 0.067; // 67ms
                const cappedTime = Math.min(timeSinceUpdate, maxInterpolationTime);

                const interpolatePlayer = (current: any) => {
                    return {
                        ...current,
                        x: current.x + current.velX * cappedTime,
                        y: current.y + current.velY * cappedTime,
                    };
                };

                const player = interpolatePlayer(gameState.you);

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

                // Draw pre-rendered background from offscreen canvas
                if (offscreenCanvasRef.current) {
                    ctx.drawImage(offscreenCanvasRef.current, 0, 0);
                } else {
                    // Fallback: Draw gradient if offscreen canvas not ready
                    const gradient = ctx.createLinearGradient(0, 0, 0, worldHeight);
                    gradient.addColorStop(0, '#0a2463');
                    gradient.addColorStop(0.5, '#1e3a5f');
                    gradient.addColorStop(1, '#0c2340');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, worldWidth, worldHeight);

                    // Draw world border
                    ctx.strokeStyle = '#ff6b6b';
                    ctx.lineWidth = 20;
                    ctx.strokeRect(0, 0, worldWidth, worldHeight);
                }

                // Draw food (only within viewport + margin)
                const viewportMargin = 100;
                const viewportLeft = player.x - canvas.width / 2 - viewportMargin;
                const viewportRight = player.x + canvas.width / 2 + viewportMargin;
                const viewportTop = player.y - canvas.height / 2 - viewportMargin;
                const viewportBottom = player.y + canvas.height / 2 + viewportMargin;

                gameState.food.forEach((food: FoodState) => {
                    // Only render food within viewport
                    if (food.x >= viewportLeft && food.x <= viewportRight &&
                        food.y >= viewportTop && food.y <= viewportBottom) {
                        ctx.fillStyle = '#10b981'; // Green food
                        ctx.beginPath();
                        ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // Draw other players (interpolated)
                gameState.others.forEach((otherPlayer) => {
                    if (otherPlayer.alive !== false) {
                        const interpolated = interpolatePlayer(otherPlayer);
                        drawFish(ctx, interpolated, false);
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

            render(performance.now());

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
