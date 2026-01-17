// ============================================
// Racing WebSocket connection handler
// ============================================

export interface RacingClientMessage {
    type: string;
    name?: string;
    model?: string;
    mouthOpen?: boolean;
    mouthCycle?: number;
    seq?: number;
    fishState?: {
        mouthCycles: number;
    };
}

export interface RacingServerMessage {
    type: string;
    payload?: any;
}

export interface RaceWelcomePayload {
    playerId: string;
    raceId: string;
    name: string;
    model: string;
    raceState: string;
}

export interface RacePlayerState {
    id: string;
    name: string;
    model: string;
    distance: number;
    progress: number; // 0.0 to 1.0
    finished: boolean;
    ready: boolean;
}

export interface RaceStatePayload {
    raceState: string;
    timeRemaining?: number;
    players: RacePlayerState[];
    yourProgress: RacePlayerState;
    readyCount: number;
    totalPlayers: number;
}

export interface RaceResult {
    playerId: string;
    name: string;
    model: string;
    finishTime: number;
    mouthActionsPerMinute: number;
    rank: number;
}

export interface RaceResultsPayload {
    results: RaceResult[];
}

export class RacingConnection {
    private ws: WebSocket | null = null;
    private clientId: string | null = null;
    private raceId: string | null = null;
    private inputInterval: number | null = null;

    // Current mouth state
    private currentMouthOpen = false;
    private lastSentMouthOpen = false;

    // Callbacks for frontend
    onWelcome: (data: RaceWelcomePayload) => void = () => {};
    onRaceState: (state: RaceStatePayload) => void = () => {};
    onRaceResults: (results: RaceResultsPayload) => void = () => {};
    onDisconnect: () => void = () => {};
    onError: (error: Event) => void = () => {};

    connect(serverUrl: string, playerName: string, fishModel?: string): void {
        console.log("Connecting to racing server:", serverUrl);
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
            console.log("Racing WebSocket connected");
            // Send join message
            const joinMsg = { type: "join", name: playerName, model: fishModel || "fish1" };
            console.log("Sending join message:", joinMsg);
            this.send(joinMsg);

            // Start sending mouth input at high frequency
            this.startInputLoop();
        };

        this.ws.onmessage = (event) => {
            console.log("Racing message received:", event.data);
            const msg: RacingServerMessage = JSON.parse(event.data);

            switch (msg.type) {
                case "welcome":
                    const welcomeData = msg.payload as RaceWelcomePayload;
                    this.clientId = welcomeData.playerId;
                    this.raceId = welcomeData.raceId;
                    this.onWelcome(welcomeData);
                    console.log("Joined race:", welcomeData.raceId);
                    break;

                case "raceState":
                    this.onRaceState(msg.payload as RaceStatePayload);
                    break;

                case "raceResults":
                    this.onRaceResults(msg.payload as RaceResultsPayload);
                    break;

                case "pong":
                    break;
            }
        };

        this.ws.onclose = () => {
            console.log("Racing WebSocket closed");
            this.stopInputLoop();
            this.onDisconnect();
        };

        this.ws.onerror = (err) => {
            console.error("Racing WebSocket error:", err);
            this.onError(err);
        };
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.stopInputLoop();
    }

    // Send ready signal
    sendReady(): void {
        this.send({ type: "ready" });
    }

    // Update mouth state (called by face tracking)
    setMouthOpen(isOpen: boolean): void {
        this.currentMouthOpen = isOpen;
    }

    // Send mouth cycle increment
    sendMouthCycle(): void {
        this.send({
            type: "mouthCycle",
            mouthCycle: 1,
        });
    }

    // Send fish state update with cycle count
    sendStateUpdate(mouthCycles: number): void {
        console.log("sendStateUpdate called with mouthCycles:", mouthCycles);
        this.send({
            type: "stateUpdate",
            fishState: {
                mouthCycles: mouthCycles,
            },
        });
    }

    private startInputLoop(): void {
        // Send mouth state at 60Hz
        this.inputInterval = window.setInterval(() => {
            this.sendMouthInput();
        }, 1000 / 60);
    }

    private stopInputLoop(): void {
        if (this.inputInterval !== null) {
            clearInterval(this.inputInterval);
            this.inputInterval = null;
        }
    }

    private sendMouthInput(): void {
        // Only send if mouth state changed
        if (this.currentMouthOpen !== this.lastSentMouthOpen) {
            this.send({
                type: "mouthInput",
                mouthOpen: this.currentMouthOpen,
            });
            this.lastSentMouthOpen = this.currentMouthOpen;
        }
    }

    private send(message: RacingClientMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    getClientId(): string | null {
        return this.clientId;
    }

    getRaceId(): string | null {
        return this.raceId;
    }
}
