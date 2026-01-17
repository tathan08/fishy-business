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
        
        // Set binary type to handle binary messages properly
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            console.log("WebSocket connected successfully");
            // Step 1: Send join message with fish model
            this.send({ type: "join", name: playerName, model: fishModel });

            // Step 2: Start sending input at 20Hz (every 50ms)
            this.startInputLoop();
        };

        this.ws.onmessage = (event) => {
            // Handle binary messages
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                this.handleBinaryMessage(event.data);
                return;
            }

            // Fallback to JSON for text messages
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

    // Binary protocol decoder
    private async handleBinaryMessage(data: ArrayBuffer | Blob): Promise<void> {
        let buffer: ArrayBuffer;
        
        if (data instanceof Blob) {
            buffer = await data.arrayBuffer();
        } else {
            buffer = data;
        }

        const view = new DataView(buffer);
        const msgType = view.getUint8(0);

        switch (msgType) {
            case 1: // Welcome
                this.decodeWelcome(view);
                break;
            case 2: // State
                this.decodeGameState(view);
                break;
            case 3: // Pong
                break;
        }
    }

    private decodeWelcome(view: DataView): void {
        let offset = 1;
        
        // ID string
        const idLen = view.getUint16(offset);
        offset += 2;
        const id = new TextDecoder().decode(new Uint8Array(view.buffer, offset, idLen));
        offset += idLen;
        
        // World dimensions
        const worldWidth = view.getFloat64(offset);
        offset += 8;
        const worldHeight = view.getFloat64(offset);
        
        this.onWelcome({
            id,
            worldWidth,
            worldHeight,
        });
    }

    private decodeGameState(view: DataView): void {
        let offset = 1;
        
        // Decode player state
        const { player, newOffset: playerOffset } = this.decodePlayerState(view, offset);
        offset = playerOffset;
        
        // Decode others
        const othersCount = view.getUint16(offset);
        offset += 2;
        const others: any[] = [];
        for (let i = 0; i < othersCount; i++) {
            const { other, newOffset } = this.decodeOtherPlayer(view, offset);
            others.push(other);
            offset = newOffset;
        }
        
        // Decode food
        const foodCount = view.getUint16(offset);
        offset += 2;
        const food: any[] = [];
        for (let i = 0; i < foodCount; i++) {
            const { foodItem, newOffset } = this.decodeFoodState(view, offset);
            food.push(foodItem);
            offset = newOffset;
        }
        
        // Decode leaderboard
        const leaderboardCount = view.getUint16(offset);
        offset += 2;
        const leaderboard: any[] = [];
        for (let i = 0; i < leaderboardCount; i++) {
            const { entry, newOffset } = this.decodeLeaderboardEntry(view, offset);
            leaderboard.push(entry);
            offset = newOffset;
        }
        
        this.onStateUpdate({
            you: player,
            others,
            food,
            leaderboard,
        });
    }

    private decodePlayerState(view: DataView, offset: number): { player: any; newOffset: number } {
        // Flags
        const flags = view.getUint8(offset++);
        const alive = (flags & 1) !== 0;
        const hasKilledBy = (flags & 2) !== 0;
        const hasRespawnIn = (flags & 4) !== 0;
        
        // ID
        const { str: id, newOffset: idOffset } = this.readString(view, offset);
        offset = idOffset;
        
        // Name
        const { str: name, newOffset: nameOffset } = this.readString(view, offset);
        offset = nameOffset;
        
        // Model
        const { str: model, newOffset: modelOffset } = this.readString(view, offset);
        offset = modelOffset;
        
        // Position, velocity, rotation, size
        const x = view.getFloat32(offset); offset += 4;
        const y = view.getFloat32(offset); offset += 4;
        const velX = view.getFloat32(offset); offset += 4;
        const velY = view.getFloat32(offset); offset += 4;
        const rotation = view.getFloat32(offset); offset += 4;
        const size = view.getFloat32(offset); offset += 4;
        
        // Score and seq
        const score = view.getUint32(offset); offset += 4;
        const seq = view.getUint32(offset); offset += 4;
        
        // Optional fields
        let killedBy: string | undefined;
        let respawnIn: number | undefined;
        
        if (hasKilledBy) {
            const { str, newOffset } = this.readString(view, offset);
            killedBy = str;
            offset = newOffset;
        }
        
        if (hasRespawnIn) {
            respawnIn = view.getFloat32(offset);
            offset += 4;
        }
        
        return {
            player: { id, name, model, x, y, velX, velY, rotation, size, score, alive, seq, killedBy, respawnIn },
            newOffset: offset
        };
    }

    private decodeOtherPlayer(view: DataView, offset: number): { other: any; newOffset: number } {
        const { str: id, newOffset: idOffset } = this.readString(view, offset);
        offset = idOffset;
        
        const { str: name, newOffset: nameOffset } = this.readString(view, offset);
        offset = nameOffset;
        
        const { str: model, newOffset: modelOffset } = this.readString(view, offset);
        offset = modelOffset;
        
        const x = view.getFloat32(offset); offset += 4;
        const y = view.getFloat32(offset); offset += 4;
        const velX = view.getFloat32(offset); offset += 4;
        const velY = view.getFloat32(offset); offset += 4;
        const rotation = view.getFloat32(offset); offset += 4;
        const size = view.getFloat32(offset); offset += 4;
        
        return {
            other: { id, name, model, x, y, velX, velY, rotation, size },
            newOffset: offset
        };
    }

    private decodeFoodState(view: DataView, offset: number): { foodItem: any; newOffset: number } {
        const id = Number(view.getBigUint64(offset)); offset += 8;
        const x = view.getFloat32(offset); offset += 4;
        const y = view.getFloat32(offset); offset += 4;
        const r = view.getFloat32(offset); offset += 4;
        
        return {
            foodItem: { id, x, y, r },
            newOffset: offset
        };
    }

    private decodeLeaderboardEntry(view: DataView, offset: number): { entry: any; newOffset: number } {
        const { str: name, newOffset: nameOffset } = this.readString(view, offset);
        offset = nameOffset;
        
        const score = view.getUint32(offset); offset += 4;
        
        return {
            entry: { name, score },
            newOffset: offset
        };
    }

    private readString(view: DataView, offset: number): { str: string; newOffset: number } {
        const length = view.getUint16(offset);
        offset += 2;
        const bytes = new Uint8Array(view.buffer, offset, length);
        const str = new TextDecoder().decode(bytes);
        return { str, newOffset: offset + length };
    }
}
