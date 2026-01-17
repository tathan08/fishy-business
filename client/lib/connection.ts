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
    private ws: WebSocket | null = null; // Primary: position updates
    private metaWs: WebSocket | null = null; // Secondary: metadata
    private clientId: string | null = null;
    private inputSeq: number = 0;
    private inputInterval: number | null = null;
    private lastGameState: GameStatePayload | null = null;
    private playerInfoCache: Map<string, { name: string; model: string }> = new Map();

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
            console.log("Primary WebSocket connected");
            // Step 1: Send join message with fish model
            this.send({ type: "join", name: playerName, model: fishModel });

            // Step 2: Start sending input
            this.startInputLoop();
        };

        this.ws.onmessage = (event) => {
            // Handle binary messages
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                this.handleBinaryMessage(event.data, 'primary');
                return;
            }

            // Fallback to JSON for text messages
            const msg: ServerMessage = JSON.parse(event.data);

            switch (msg.type) {
                case "welcome":
                    const welcomeData = msg.payload as WelcomePayload;
                    this.clientId = welcomeData.id;
                    this.onWelcome(welcomeData);
                    
                    // Connect to metadata socket after getting client ID
                    this.connectMetaSocket(serverUrl, welcomeData.id);
                    break;

                case "state":
                    this.onStateUpdate(msg.payload as GameStatePayload);
                    break;

                case "leaderboard":
                    // Handled by metadata socket now
                    break;

                case "pong":
                    break;
            }
        };

        this.ws.onclose = () => {
            console.log("Primary WebSocket closed");
            this.stopInputLoop();
            this.disconnect();
        };

        this.ws.onerror = (err) => {
            console.error("Primary WebSocket error:", err);
            this.onError(err);
        };
    }

    private connectMetaSocket(primaryUrl: string, clientId: string): void {
        // Convert primary URL to metadata URL
        const metaUrl = primaryUrl.replace('/ws', '/ws/meta') + `?id=${clientId}`;
        
        console.log("Connecting to metadata socket:", metaUrl);
        this.metaWs = new WebSocket(metaUrl);
        this.metaWs.binaryType = 'arraybuffer';

        this.metaWs.onopen = () => {
            console.log("Metadata WebSocket connected");
        };

        this.metaWs.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                this.handleBinaryMessage(event.data, 'meta');
            }
        };

        this.metaWs.onclose = () => {
            console.log("Metadata WebSocket closed");
        };

        this.metaWs.onerror = (err) => {
            console.error("Metadata WebSocket error:", err);
        };
    }

    // Called by input handler (mouse move, keyboard, touch, etc.)
    setInput(dirX: number, dirY: number, boost: boolean): void {
        this.currentInput = { dirX, dirY, boost };
    }

    private startInputLoop(): void {
        // Send input 15 times per second (every 66.6ms)
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
        if (this.metaWs) {
            this.metaWs.close();
            this.metaWs = null;
        }
        this.onDisconnect();
    }

    // Binary protocol decoder
    private async handleBinaryMessage(data: ArrayBuffer | Blob, source: 'primary' | 'meta'): Promise<void> {
        let buffer: ArrayBuffer;
        
        if (data instanceof Blob) {
            buffer = await data.arrayBuffer();
        } else {
            buffer = data;
        }

        // Handle batched messages (multiple messages concatenated)
        let offset = 0;
        const totalLength = buffer.byteLength;
        
        while (offset < totalLength) {
            // Check if we have at least 1 byte for message type
            if (offset >= totalLength) {
                break;
            }
            
            const view = new DataView(buffer, offset);
            
            // Check if there's at least 1 byte for the message type
            if (view.byteLength < 1) {
                console.warn('Not enough bytes for message type at offset', offset);
                break;
            }
            
            const msgType = view.getUint8(0);
            
            let messageLength = 0;
            
            try {
                switch (msgType) {
                    case 1: // Welcome
                        messageLength = this.decodeWelcome(view);
                        break;
                    case 2: // State
                        messageLength = this.decodeGameState(view);
                        break;
                    case 3: // Pong
                        messageLength = 1;
                        break;
                    case 4: // Leaderboard
                        messageLength = this.decodeLeaderboard(view);
                        break;
                    case 5: // PlayerInfo
                        messageLength = this.decodePlayerInfo(view);
                        break;
                    default:
                        console.warn('Unknown message type:', msgType, 'at offset', offset);
                        return; // Can't continue if we don't know the length
                }
                
                // Validate message length
                if (messageLength <= 0 || messageLength > view.byteLength) {
                    console.error('Invalid message length:', messageLength, 'for type', msgType, 'at offset', offset);
                    return;
                }
                
                offset += messageLength;
            } catch (error) {
                console.error('Error decoding message type', msgType, 'at offset', offset, ':', error);
                return;
            }
        }
    }

    private decodeWelcome(view: DataView): number {
        let offset = 1;
        
        // ID string
        const { str: id, newOffset: idOffset } = this.readString(view, offset);
        offset = idOffset;
        
        // Name string
        const { str: name, newOffset: nameOffset } = this.readString(view, offset);
        offset = nameOffset;
        
        // Model string
        const { str: model, newOffset: modelOffset } = this.readString(view, offset);
        offset = modelOffset;
        
        // World dimensions
        const worldWidth = view.getFloat64(offset);
        offset += 8;
        const worldHeight = view.getFloat64(offset);
        offset += 8;
        
        // Cache our client ID and info
        this.clientId = id;
        this.playerInfoCache.set(id, { name, model });
        
        this.onWelcome({
            id,
            worldWidth,
            worldHeight,
        });
        
        return offset; // Return total bytes consumed
    }

    private decodeGameState(view: DataView): number {
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
        
        // Leaderboard no longer sent with state - use cached
        const leaderboard = this.lastGameState?.leaderboard || [];
        
        // Merge player with cached info
        const fullPlayer = {
            ...player,
            id: this.clientId || '',
            name: this.playerInfoCache.get(this.clientId || '')?.name || '',
            model: this.playerInfoCache.get(this.clientId || '')?.model || '',
        };
        
        const state = {
            you: fullPlayer,
            others,
            food,
            leaderboard,
        };
        
        this.lastGameState = state;
        this.onStateUpdate(state);
        
        return offset; // Return total bytes consumed
    }

    private decodeLeaderboard(view: DataView): number {
        let offset = 1;
        const count = view.getUint8(offset);
        offset += 1;
        
        const leaderboard: any[] = [];
        for (let i = 0; i < count; i++) {
            const { entry, newOffset } = this.decodeLeaderboardEntry(view, offset);
            leaderboard.push(entry);
            offset = newOffset;
        }
        
        // Merge with last game state
        if (this.lastGameState) {
            this.lastGameState.leaderboard = leaderboard;
            this.onStateUpdate(this.lastGameState);
        }
        
        return offset; // Return total bytes consumed
    }

    private decodePlayerState(view: DataView, offset: number): { player: any; newOffset: number } {
        const startOffset = offset;
        
        // Flags
        const flags = view.getUint8(offset++);
        const alive = (flags & 1) !== 0;
        const hasKilledBy = (flags & 2) !== 0;
        const hasRespawnIn = (flags & 4) !== 0;
        
        console.log('decodePlayerState: offset', startOffset, 'flags', flags.toString(2), 'alive', alive, 'hasKilledBy', hasKilledBy, 'hasRespawnIn', hasRespawnIn);
        
        // No ID, Name, Model - those are cached from welcome/playerInfo
        
        // Position, velocity, rotation, size
        const x = view.getFloat32(offset); offset += 4;
        const y = view.getFloat32(offset); offset += 4;
        const velX = view.getFloat32(offset); offset += 4;
        const velY = view.getFloat32(offset); offset += 4;
        const rotation = view.getFloat32(offset); offset += 4;
        const size = view.getFloat32(offset); offset += 4;
        
        console.log('decodePlayerState: position', {x, y, velX, velY, rotation, size}, 'offset now', offset);
        
        // Score and seq
        const score = view.getUint32(offset); offset += 4;
        const seq = view.getUint32(offset); offset += 4;
        
        console.log('decodePlayerState: score', score, 'seq', seq, 'offset now', offset);
        
        // Optional fields
        let killedBy: string | undefined;
        let respawnIn: number | undefined;
        
        if (hasKilledBy) {
            console.log('decodePlayerState: reading killedBy string at offset', offset, 'view length', view.byteLength);
            const { str, newOffset } = this.readString(view, offset);
            killedBy = str;
            offset = newOffset;
            console.log('decodePlayerState: killedBy', killedBy, 'offset now', offset);
        }
        
        if (hasRespawnIn) {
            respawnIn = view.getFloat32(offset);
            offset += 4;
            console.log('decodePlayerState: respawnIn', respawnIn, 'offset now', offset);
        }
        
        return {
            player: { x, y, velX, velY, rotation, size, score, alive, seq, killedBy, respawnIn },
            newOffset: offset
        };
    }

    private decodeOtherPlayer(view: DataView, offset: number): { other: any; newOffset: number } {
        const { str: id, newOffset: idOffset } = this.readString(view, offset);
        offset = idOffset;
        
        // Position data only - name/model from cache
        const x = view.getFloat32(offset); offset += 4;
        const y = view.getFloat32(offset); offset += 4;
        const velX = view.getFloat32(offset); offset += 4;
        const velY = view.getFloat32(offset); offset += 4;
        const rotation = view.getFloat32(offset); offset += 4;
        const size = view.getFloat32(offset); offset += 4;
        
        // Get cached name/model
        const cachedInfo = this.playerInfoCache.get(id);
        const name = cachedInfo?.name || 'Unknown';
        const model = cachedInfo?.model || 'swordfish';
        
        return {
            other: { id, name, model, x, y, velX, velY, rotation, size },
            newOffset: offset
        };
    }

    private decodePlayerInfo(view: DataView): number {
        let offset = 1;
        
        const { str: id, newOffset: idOffset } = this.readString(view, offset);
        offset = idOffset;
        
        const { str: name, newOffset: nameOffset } = this.readString(view, offset);
        offset = nameOffset;
        
        const { str: model, newOffset: modelOffset } = this.readString(view, offset);
        offset = modelOffset;
        
        // Cache player info
        this.playerInfoCache.set(id, { name, model });
        
        return offset;
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
        console.log('readString: offset', offset, 'view.byteLength', view.byteLength, 'remaining bytes', view.byteLength - offset);
        
        // Check if we have enough bytes to read the length
        if (offset + 2 > view.byteLength) {
            throw new Error(`readString: Not enough bytes for length at offset ${offset}, view length: ${view.byteLength}`);
        }
        
        const length = view.getUint16(offset);
        console.log('readString: length value read:', length, 'bytes at offset', offset, '[', view.getUint8(offset), view.getUint8(offset + 1), ']');
        offset += 2;
        
        // Validate string length
        if (length > 10000) { // Reasonable max string length
            throw new Error(`readString: Invalid string length ${length} at offset ${offset - 2}`);
        }
        
        // Check if we have enough bytes for the string content
        if (offset + length > view.byteLength) {
            throw new Error(`readString: Not enough bytes for string content. Need ${length} bytes at offset ${offset}, view length: ${view.byteLength}`);
        }
        
        const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
        const str = new TextDecoder().decode(bytes);
        console.log('readString: decoded string:', str);
        return { str, newOffset: offset + length };
    }
}
