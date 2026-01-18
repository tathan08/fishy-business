'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GameConnection } from '@/lib/connection';
import { InputHandler } from '@/lib/input';
import { FaceTrackingInput } from '@/lib/faceTracking';
import GameCanvas from '@/components/GameCanvas';
import LoadingScreen from '@/components/LoadingScreen';
import { FishProfileDisplay } from '@/components/FishProfileDisplay';
import { getFishProfile } from '@/lib/generateFishProfile';
import type { GameStatePayload, WelcomePayload } from '@/types/game';
import type { FishProfile } from '@/lib/generateFishProfile';

export default function GamePage() {
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState<GameStatePayload | null>(null);
    const [worldSize, setWorldSize] = useState({ width: 2000, height: 2000 });
    const [useFaceTracking, setUseFaceTracking] = useState(false);
    const [faceTrackingCalibrated, setFaceTrackingCalibrated] = useState(false);
    const [faceTrackingError, setFaceTrackingError] = useState<string | null>(null);
    const [faceTrackingDirection, setFaceTrackingDirection] = useState({ x: 0, y: 0 });
    const [fishProfile, setFishProfile] = useState<FishProfile | null>(null);

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

        // Load fish profile from localStorage
        const profile = getFishProfile();
        if (profile) {
            setFishProfile(profile);
        }

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

                // Update direction indicator
                const updateDirection = setInterval(() => {
                    if (faceTrackingRef.current) {
                        setFaceTrackingDirection({
                            x: faceTrackingRef.current.currentDirX,
                            y: faceTrackingRef.current.currentDirY
                        });
                    }
                }, 50);
                (faceTracking as any).directionInterval = updateDirection;

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
                if ((faceTrackingRef.current as any).directionInterval) {
                    clearInterval((faceTrackingRef.current as any).directionInterval);
                }
                faceTrackingRef.current.stop();
                faceTrackingRef.current = null;
            }
            setUseFaceTracking(false);
            setFaceTrackingCalibrated(false);
            setFaceTrackingDirection({ x: 0, y: 0 });

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
        <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-600 flex flex-col items-center justify-center p-4 relative">
            {/* Fish Profile Display - Top Left */}
            {fishProfile && <FishProfileDisplay profile={fishProfile} />}

            {/* Face Tracking Controls - Top Right */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-10">
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => {
                            console.log('Button clicked! useFaceTracking:', useFaceTracking);
                            toggleFaceTracking();
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${useFaceTracking
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-green-500 hover:bg-green-600'
                            }`}
                    >
                        {useFaceTracking ? '🎥 Disable Face Tracking' : '🎥 Enable Face Tracking'}
                    </button>

                    {useFaceTracking && faceTrackingCalibrated && (
                        <button
                            onClick={recalibrateFaceTracking}
                            className="px-4 py-2 rounded-lg font-semibold bg-yellow-500 hover:bg-yellow-600 transition-all text-sm"
                        >
                            🎯 Recalibrate
                        </button>
                    )}
                </div>

                {/* Direction Indicator */}
                {useFaceTracking && faceTrackingCalibrated && (
                    <div className="bg-black/50 rounded-lg p-3 flex flex-col items-center gap-2">
                        <div className="text-white text-xs font-semibold">Swimming Direction</div>
                        <div className="relative w-20 h-20 bg-blue-900/50 rounded-full flex items-center justify-center">
                            {/* Arrow pointing in movement direction */}
                            <div
                                className="text-4xl transition-transform duration-100"
                                style={{
                                    transform: `rotate(${Math.atan2(faceTrackingDirection.y, faceTrackingDirection.x) * 180 / Math.PI + 90}deg)`,
                                }}
                            >
                                ↑
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Messages - Below Fish Profile */}
            {useFaceTracking && !faceTrackingCalibrated && (
                <div className="absolute top-80 left-4 z-10">
                    <p className="text-yellow-300 animate-pulse text-sm bg-black/30 px-3 py-2 rounded-lg">
                        📹 Look at the camera to calibrate...
                    </p>
                </div>
            )}

            {faceTrackingError && (
                <div className="absolute top-80 left-4 z-10">
                    <p className="text-red-300 text-sm bg-black/30 px-3 py-2 rounded-lg">
                        ⚠️ {faceTrackingError}
                    </p>
                </div>
            )}

            <div className="mb-4 text-white text-center">
                <h1 className="text-2xl font-bold">🐟 Fishy Business</h1>
            </div>

            {/* Canvas Container with Instructions Panel */}
            <div className="relative">
                <GameCanvas
                    ref={canvasRef}
                    gameState={gameState}
                    worldWidth={worldSize.width}
                    worldHeight={worldSize.height}
                    inputHandler={inputHandlerRef.current}
                    faceTrackingInput={faceTrackingRef.current}
                    connection={connectionRef.current}
                />

                {/* How to Play Panel - Positioned relative to minimap */}
                {/* Minimap is at canvas top-right (220px from right, 20px from top) */}
                <div className="absolute top-5 right-60 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-4 w-52 border border-white/20">
                    <h3 className="text-yellow-400 font-bold text-base mb-2 flex items-center gap-2">
                        🎮 How to Play
                    </h3>
                    <div className="text-white text-xs space-y-2">
                        {/* Keyboard Controls */}
                        <div className={!useFaceTracking ? 'opacity-100' : 'opacity-50'}>
                            <div className="font-semibold text-blue-300">⌨️ Keyboard</div>
                            <div className="text-xs pl-3">
                                • WASD / Arrows - Swim<br />
                                • Space - Boost
                            </div>
                        </div>

                        {/* Face Tracking */}
                        <div className={useFaceTracking ? 'opacity-100' : 'opacity-50'}>
                            <div className="font-semibold text-purple-300">📹 Face Tracking</div>
                            <div className="text-xs pl-3">
                                • turn head - Swim<br />
                                • Open mouth - Boost
                            </div>
                        </div>

                        {/* Game Rules */}
                        <div className="border-t border-white/20 pt-2 mt-2">
                            <div className="font-semibold text-green-300">🎯 Goal</div>
                            <div className="text-xs pl-3">
                                • Eat food & smaller fish<br />
                                • Grow bigger to survive<br />
                                • Become the biggest!
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-white text-sm text-center">
                <p>Playing as: <span className="font-bold text-yellow-400">{username}</span></p>
            </div>
        </div>
    );
}
