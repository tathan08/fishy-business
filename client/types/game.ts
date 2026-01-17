// ============================================
// Types matching backend protocol
// ============================================

export type FishModel = 'swordfish' | 'blobfish' | 'pufferfish' | 'shark' | 'sacabambaspis';

export interface JoinMessage {
    type: "join";
    name: string;
    model?: FishModel;
}

export interface InputMessage {
    type: "input";
    dirX: number;
    dirY: number;
    boost: boolean;
    seq: number;
}

export interface PingMessage {
    type: "ping";
}

export type ClientMessage = JoinMessage | InputMessage | PingMessage;

export interface PlayerState {
    id: string;
    name?: string;
    x: number;
    y: number;
    velX?: number;
    velY?: number;
    rotation?: number;
    size: number;
    score?: number;
    alive?: boolean;
    seq?: number;
    killedBy?: string | null;
    respawnIn?: number | null;
    model?: FishModel;
}

export interface FoodState {
    id: number;
    x: number;
    y: number;
    r: number;
}

export interface LeaderboardEntry {
    name: string;
    score: number;
}

export interface GameStatePayload {
    you: PlayerState;
    others: PlayerState[];
    food: FoodState[];
    leaderboard: LeaderboardEntry[];
}

export interface WelcomePayload {
    id: string;
    worldWidth: number;
    worldHeight: number;
}

export interface ServerMessage {
    type: "welcome" | "state" | "pong" | "leaderboard";
    payload?: WelcomePayload | GameStatePayload | LeaderboardEntry[];
}
