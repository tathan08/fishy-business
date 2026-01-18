"use client";

import { useEffect, useRef, useState } from "react";
import { RacingConnection, RaceWelcomePayload, RaceStatePayload, RaceResultsPayload } from "@/lib/racingConnection";
import { RacingFaceTrackingInput } from "@/lib/racingFaceTracking";
import LoadingScreen from "@/components/LoadingScreen";

export default function RacingPage() {
    const [status, setStatus] = useState<string>("idle");
    const [raceState, setRaceState] = useState<RaceStatePayload | null>(null);
    const [results, setResults] = useState<RaceResultsPayload | null>(null);
    const [mouthOpen, setMouthOpen] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [showNameInput, setShowNameInput] = useState(true);
    const [debugData, setDebugData] = useState<{
        verticalDist: number;
        horizontalDist: number;
        aspectRatio: number;
        threshold: number;
    } | null>(null);
    const [cycleCount, setCycleCount] = useState(0);

    const connectionRef = useRef<RacingConnection | null>(null);
    const faceTrackingRef = useRef<RacingFaceTrackingInput | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Preload saca (right-facing) fish image for lane indicator
    const sacaImgRef = useRef<HTMLImageElement | null>(null);
    const autoStartRef = useRef<boolean>(false);

    useEffect(() => {
        if (!sacaImgRef.current) {
            const img = new Image();
            img.src = "/fish-models/sacabambaspis_right.png";
            img.onload = () => {
                sacaImgRef.current = img;
            };
        }
    }, []);

    // Auto-load username from sessionStorage ONLY if coming from game
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromGame = params.get('fromGame') === 'true';

        if (fromGame) {
            const storedUsername = sessionStorage.getItem('username');
            if (storedUsername && storedUsername.trim()) {
                setPlayerName(storedUsername);
                setShowNameInput(false);
                autoStartRef.current = true;
            }
        }
    }, []);

    const startRacing = async () => {
        if (!playerName.trim()) {
            alert("Please enter your name!");
            return;
        }

        setShowNameInput(false);
        setStatus("connecting");

        try {
            // Connect to server FIRST (before face tracking)
            const serverUrl = process.env.NEXT_PUBLIC_RACING_WS_URL || "ws://localhost:8080/ws/racing";
            console.log("Connecting to racing server:", serverUrl);

            const connection = new RacingConnection();
            connectionRef.current = connection;

            // Set up callbacks
            connection.onWelcome = (data: RaceWelcomePayload) => {
                console.log("Welcome to race:", data);
                setStatus("waiting");
            };

            connection.onRaceState = (state: RaceStatePayload) => {
                setRaceState(state);
                if (state.raceState === "racing") {
                    setStatus("racing");
                } else if (state.raceState === "countdown") {
                    setStatus("countdown");
                }
            };

            connection.onRaceResults = (resultsData: RaceResultsPayload) => {
                setResults(resultsData);
                setStatus("finished");
            };

            connection.onDisconnect = () => {
                console.log("Disconnected from race");
                setStatus("disconnected");
            };

            connection.onError = (error) => {
                console.error("Connection error:", error);
                setStatus("error");
            };

            // Connect NOW
            connection.connect(serverUrl, playerName, "fish1");

            // Start face tracking AFTER connection (in background)
            const faceTracking = new RacingFaceTrackingInput(connection);
            faceTrackingRef.current = faceTracking;

            faceTracking.onCalibrated = () => {
                console.log("Face tracking calibrated");
            };

            faceTracking.onMouthStateChange = (isOpen: boolean) => {
                setMouthOpen(isOpen);
            };

            faceTracking.onDebugData = (data) => {
                setDebugData(data);
            };

            faceTracking.onCycleCount = (count) => {
                setCycleCount(count);
            };

            faceTracking.onError = (error: string) => {
                console.error("Face tracking error:", error);
            };

            // Start face tracking in background (don't block)
            faceTracking.start().catch(error => {
                console.error("Failed to start face tracking:", error);
            });

        } catch (error) {
            console.error("Error starting racing:", error);
            setStatus("error");
            alert("Failed to start racing. Please check your connection.");
        }
    };

    const reset = () => {
        if (connectionRef.current) {
            connectionRef.current.disconnect();
        }
        if (faceTrackingRef.current) {
            faceTrackingRef.current.stop();
        }
        setStatus("idle");
        setRaceState(null);
        setResults(null);
        setShowNameInput(true);
        setPlayerName(""); // Clear the name state
        sessionStorage.removeItem('username'); // Clear from storage
        sessionStorage.removeItem('fishModel'); // Clear fish model too
    };

    // Trigger auto-start if username was loaded from sessionStorage
    useEffect(() => {
        if (autoStartRef.current && playerName && !showNameInput && status === "idle") {
            autoStartRef.current = false; // Prevent re-triggering
            startRacing();
        }
    }, [playerName, showNameInput, status]);

    // Draw race visualization
    useEffect(() => {
        if (!canvasRef.current || !raceState) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        console.log("Drawing race, yourProgress:", raceState.yourProgress?.progress, "cycles:", cycleCount);

        // Clear canvas
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw race track
        const trackY = 50;
        const trackHeight = 60;
        const padding = 50;
        const trackWidth = canvas.width - padding * 2;

        raceState.players.forEach((player, index) => {
            const y = trackY + index * (trackHeight + 20);

            // Draw lane background
            ctx.fillStyle = player.id === connectionRef.current?.getClientId() ? "#2a2a4e" : "#252540";
            ctx.fillRect(padding, y, trackWidth, trackHeight);

            // Draw progress bar
            const progressWidth = trackWidth * player.progress;
            ctx.fillStyle = player.finished ? "#4ade80" : "#3b82f6";
            ctx.fillRect(padding, y, progressWidth, trackHeight);

            // Draw fish indicator (use saca image instead of emoji)
            const fishX = padding + progressWidth;
            const indicatorW = 120; // 3x larger
            const indicatorH = 72;  // 3x larger
            const img = sacaImgRef.current;
            if (img && img.complete) {
                ctx.drawImage(img, fishX - indicatorW / 2, y + (trackHeight - indicatorH) / 2, indicatorW, indicatorH);
            } else {
                // Fallback to emoji if image not yet loaded
                ctx.fillStyle = "#fff";
                ctx.font = "90px Arial"; // 3x larger
                ctx.fillText("🐟", fishX - 45, y + 90);
            }

            // Draw player name
            ctx.fillStyle = "#fff";
            ctx.font = "16px Arial";
            ctx.fillText(player.name, padding + 10, y + 20);

            // Draw progress percentage
            ctx.fillText(`${Math.round(player.progress * 100)}%`, padding + 10, y + 50);
        });

        // Draw finish line
        const finishX = padding + trackWidth;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(finishX, 0);
        ctx.lineTo(finishX, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

    }, [raceState]);

    if (showNameInput) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-blue-950 text-white p-4">
                <div className="text-center space-y-6 max-w-md">
                    <h1 className="text-5xl font-bold mb-8 flex items-center justify-center gap-4">
                        <img src="/fish-models/sacabambaspis.png" alt="Fish" className="h-36 w-60 object-contain" />
                        Fish Racing
                    </h1>
                    <p className="text-xl mb-4">Open and close your mouth to boost forward!</p>

                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && startRacing()}
                            className="w-full px-4 py-3 text-xl rounded-lg bg-blue-800 border-2 border-blue-600 focus:outline-none focus:border-blue-400"
                            autoFocus
                        />

                        <button
                            onClick={startRacing}
                            className="w-full px-8 py-4 text-xl font-bold rounded-lg bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transition-all transform hover:scale-105"
                        >
                            Start Racing!
                        </button>
                    </div>

                    <div className="mt-8 p-4 bg-blue-800 rounded-lg text-sm">
                        <p className="font-bold mb-2">How to Play:</p>
                        <ul className="text-left space-y-1">
                            <li>• Rapidly open and close your mouth to move forward</li>
                            <li>• The faster you move your mouth, the faster you go!</li>
                            <li>• Your speed is measured in Mouth Actions Per Minute</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "connecting") {
        return <LoadingScreen />;
    }

    if (status === "waiting") {
        const isReady = raceState?.yourProgress?.ready || false;
        const readyCount = raceState?.readyCount || 0;
        const totalPlayers = raceState?.totalPlayers || 0;

        console.log("Lobby state:", { isReady, readyCount, totalPlayers, yourProgress: raceState?.yourProgress });

        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-blue-950 text-white p-4">
                <div className="text-center space-y-6">
                    <h1 className="text-4xl font-bold">⏳ Lobby</h1>
                    <p className="text-xl">Click Ready when you're set!</p>

                    <button
                        onClick={() => {
                            console.log("Ready button clicked, isReady:", isReady);
                            if (!isReady && connectionRef.current) {
                                console.log("Sending ready signal");
                                connectionRef.current.sendReady();
                            }
                        }}
                        disabled={isReady}
                        className={`text-3xl font-bold px-12 py-6 rounded-lg transition-all transform ${isReady
                            ? "bg-green-600 cursor-not-allowed opacity-75"
                            : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
                            }`}
                    >
                        {isReady ? `✅ Ready! ${readyCount}/${totalPlayers}` : `Ready? ${readyCount}/${totalPlayers}`}
                    </button>

                    {raceState && (
                        <div className="mt-8 p-6 bg-blue-800 rounded-lg max-w-md">
                            <p className="text-lg mb-4 font-bold">Players in Lobby:</p>
                            <ul className="space-y-3">
                                {raceState.players.map((player) => (
                                    <li key={player.id} className="text-xl flex justify-between items-center">
                                        <span>
                                            {player.name} {player.id === connectionRef.current?.getClientId() && "(You)"}
                                        </span>
                                        <span className="ml-4">
                                            {player.ready ? "✅" : "⏳"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {readyCount === totalPlayers && totalPlayers > 0 && (
                                <p className="mt-4 text-green-400 font-bold animate-pulse">
                                    All players ready! Starting soon...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (status === "countdown" && raceState) {
        const countdown = Math.ceil(raceState.timeRemaining || 0);
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-900 to-red-950 text-white p-4">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-8">Get Ready!</h1>
                    <div className="text-9xl font-bold animate-pulse">
                        {countdown > 0 ? countdown : "GO!"}
                    </div>
                    <p className="text-2xl mt-8">Start moving your mouth!</p>
                </div>
            </div>
        );
    }

    if (status === "racing" && raceState) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-900 to-blue-950 text-white p-4">
                <div className="flex-1 flex flex-col">
                    <h1 className="text-4xl font-bold text-center mb-4">🏁 Fish Racing!</h1>

                    {/* Mouth state indicator */}
                    <div className="text-center mb-4">
                        <div className={`inline-block px-8 py-4 rounded-full text-2xl font-bold transition-all ${mouthOpen
                            ? "bg-green-500 scale-110"
                            : "bg-gray-600 scale-100"
                            }`}>
                            {mouthOpen ? "🚀 BOOSTING!" : "😐 Open Mouth to Boost"}
                        </div>

                        {/* Debug data display */}
                        {debugData && (
                            <div className="mt-4 p-4 bg-black bg-opacity-50 rounded-lg inline-block text-left font-mono text-sm">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <span className="text-gray-400">Vertical Distance:</span>
                                    <span className="text-white font-bold">{debugData.verticalDist.toFixed(4)}</span>

                                    <span className="text-gray-400">Horizontal Distance:</span>
                                    <span className="text-white font-bold">{debugData.horizontalDist.toFixed(4)}</span>

                                    <span className="text-gray-400">Aspect Ratio:</span>
                                    <span className={`font-bold ${debugData.aspectRatio > debugData.threshold ? 'text-green-400' : 'text-red-400'}`}>
                                        {debugData.aspectRatio.toFixed(4)}
                                    </span>

                                    <span className="text-gray-400">Threshold:</span>
                                    <span className="text-yellow-400 font-bold">{debugData.threshold.toFixed(4)}</span>

                                    <span className="text-gray-400">Mouth State:</span>
                                    <span className={`font-bold ${mouthOpen ? 'text-green-400' : 'text-red-400'}`}>
                                        {mouthOpen ? "OPEN" : "CLOSED"}
                                    </span>

                                    <span className="text-gray-400">Cycles:</span>
                                    <span className="text-cyan-400 font-bold text-xl">
                                        {cycleCount} / 50
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Race canvas */}
                    <div className="flex-1 flex items-center justify-center">
                        <canvas
                            ref={canvasRef}
                            width={1200}
                            height={600}
                            className="border-4 border-white rounded-lg max-w-full"
                        />
                    </div>

                    {/* Your progress */}
                    <div className="mt-4 p-4 bg-blue-800 rounded-lg text-center">
                        <p className="text-2xl font-bold">
                            Your Progress: {Math.round(raceState.yourProgress.progress * 100)}%
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "finished" && results) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-900 to-orange-950 text-white p-4">
                <div className="text-center space-y-6 max-w-2xl">
                    <h1 className="text-5xl font-bold mb-8">🏆 Race Finished!</h1>

                    <div className="bg-yellow-800 rounded-lg p-6">
                        <h2 className="text-3xl font-bold mb-4">Final Results</h2>
                        <div className="space-y-4">
                            {results.results.map((result, index) => (
                                <div
                                    key={result.playerId}
                                    className={`p-4 rounded-lg ${index === 0 ? "bg-yellow-600" :
                                        index === 1 ? "bg-gray-400" :
                                            index === 2 ? "bg-orange-600" :
                                                "bg-blue-700"
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="text-left">
                                            <span className="text-3xl font-bold mr-4">#{result.rank}</span>
                                            <span className="text-2xl">{result.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold">
                                                {result.finishTime.toFixed(2)}s
                                            </div>
                                            <div className="text-lg">
                                                {result.mouthActionsPerMinute.toFixed(1)} MAPM
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={reset}
                        className="mt-8 px-8 py-4 text-xl font-bold rounded-lg bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transition-all transform hover:scale-105"
                    >
                        Race Again!
                    </button>
                </div>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-red-950 text-white p-4">
                <h1 className="text-4xl font-bold mb-4">❌ Connection Error</h1>
                <p className="text-xl mb-8">Failed to connect to the racing server</p>
                <button
                    onClick={reset}
                    className="px-8 py-4 text-xl font-bold rounded-lg bg-blue-600 hover:bg-blue-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return null;
}
