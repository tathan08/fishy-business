// ============================================
// Input handling for WASD keyboard controls
// ============================================

import { GameConnection } from "./connection";

export class InputHandler {
    private connection: GameConnection;
    private boost = false;
    private canvas: HTMLCanvasElement;

    // Track which keys are pressed
    private keys = {
        w: false,
        a: false,
        s: false,
        d: false,
    };

    constructor(connection: GameConnection, canvas: HTMLCanvasElement) {
        this.connection = connection;
        this.canvas = canvas;
        console.log('InputHandler initialized with canvas:', canvas);
        this.setupListeners();
        this.startInputLoop();
    }

    private setupListeners(): void {
        // Keyboard movement (WASD)
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key === 'w') this.keys.w = true;
            if (key === 'a') this.keys.a = true;
            if (key === 's') this.keys.s = true;
            if (key === 'd') this.keys.d = true;

            // Spacebar for boost
            if (e.code === 'Space') {
                e.preventDefault();
                this.boost = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key === 'w') this.keys.w = false;
            if (key === 'a') this.keys.a = false;
            if (key === 's') this.keys.s = false;
            if (key === 'd') this.keys.d = false;

            if (e.code === 'Space') {
                e.preventDefault();
                this.boost = false;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);

        // Store cleanup function
        this.cleanup = () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
            this.stopInputLoop();
        };
    }

    private inputInterval: number | null = null;

    private startInputLoop(): void {
        // Update direction based on keys every frame
        this.inputInterval = window.setInterval(() => {
            this.updateDirection();
        }, 16); // ~60 FPS
    }

    private stopInputLoop(): void {
        if (this.inputInterval) {
            clearInterval(this.inputInterval);
            this.inputInterval = null;
        }
    }

    private updateDirection(): void {
        let dirX = 0;
        let dirY = 0;

        // Calculate direction based on pressed keys
        if (this.keys.w) dirY -= 1; // Up
        if (this.keys.s) dirY += 1; // Down
        if (this.keys.a) dirX -= 1; // Left
        if (this.keys.d) dirX += 1; // Right

        // Normalize direction to length 1
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len > 0) {
            dirX /= len;
            dirY /= len;
        }

        this.connection.setInput(dirX, dirY, this.boost);
    }

    private cleanup: (() => void) | null = null;

    destroy(): void {
        if (this.cleanup) {
            this.cleanup();
        }
    }
}
