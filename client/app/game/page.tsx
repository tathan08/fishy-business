'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GameConnection } from '@/lib/connection';
import { InputHandler } from '@/lib/input';
import GameCanvas from '@/components/GameCanvas';
import LoadingScreen from '@/components/LoadingScreen';
import type { GameStatePayload, WelcomePayload } from '@/types/game';

export default function GamePage() {
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState<GameStatePayload | null>(null);
    const [worldSize, setWorldSize] = useState({ width: 2000, height: 2000 });

    const connectionRef = useRef<GameConnection | null>(null);
    const inputHandlerRef = useRef<InputHandler | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // Get username from session storage
        const storedUsername = sessionStorage.getItem('username');
        if (!storedUsername) {
            // Redirect to join page if no username
            router.push('/join');
            return;
        }

        setUsername(storedUsername);

        // Initialize connection
        const connection = new GameConnection();
        connectionRef.current = connection;

        // Set up callbacks
        connection.onWelcome = (data: WelcomePayload) => {
            console.log('Connected! Player ID:', data.id);
            console.log('World size:', data.worldWidth, 'x', data.worldHeight);
            setWorldSize({ width: data.worldWidth, height: data.worldHeight });
            setIsConnected(true);
        };

        connection.onStateUpdate = (state: GameStatePayload) => {
            setGameState(state);
        };

        connection.onDisconnect = () => {
            console.log('Disconnected from server');
            setIsConnected(false);
            // Could show reconnect UI here
        };

        connection.onError = (error) => {
            console.error('Connection error:', error);
            // Could show error UI here
        };

        // Connect to server
        const serverUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL || 'ws://localhost:8080/ws';
        console.log('Connecting to:', serverUrl);
        connection.connect(serverUrl, storedUsername);

        // Cleanup on unmount
        return () => {
            if (inputHandlerRef.current) {
                inputHandlerRef.current.destroy();
            }
            connection.disconnect();
        };
    }, [router]);

    // Set up input handler once canvas is ready and connected
    useEffect(() => {
        if (isConnected && canvasRef.current && connectionRef.current && !inputHandlerRef.current) {
            inputHandlerRef.current = new InputHandler(
                connectionRef.current,
                canvasRef.current
            );
        }
    }, [isConnected]);

    if (!username || !isConnected || !gameState) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex flex-col items-center justify-center p-4">
            <div className="mb-4 text-white text-center">
                <h1 className="text-2xl font-bold">🐟 Fishy Business</h1>
                <p className="text-sm">
                    WASD to swim • Space to boost
                </p>
            </div>

            <div ref={(el) => {
                if (el) canvasRef.current = el.querySelector('canvas');
            }}>
                <GameCanvas
                    gameState={gameState}
                    worldWidth={worldSize.width}
                    worldHeight={worldSize.height}
                />
            </div>

            <div className="mt-4 text-white text-sm text-center">
                <p>Playing as: <span className="font-bold text-yellow-400">{username}</span></p>
            </div>
        </div>
    );
}
