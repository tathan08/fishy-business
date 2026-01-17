// ============================================
// Input handling for WASD keyboard controls
// ============================================

import { GameConnection } from "./connection";

export class InputHandler {
    private connection: GameConnection;
    private isBoosting = false;
    private boostMeter = 100; // 0-100%
    private canvas: HTMLCanvasElement;

    // Boost configuration
    private readonly BOOST_DRAIN_RATE = 20;   // % per second when boosting
    private readonly BOOST_RECHARGE_RATE = 15; // % per second when not boosting
    private lastBoostUpdate = Date.now();

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

            // Spacebar toggles boost ON (only if meter > 0)
            if (e.code === 'Space') {
                e.preventDefault(); // Always prevent scroll
                if (!e.repeat && this.boostMeter > 0) {
                    this.isBoosting = true;
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key === 'w') this.keys.w = false;
            if (key === 'a') this.keys.a = false;
            if (key === 's') this.keys.s = false;
            if (key === 'd') this.keys.d = false;

            // Spacebar toggles boost OFF
            if (e.code === 'Space') {
                e.preventDefault(); // Always prevent scroll
                if (!e.repeat) {
                    this.isBoosting = false;
                }
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

    private updateBoostMeter(): void {
        const now = Date.now();
        const deltaTime = (now - this.lastBoostUpdate) / 1000; // seconds
        this.lastBoostUpdate = now;

        if (this.isBoosting && this.boostMeter > 0) {
            // Drain meter when boosting
            this.boostMeter -= this.BOOST_DRAIN_RATE * deltaTime;
            if (this.boostMeter <= 0) {
                this.boostMeter = 0;
                this.isBoosting = false; // Auto-stop when empty
            }
        } else if (!this.isBoosting && this.boostMeter < 100) {
            // Recharge meter when not boosting
            this.boostMeter += this.BOOST_RECHARGE_RATE * deltaTime;
            if (this.boostMeter > 100) {
                this.boostMeter = 100;
            }
        }
    }

    private updateDirection(): void {
        // Update boost meter
        this.updateBoostMeter();

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

        this.connection.setInput(dirX, dirY, this.isBoosting);
    }

    // Public methods to get boost state
    public getBoostMeter(): number {
        return this.boostMeter;
    }

    public getIsBoosting(): boolean {
        return this.isBoosting;
    }

    private cleanup: (() => void) | null = null;

    destroy(): void {
        if (this.cleanup) {
            this.cleanup();
        }
    }
}
