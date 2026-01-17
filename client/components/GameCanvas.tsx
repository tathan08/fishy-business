'use client';

import { useEffect, useRef } from 'react';
import type { GameStatePayload, PlayerState, FoodState } from '@/types/game';

interface Props {
    gameState: GameStatePayload | null;
    worldWidth: number;
    worldHeight: number;
}

export default function GameCanvas({ gameState, worldWidth, worldHeight }: Props) {
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
            // Draw background image if loaded, otherwise use solid color
            if (backgroundImageRef.current) {
                // Draw tiled background
                const pattern = ctx.createPattern(backgroundImageRef.current, 'repeat');
                if (pattern) {
                    ctx.fillStyle = pattern;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            } else {
                // Fallback solid color while image loads
                ctx.fillStyle = '#0c4a6e'; // Deep ocean blue
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Calculate camera position (centered on player)
            const player = gameState.you;
            const cameraX = canvas.width / 2 - player.x;
            const cameraY = canvas.height / 2 - player.y;

            // Save context state
            ctx.save();
            ctx.translate(cameraX, cameraY);

            // Draw food
            gameState.food.forEach((food: FoodState) => {
                ctx.fillStyle = '#10b981'; // Green food
                ctx.beginPath();
                ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw other players
            gameState.others.forEach((otherPlayer: PlayerState) => {
                if (otherPlayer.alive !== false) {
                    drawFish(ctx, otherPlayer, false);
                }
            });

            // Draw player (on top)
            if (player.alive !== false) {
                drawFish(ctx, player, true);
            } else {
                // Player is dead
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
                return;
            }

            ctx.restore();

            // Draw leaderboard
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
            ref={canvasRef}
            width={1200}
            height={800}
            className="border-4 border-blue-900 rounded-lg"
        />
    );
}

function drawFish(
    ctx: CanvasRenderingContext2D,
    fish: PlayerState,
    isPlayer: boolean
) {
    // Fish color
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

    // Draw size/score
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(fish.size.toFixed(0), fish.x, fish.y + 4);
}

function drawLeaderboard(
    ctx: CanvasRenderingContext2D,
    gameState: GameStatePayload,
    canvasWidth: number,
    player: PlayerState
) {
    const padding = 20;
    const lineHeight = 25;
    const startY = padding;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(
        canvasWidth - 220,
        padding,
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
        ctx.fillText(
            `${index + 1}. ${entry.name}`,
            canvasWidth - 210,
            y
        );
        ctx.fillText(
            entry.score.toFixed(0),
            canvasWidth - 50,
            y
        );
    });
}
