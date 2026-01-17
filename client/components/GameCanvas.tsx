'use client';

import { useEffect, useRef, forwardRef, useState } from 'react';
import type { GameStatePayload, FoodState } from '@/types/game';
import { drawFish } from './rendering/drawFish';
import { drawMinimap } from './rendering/drawMinimap';
import { drawLeaderboard } from './rendering/drawLeaderboard';
import { drawKillFeed } from './rendering/drawKillFeed';
import { calculateCamera } from './rendering/camera';

interface Props {
    gameState: GameStatePayload | null;
    worldWidth: number;
    worldHeight: number;
}

// Random death messages for entertainment
const DEATH_MESSAGES = [
    "You got outswum 💀",
    "Skill issue tbh",
    "L + ratio + you're fish food",
    "Respawning your dignity...",
    "That was embarrassing",
    "Maybe try the pufferfish?",
    "💀💀💀",
    "Git gud",
    "Not your finest moment",
    "Bruh moment",
    "Rip bozo",
    "Outplayed fr fr",
    "They don't miss 🎯",
    "Sadge",
    "Touch grass... or seaweed",
];

// Funny kill message templates
const KILL_MESSAGES = [
    "{killer} obliterated {victim}",
    "{killer} ate {victim} for breakfast",
    "{killer} sent {victim} to the shadow realm",
    "{killer} absolutely destroyed {victim}",
    "{killer} turned {victim} into sushi",
    "{victim} got devoured by {killer}",
    "{killer} said 'nom nom' to {victim}",
    "{victim} became fish food (thanks {killer})",
    "{victim} got ratio'd by {killer}",
    "{killer} cooked {victim}",
    "{victim} lost to {killer} (skill issue)",
    "{killer} hunted {victim} down",
    "{victim} underestimated {killer}",
    "{killer} showed {victim} who's boss",
];

const GameCanvas = forwardRef<HTMLCanvasElement, Props>(
    function GameCanvas({ gameState, worldWidth, worldHeight }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const animationFrameRef = useRef<number | undefined>(undefined);
        const previousStateRef = useRef<GameStatePayload | null>(null);
        const lastUpdateTimeRef = useRef<number>(Date.now());
        const lastFrameTimeRef = useRef<number>(0);
        const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
        const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
        const deathMessageRef = useRef<string>('');
        const wasAliveRef = useRef<boolean>(true);

        // Kill feed state
        const [killFeed, setKillFeed] = useState<Array<{
            id: number;
            message: string;
            timestamp: number;
        }>>([]);

        // Track other players to detect who you killed
        const previousOthersRef = useRef<Array<any>>([]);
        const lastKillTimeRef = useRef<number>(0);
        const lastDeathTimeRef = useRef<number>(0);

        // Create offscreen canvas with background image
        useEffect(() => {
            // Create offscreen canvas for background
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = worldWidth;
            offscreenCanvas.height = worldHeight;
            const offscreenCtx = offscreenCanvas.getContext('2d');

            if (offscreenCtx) {
                // Load and draw background image
                const img = new Image();
                img.onload = () => {
                    offscreenCtx.drawImage(img, 0, 0, worldWidth, worldHeight);

                    // Draw world border on offscreen canvas
                    offscreenCtx.strokeStyle = '#ff6b6b';
                    offscreenCtx.lineWidth = 20;
                    offscreenCtx.strokeRect(0, 0, worldWidth, worldHeight);

                    offscreenCanvasRef.current = offscreenCanvas;
                    offscreenCtxRef.current = offscreenCtx;
                };
                img.src = '/background.jpg';
            }
        }, [worldWidth, worldHeight]);

        // Detect kills and add to kill feed (only once per kill)
        useEffect(() => {
            if (!gameState || !gameState.you) return;

            const now = Date.now();

            // Check if YOU killed someone (score increased by 100+)
            // Only trigger if at least 500ms passed since last kill message (prevent spam)
            if (previousStateRef.current?.you.score !== undefined &&
                gameState.you.score !== undefined &&
                now - lastKillTimeRef.current > 500) {

                const scoreDiff = gameState.you.score - previousStateRef.current.you.score;
                if (scoreDiff >= 100) {
                    // Find who disappeared from the others list (who you killed)
                    let victimName = 'someone';
                    if (previousOthersRef.current) {
                        const previousIds = new Set(previousOthersRef.current.map(p => p.id));
                        const currentIds = new Set(gameState.others.map(p => p.id));

                        // Find who was in previous but not in current (they died)
                        previousOthersRef.current.forEach(player => {
                            if (!currentIds.has(player.id) && player.name) {
                                victimName = player.name;
                            }
                        });
                    }

                    const randomMsg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)]
                        .replace('{killer}', 'You')
                        .replace('{victim}', victimName);

                    setKillFeed(prev => [
                        { id: now, message: randomMsg, timestamp: now },
                        ...prev.slice(0, 2) // Keep only 3 total (new one + 2 old)
                    ]);

                    lastKillTimeRef.current = now; // Prevent duplicate messages
                }
            }

            // Check if YOU died
            // Only trigger if at least 500ms passed since last death message (prevent spam)
            if (gameState.you.alive === false &&
                gameState.you.killedBy &&
                previousStateRef.current?.you.alive !== false &&
                now - lastDeathTimeRef.current > 500) {

                const randomMsg = KILL_MESSAGES[Math.floor(Math.random() * KILL_MESSAGES.length)]
                    .replace('{killer}', gameState.you.killedBy)
                    .replace('{victim}', 'You');

                setKillFeed(prev => [
                    { id: now, message: randomMsg, timestamp: now },
                    ...prev.slice(0, 2) // Keep only 3 total
                ]);

                lastDeathTimeRef.current = now; // Prevent duplicate messages
            }

            // Update previous others for next comparison
            previousOthersRef.current = gameState.others;
        }, [gameState?.you?.score, gameState?.you?.alive, gameState?.you?.killedBy, gameState?.others]);

        // Auto-remove kills after 10 seconds
        useEffect(() => {
            const interval = setInterval(() => {
                const now = Date.now();
                setKillFeed(prev => prev.filter(kill => now - kill.timestamp < 10000)); // 10 seconds
            }, 1000);

            return () => clearInterval(interval);
        }, []);

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

                // Clear canvas (solid color for better performance)
                ctx.fillStyle = '#1a1a2e';
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

                // Set food color once for better performance
                ctx.fillStyle = '#10b981';
                gameState.food.forEach((food: FoodState) => {
                    // Only render food within viewport
                    if (food.x >= viewportLeft && food.x <= viewportRight &&
                        food.y >= viewportTop && food.y <= viewportBottom) {
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
                    wasAliveRef.current = true; // Track that player was alive
                } else {
                    // Player just died - pick new random message
                    if (wasAliveRef.current) {
                        deathMessageRef.current = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];
                        wasAliveRef.current = false;
                    }

                    // Player is dead - show death screen with same message
                    ctx.restore();

                    // Display death message (stays same until respawn)
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(deathMessageRef.current, canvas.width / 2, canvas.height / 2 - 40);

                    // Show who killed you if available
                    if (player.killedBy) {
                        ctx.font = '18px Arial';
                        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
                        ctx.fillText(`Killed by: ${player.killedBy}`, canvas.width / 2, canvas.height / 2 - 5);
                    }

                    // Show respawn timer
                    if (player.respawnIn && player.respawnIn > 0) {
                        ctx.font = '20px Arial';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fillText(
                            `Respawning in ${player.respawnIn.toFixed(1)}s`,
                            canvas.width / 2,
                            canvas.height / 2 + 30
                        );
                    }

                    animationFrameRef.current = requestAnimationFrame(render);
                    return;
                }

                ctx.restore();

                // === UI OVERLAYS ===
                drawMinimap(ctx, gameState, canvas, worldWidth, worldHeight, cameraX, cameraY);
                drawLeaderboard(ctx, gameState, canvas.width, player);
                drawKillFeed(ctx, killFeed, canvas.width, gameState.leaderboard.length);

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
