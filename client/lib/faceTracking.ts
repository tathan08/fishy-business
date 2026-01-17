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

                    // Send input to connection
                    this.connection.setInput(finalDirX, finalDirY, false);
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
