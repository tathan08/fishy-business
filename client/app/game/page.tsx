'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GameConnection } from '@/lib/connection';
import { InputHandler } from '@/lib/input';
import { FaceTrackingInput } from '@/lib/faceTracking';
import GameCanvas from '@/components/GameCanvas';
import LoadingScreen from '@/components/LoadingScreen';
import type { GameStatePayload, WelcomePayload } from '@/types/game';

export default function GamePage() {
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState<GameStatePayload | null>(null);
    const [worldSize, setWorldSize] = useState({ width: 2000, height: 2000 });
    const [useFaceTracking, setUseFaceTracking] = useState(false);
    const [faceTrackingCalibrated, setFaceTrackingCalibrated] = useState(false);
    const [faceTrackingError, setFaceTrackingError] = useState<string | null>(null);

    const connectionRef = useRef<GameConnection | null>(null);
    const inputHandlerRef = useRef<InputHandler | null>(null);
    const faceTrackingRef = useRef<FaceTrackingInput | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // Get username from session storage
        const storedUsername = sessionStorage.getItem('username');
        const storedFishModel = sessionStorage.getItem('fishModel') as any;
        
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
        connection.connect(serverUrl, storedUsername, storedFishModel);

        // Cleanup on unmount
        return () => {
            if (inputHandlerRef.current) {
                inputHandlerRef.current.destroy();
            }
            if (faceTrackingRef.current) {
                faceTrackingRef.current.stop();
            }
            connection.disconnect();
        };
    }, [router]);

    // Set up input handler once canvas is ready and connected
    useEffect(() => {
        if (isConnected && canvasRef.current && connectionRef.current && !inputHandlerRef.current) {
            console.log('Setting up input handler...');
            inputHandlerRef.current = new InputHandler(
                connectionRef.current,
                canvasRef.current
            );
            console.log('Input handler ready!');
        }
    }, [isConnected, canvasRef.current]);

    // Handle face tracking toggle
    const toggleFaceTracking = async () => {
        if (!connectionRef.current) return;

        if (!useFaceTracking) {
            // Enable face tracking
            try {
                console.log('Toggling face tracking ON');
                setFaceTrackingError(null);
                const faceTracking = new FaceTrackingInput(connectionRef.current);
                faceTrackingRef.current = faceTracking;

                faceTracking.onCalibrated = () => {
                    console.log('Face tracking calibrated');
                    setFaceTrackingCalibrated(true);
                };

                faceTracking.onError = (error) => {
                    console.error('Face tracking error callback:', error);
                    setFaceTrackingError(error);
                    setUseFaceTracking(false);
                };

                await faceTracking.start();
                console.log('Face tracking started successfully');
                setUseFaceTracking(true);

                // Disable keyboard input
                if (inputHandlerRef.current) {
                    inputHandlerRef.current.destroy();
                    inputHandlerRef.current = null;
                }
            } catch (error) {
                console.error('Face tracking toggle error:', error);
                setFaceTrackingError(`Failed to start: ${error}`);
            }
        } else {
            // Disable face tracking
            console.log('Toggling face tracking OFF');
            if (faceTrackingRef.current) {
                faceTrackingRef.current.stop();
                faceTrackingRef.current = null;
            }
            setUseFaceTracking(false);
            setFaceTrackingCalibrated(false);

            // Re-enable keyboard input
            if (canvasRef.current && connectionRef.current) {
                inputHandlerRef.current = new InputHandler(
                    connectionRef.current,
                    canvasRef.current
                );
            }
        }
    };

    const recalibrateFaceTracking = () => {
        if (faceTrackingRef.current) {
            faceTrackingRef.current.recalibrate();
            setFaceTrackingCalibrated(false);
        }
    };

    if (!username || !isConnected || !gameState) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex flex-col items-center justify-center p-4">
            <div className="mb-4 text-white text-center">
                <h1 className="text-2xl font-bold">🐟 Fishy Business</h1>
                <p className="text-sm">
                    {useFaceTracking ? 'Face Tracking Active' : 'WASD to swim • Space to boost'}
                </p>
            </div>

            <GameCanvas
                ref={canvasRef}
                gameState={gameState}
                worldWidth={worldSize.width}
                worldHeight={worldSize.height}
            />

            <div className="mt-4 text-white text-sm text-center space-y-2">
                <p>Playing as: <span className="font-bold text-yellow-400">{username}</span></p>
                
                {/* Face Tracking Controls */}
                <div className="flex gap-2 justify-center items-center">
                    <button
                        onClick={() => {
                            console.log('Button clicked! useFaceTracking:', useFaceTracking);
                            toggleFaceTracking();
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            useFaceTracking
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-500 hover:bg-green-600'
                        }`}
                    >
                        {useFaceTracking ? '🎥 Disable Face Tracking' : '🎥 Enable Face Tracking'}
                    </button>
                    
                    {useFaceTracking && faceTrackingCalibrated && (
                        <button
                            onClick={recalibrateFaceTracking}
                            className="px-4 py-2 rounded-lg font-semibold bg-yellow-500 hover:bg-yellow-600 transition-all"
                        >
                            🎯 Recalibrate
                        </button>
                    )}
                </div>

                {useFaceTracking && !faceTrackingCalibrated && (
                    <p className="text-yellow-300 animate-pulse">
                        📹 Look at the camera to calibrate...
                    </p>
                )}

                {faceTrackingError && (
                    <p className="text-red-300">
                        ⚠️ {faceTrackingError}
                    </p>
                )}
            </div>
        </div>
    );
}
