// ============================================
// Face tracking for input control using MediaPipe
// ============================================

import { GameConnection } from "./connection";

// Type definitions for MediaPipe
type FaceLandmarker = any;
type FilesetResolver = any;

export class FaceTrackingInput {
    private connection: GameConnection;
    private videoElement: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private animationFrameId: number | null = null;
    private isActive = false;
    
    // Face detection state
    private centerX = 0;
    private centerY = 0;
    private calibrated = false;
    
    // Smoothing
    private smoothedDirX = 0;
    private smoothedDirY = 0;
    private readonly smoothing = 0.85;
    
    // Sensitivity
    private readonly sensitivity = 0.02;
    
    // MediaPipe variables
    private faceLandmarker: FaceLandmarker | null = null;
    private lastVideoTime = -1;
    
    // Current direction (for UI feedback)
    public currentDirX = 0;
    public currentDirY = 0;
    
    // Boost state (mouth detection)
    private isBoosting = false;
    private boostMeter = 100; // 0-100%
    private readonly BOOST_DRAIN_RATE = 20;   // % per second when boosting
    private readonly BOOST_RECHARGE_RATE = 15; // % per second when not boosting
    private lastBoostUpdate = Date.now();
    private readonly MOUTH_OPEN_THRESHOLD = 0.15; // Threshold for mouth aspect ratio
    
    // Smoothing for mouth detection to prevent flickering
    private mouthOpenSmoothBuffer: boolean[] = [];
    private readonly MOUTH_SMOOTH_FRAMES = 3; // Number of frames to smooth over
    
    // Track previous state to only send changes
    private lastSentDirX = 0;
    private lastSentDirY = 0;
    private lastSentBoosting = false;
    
    // Current boost status (for UI feedback)
    public currentIsBoosting = false;
    public currentBoostMeter = 100;
    
    onCalibrated: () => void = () => {};
    onError: (error: string) => void = () => {};

    constructor(connection: GameConnection) {
        this.connection = connection;
    }

    async start(): Promise<void> {
        try {
            console.log('Face tracking: Starting...');
            
            // Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.style.display = 'none';
            this.videoElement.width = 320;
            this.videoElement.height = 240;
            this.videoElement.autoplay = true;
            document.body.appendChild(this.videoElement);

            console.log('Face tracking: Requesting camera access...');
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 320,
                    height: 240,
                    facingMode: 'user'
                }
            });

            console.log('Face tracking: Camera access granted');

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();

            console.log('Face tracking: Video playing, loading MediaPipe...');

            // Load MediaPipe Face Landmarker
            await this.loadFaceLandmarker();
            
            console.log('Face tracking: MediaPipe loaded, starting tracking...');
            
            this.isActive = true;
            this.startTracking();
        } catch (error) {
            console.error('Face tracking error:', error);
            this.onError(`Failed to start face tracking: ${error}`);
            this.stop();
        }
    }

    private async loadFaceLandmarker(): Promise<void> {
        try {
            console.log('Loading MediaPipe module...');
            
            // Dynamically import MediaPipe only on client side
            const mediapipe = await import('@mediapipe/tasks-vision');
            const { FaceLandmarker, FilesetResolver } = mediapipe;

            console.log('MediaPipe module loaded, initializing vision tasks...');

            const vision: FilesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            console.log('Vision tasks initialized, creating face landmarker...');

            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false,
                runningMode: "VIDEO",
                numFaces: 1
            });
            
            console.log('Face landmarker created successfully');
        } catch (error) {
            console.error('MediaPipe loading error:', error);
            throw new Error(`Failed to load MediaPipe: ${error}`);
        }
    }

    private async processFrame(): Promise<void> {
        if (!this.isActive || !this.videoElement || !this.faceLandmarker) {
            return;
        }

        const videoTime = this.videoElement.currentTime;
        
        // Only process if we have a new frame
        if (videoTime !== this.lastVideoTime) {
            this.lastVideoTime = videoTime;

            const results = this.faceLandmarker.detectForVideo(this.videoElement, performance.now());
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];
                
                // Nose tip landmark (index 1)
                const nose = landmarks[1];
                const noseX = nose.x;
                const noseY = nose.y;
                
                // Detect mouth opening for boost
                // Upper lip: indices 13, 14
                // Lower lip: indices 312, 402
                // Mouth corners: indices 61, 291
                const upperLipTop = landmarks[13];
                const lowerLipBottom = landmarks[14];
                const mouthLeft = landmarks[61];
                const mouthRight = landmarks[291];
                
                // Calculate mouth aspect ratio (MAR)
                const verticalDist = Math.sqrt(
                    Math.pow(lowerLipBottom.x - upperLipTop.x, 2) +
                    Math.pow(lowerLipBottom.y - upperLipTop.y, 2)
                );
                const horizontalDist = Math.sqrt(
                    Math.pow(mouthRight.x - mouthLeft.x, 2) +
                    Math.pow(mouthRight.y - mouthLeft.y, 2)
                );
                const mouthAspectRatio = verticalDist / (horizontalDist + 0.001); // Avoid division by zero
                
                // Detect if mouth is open
                const mouthIsOpen = mouthAspectRatio > this.MOUTH_OPEN_THRESHOLD;
                
                // Add to smoothing buffer
                this.mouthOpenSmoothBuffer.push(mouthIsOpen);
                if (this.mouthOpenSmoothBuffer.length > this.MOUTH_SMOOTH_FRAMES) {
                    this.mouthOpenSmoothBuffer.shift();
                }
                
                // Consider mouth open if majority of recent frames detected it as open
                const openCount = this.mouthOpenSmoothBuffer.filter(x => x).length;
                const smoothedMouthOpen = openCount >= Math.ceil(this.MOUTH_SMOOTH_FRAMES / 2);
                
                // Update boost state based on smoothed mouth opening
                this.updateBoostState(smoothedMouthOpen);

                if (!this.calibrated) {
                    // Calibrate center position
                    this.centerX = noseX;
                    this.centerY = noseY;
                    this.calibrated = true;
                    this.onCalibrated();
                } else {
                    // Calculate direction based on nose position relative to center
                    // Invert X because camera is mirrored
                    const rawDirX = -(noseX - this.centerX) / this.sensitivity;
                    const rawDirY = (noseY - this.centerY) / this.sensitivity;

                    // Apply smoothing
                    this.smoothedDirX = this.smoothedDirX * this.smoothing + rawDirX * (1 - this.smoothing);
                    this.smoothedDirY = this.smoothedDirY * this.smoothing + rawDirY * (1 - this.smoothing);

                    // Clamp values
                    const clampedDirX = Math.max(-1, Math.min(1, this.smoothedDirX));
                    const clampedDirY = Math.max(-1, Math.min(1, this.smoothedDirY));

                    // Normalize
                    const length = Math.sqrt(clampedDirX * clampedDirX + clampedDirY * clampedDirY);
                    let finalDirX = clampedDirX;
                    let finalDirY = clampedDirY;
                    
                    if (length > 1) {
                        finalDirX /= length;
                        finalDirY /= length;
                    }

                    // Store current direction for UI feedback
                    this.currentDirX = finalDirX;
                    this.currentDirY = finalDirY;

                    // Only send input if direction or boost state changed significantly
                    const dirChanged = Math.abs(finalDirX - this.lastSentDirX) > 0.01 || 
                                      Math.abs(finalDirY - this.lastSentDirY) > 0.01;
                    const boostChanged = this.isBoosting !== this.lastSentBoosting;
                    
                    if (dirChanged || boostChanged) {
                        // Send input to connection with boost status
                        this.connection.setInput(finalDirX, finalDirY, this.isBoosting);
                        
                        // Update last sent state
                        this.lastSentDirX = finalDirX;
                        this.lastSentDirY = finalDirY;
                        this.lastSentBoosting = this.isBoosting;
                    }
                }
            } else {
                // No face detected - treat mouth as closed but keep recharging boost
                this.updateBoostState(false);
                
                // Send boost state change if needed
                if (this.calibrated && this.isBoosting !== this.lastSentBoosting) {
                    this.connection.setInput(this.lastSentDirX, this.lastSentDirY, this.isBoosting);
                    this.lastSentBoosting = this.isBoosting;
                }
            }
        }

        // Schedule next frame
        if (this.isActive) {
            this.animationFrameId = requestAnimationFrame(() => this.processFrame());
        }
    }

    private startTracking(): void {
        this.processFrame();
    }

    private updateBoostState(mouthIsOpen: boolean): void {
        const now = Date.now();
        const deltaTime = (now - this.lastBoostUpdate) / 1000; // seconds
        this.lastBoostUpdate = now;

        // Determine if we should be boosting: mouth open AND meter has charge
        if (mouthIsOpen && this.boostMeter > 0) {
            this.isBoosting = true;
            // Drain meter when boosting
            this.boostMeter -= this.BOOST_DRAIN_RATE * deltaTime;
            if (this.boostMeter <= 0) {
                this.boostMeter = 0;
                this.isBoosting = false; // Auto-stop when empty
            }
        } else {
            // Not boosting - either mouth closed or meter empty
            this.isBoosting = false;
            // Recharge meter when not boosting
            if (this.boostMeter < 100) {
                this.boostMeter += this.BOOST_RECHARGE_RATE * deltaTime;
                if (this.boostMeter > 100) {
                    this.boostMeter = 100;
                }
            }
        }
        
        // Update public properties for UI feedback
        this.currentIsBoosting = this.isBoosting;
        this.currentBoostMeter = this.boostMeter;
    }
    
    public getBoostMeter(): number {
        return this.boostMeter;
    }
    
    public getIsBoosting(): boolean {
        return this.isBoosting;
    }

    recalibrate(): void {
        this.calibrated = false;
        this.smoothedDirX = 0;
        this.smoothedDirY = 0;
    }

    stop(): void {
        this.isActive = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.videoElement) {
            this.videoElement.remove();
        }

        if (this.faceLandmarker) {
            this.faceLandmarker.close();
        }
    }
}
