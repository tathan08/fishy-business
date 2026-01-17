// ============================================
// WebSocket connection handler
// ============================================

import type {
    ClientMessage,
    ServerMessage,
    WelcomePayload,
    GameStatePayload,
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

    // Callbacks for frontend to implement
    onWelcome: (data: WelcomePayload) => void = () => { };
    onStateUpdate: (state: GameStatePayload) => void = () => { };
    onDisconnect: () => void = () => { };
    onError: (error: Event) => void = () => { };

    connect(serverUrl: string, playerName: string): void {
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
            console.log("WebSocket connected");
            // Step 1: Send join message
            this.send({ type: "join", name: playerName });

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
            console.error("WebSocket error:", err);
            this.onError(err);
        };
    }

    // Called by input handler (mouse move, keyboard, touch, etc.)
    setInput(dirX: number, dirY: number, boost: boolean): void {
        this.currentInput = { dirX, dirY, boost };
    }

    private startInputLoop(): void {
        // Send input 20 times per second (every 50ms)
        this.inputInterval = window.setInterval(() => {
            this.sendInput();
        }, 50);
    }

    private stopInputLoop(): void {
        if (this.inputInterval) {
            clearInterval(this.inputInterval);
            this.inputInterval = null;
        }
    }

    private sendInput(): void {
        this.inputSeq++;
        this.send({
            type: "input",
            dirX: this.currentInput.dirX,
            dirY: this.currentInput.dirY,
            boost: this.currentInput.boost,
            seq: this.inputSeq,
        });
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
