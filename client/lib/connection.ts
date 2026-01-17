// ============================================
// WebSocket connection handler
// ============================================

import type {
    ClientMessage,
    ServerMessage,
    WelcomePayload,
    GameStatePayload,
    FishModel,
} from "@/types/game";

export class GameConnection {
    private ws: WebSocket | null = null;
    private inputSeq: number = 0;
    private inputInterval: number | null = null;

    // Current input state (updated by input handler)
    private currentInput = {
        dirX: 0,
        dirY: 0,
        boost: false,
    };

    // Track last sent input to avoid redundant sends
    private lastSentInput = {
        dirX: 0,
        dirY: 0,
        boost: false,
    };

    // Callbacks for frontend to implement
    onWelcome: (data: WelcomePayload) => void = () => { };
    onStateUpdate: (state: GameStatePayload) => void = () => { };
    onDisconnect: () => void = () => { };
    onError: (error: Event) => void = () => { };

    connect(serverUrl: string, playerName: string, fishModel?: FishModel): void {
        console.log("Attempting to connect to:", serverUrl);
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
            console.log("WebSocket connected successfully");
            // Step 1: Send join message with fish model
            this.send({ type: "join", name: playerName, model: fishModel });

            // Step 2: Start sending input at 20Hz (every 50ms)
            this.startInputLoop();
        };

        this.ws.onmessage = (event) => {
            const msg: ServerMessage = JSON.parse(event.data);

            switch (msg.type) {
                case "welcome":
                    this.onWelcome(msg.payload as WelcomePayload);
                    break;

                case "state":
                    this.onStateUpdate(msg.payload as GameStatePayload);
                    break;

                case "pong":
                    // Could calculate latency here
                    break;
            }
        };

        this.ws.onclose = () => {
            console.log("WebSocket closed");
            this.stopInputLoop();
            this.onDisconnect();
        };

        this.ws.onerror = (err) => {
            console.error("WebSocket error occurred:", err);
            console.error("Error type:", err.type);
            this.onError(err);
        };
    }

    // Called by input handler (mouse move, keyboard, touch, etc.)
    setInput(dirX: number, dirY: number, boost: boolean): void {
        this.currentInput = { dirX, dirY, boost };
    }

    private startInputLoop(): void {
        // Send input 15 times per second (every 66ms)
        this.inputInterval = window.setInterval(() => {
            this.sendInput();
        }, 66);
    }

    private stopInputLoop(): void {
        if (this.inputInterval) {
            clearInterval(this.inputInterval);
            this.inputInterval = null;
        }
    }

    private sendInput(): void {
        const { dirX, dirY, boost } = this.currentInput;
        const last = this.lastSentInput;
        
        // Only send if input changed significantly (threshold for float comparison)
        const threshold = 0.01;
        const hasChanged = 
            Math.abs(dirX - last.dirX) > threshold || 
            Math.abs(dirY - last.dirY) > threshold || 
            boost !== last.boost;
        
        if (hasChanged) {
            this.inputSeq++;
            this.send({
                type: "input",
                dirX,
                dirY,
                boost,
                seq: this.inputSeq,
            });
            
            // Update last sent state
            this.lastSentInput = { dirX, dirY, boost };
        }
    }

    private send(msg: ClientMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    disconnect(): void {
        this.stopInputLoop();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
