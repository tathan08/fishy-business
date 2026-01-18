// ============================================
// Face tracking for racing input control
// ============================================

import { RacingConnection } from "./racingConnection";

type FaceLandmarker = any;
type FilesetResolver = any;

export class RacingFaceTrackingInput {
    private connection: RacingConnection;
    private videoElement: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private animationFrameId: number | null = null;
    private isActive = false;
    private stateUpdateInterval: number | null = null;
    private countingEnabled = true; // Controls whether cycles are counted
    private delayTimeoutId: number | null = null; // Timeout for 4 second delay

    // MediaPipe variables
    private faceLandmarker: FaceLandmarker | null = null;
    private lastVideoTime = -1;

    // Mouth detection
    private readonly MOUTH_OPEN_THRESHOLD = 0.45;
    private mouthOpenSmoothBuffer: boolean[] = [];
    private readonly MOUTH_SMOOTH_FRAMES = 3;
    private lastMouthState: boolean = false;
    private mouthCycles: number = 0;

    // Callbacks
    onCalibrated: () => void = () => {};
    onError: (error: string) => void = () => {};
    onMouthStateChange: (isOpen: boolean) => void = () => {};
    onDebugData: (data: { verticalDist: number; horizontalDist: number; aspectRatio: number; threshold: number }) => void = () => {};
    onCycleCount: (count: number) => void = () => {};

    constructor(connection: RacingConnection) {
        this.connection = connection;
    }

    // Start 4 second delay (called when countdown starts)
    startCountdownDelay(): void {
        console.log('Racing face tracking: Starting 4 second delay, pausing cycle counting');
        this.countingEnabled = false;
        this.mouthCycles = 0;
        this.lastMouthState = false;
        this.mouthOpenSmoothBuffer = [];
        this.onCycleCount(0);
        
        // Clear any existing timeout
        if (this.delayTimeoutId !== null) {
            clearTimeout(this.delayTimeoutId);
        }
        
        // Re-enable counting after 4 seconds
        this.delayTimeoutId = window.setTimeout(() => {
            console.log('Racing face tracking: 4 second delay complete, enabling cycle counting');
            this.countingEnabled = true;
            this.delayTimeoutId = null;
        }, 4000);
    }

    // Reset mouth cycles to 0 (called when race starts)
    resetCycles(): void {
        console.log('Racing face tracking: Resetting cycle count to 0');
        this.mouthCycles = 0;
        this.lastMouthState = false;
        this.mouthOpenSmoothBuffer = [];
        this.onCycleCount(0);
    }

    async start(): Promise<void> {
        try {
            console.log('Racing face tracking: Starting...');

            // Reset tracking state
            this.mouthCycles = 0;
            this.lastMouthState = false;
            this.mouthOpenSmoothBuffer = [];

            // Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.style.display = 'none';
            this.videoElement.width = 320;
            this.videoElement.height = 240;
            this.videoElement.autoplay = true;
            document.body.appendChild(this.videoElement);

            console.log('Racing face tracking: Requesting camera access...');

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 320,
                    height: 240,
                    facingMode: 'user'
                }
            });

            console.log('Racing face tracking: Camera access granted');

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();

            console.log('Racing face tracking: Video playing, loading MediaPipe...');

            // Load MediaPipe Face Landmarker
            await this.loadFaceLandmarker();

            console.log('Racing face tracking: MediaPipe loaded, starting tracking...');

            this.isActive = true;
            this.trackFace();

            console.log('Racing face tracking: Active!');
            this.onCalibrated();

            // Start sending state updates to server every 1 second (after everything is set up)
            console.log('Racing: Setting up state update interval');
            this.stateUpdateInterval = window.setInterval(() => {
                console.log("Interval tick: sending state update with mouthCycles =", this.mouthCycles);
                this.connection.sendStateUpdate(this.mouthCycles);
            }, 1000);

        } catch (error) {
            console.error('Racing face tracking error:', error);
            this.onError(error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    private async loadFaceLandmarker(): Promise<void> {
        try {
            // Dynamically import MediaPipe
            const vision = await import('@mediapipe/tasks-vision');
            const { FaceLandmarker, FilesetResolver } = vision;

            console.log('Racing: Loading MediaPipe model...');

            const filesetResolver = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
            );

            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: false,
                runningMode: 'VIDEO',
                numFaces: 1
            });

            console.log('Racing: MediaPipe model loaded successfully');
        } catch (error) {
            console.error('Racing: Failed to load MediaPipe:', error);
            throw error;
        }
    }

    private trackFace(): void {
        if (!this.isActive || !this.videoElement || !this.faceLandmarker) {
            return;
        }

        const track = () => {
            if (!this.isActive || !this.videoElement || !this.faceLandmarker) {
                return;
            }

            const videoTime = this.videoElement.currentTime;

            // Only process if we have a new frame
            if (videoTime !== this.lastVideoTime) {
                this.lastVideoTime = videoTime;

                try {
                    const results = this.faceLandmarker.detectForVideo(
                        this.videoElement,
                        performance.now()
                    );

                    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                        this.processFaceData(results);
                    }
                } catch (error) {
                    console.error('Racing: Error detecting face:', error);
                }
            }

            this.animationFrameId = requestAnimationFrame(track);
        };

        track();
    }

    private processFaceData(results: any): void {
        const landmarks = results.faceLandmarks[0];

        // Calculate mouth aspect ratio
        const mouthAspectRatio = this.calculateMouthAspectRatio(landmarks);

        // Determine if mouth is open
        const isMouthOpen = mouthAspectRatio > this.MOUTH_OPEN_THRESHOLD;

        // Add to smoothing buffer
        this.mouthOpenSmoothBuffer.push(isMouthOpen);
        if (this.mouthOpenSmoothBuffer.length > this.MOUTH_SMOOTH_FRAMES) {
            this.mouthOpenSmoothBuffer.shift();
        }

        // Use majority vote for smoothing
        const openCount = this.mouthOpenSmoothBuffer.filter(x => x).length;
        const smoothedMouthOpen = openCount > this.MOUTH_SMOOTH_FRAMES / 2;

        // Detect complete cycle: open → close (only if counting is enabled)
        if (this.countingEnabled && this.lastMouthState && !smoothedMouthOpen && this.mouthCycles < 50) {
            // Mouth just closed after being open - one complete cycle
            this.mouthCycles++;
            this.connection.sendMouthCycle();
            this.onCycleCount(this.mouthCycles);
        }
        
        this.lastMouthState = smoothedMouthOpen;

        // Call callback
        this.onMouthStateChange(smoothedMouthOpen);
    }

    private calculateMouthAspectRatio(landmarks: any[]): number {
        // Mouth landmarks indices (based on MediaPipe Face Mesh)
        // Upper lip: 13, 14
        // Lower lip: 17, 18
        // Left corner: 61
        // Right corner: 291

        const upperLip = landmarks[13];
        const lowerLip = landmarks[17];
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];

        // Calculate vertical distance (mouth height)
        const verticalDist = Math.sqrt(
            Math.pow(upperLip.x - lowerLip.x, 2) +
            Math.pow(upperLip.y - lowerLip.y, 2) +
            Math.pow(upperLip.z - lowerLip.z, 2)
        );

        // Calculate horizontal distance (mouth width)
        const horizontalDist = Math.sqrt(
            Math.pow(leftCorner.x - rightCorner.x, 2) +
            Math.pow(leftCorner.y - rightCorner.y, 2) +
            Math.pow(leftCorner.z - rightCorner.z, 2)
        );

        // Aspect ratio = height / width
        const aspectRatio = horizontalDist > 0 ? verticalDist / horizontalDist : 0;
        
        // Send debug data
        this.onDebugData({
            verticalDist,
            horizontalDist,
            aspectRatio,
            threshold: this.MOUTH_OPEN_THRESHOLD
        });
        
        return aspectRatio;
    }

    stop(): void {
        console.log('Racing face tracking: Stopping...');

        this.isActive = false;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.stateUpdateInterval !== null) {
            clearInterval(this.stateUpdateInterval);
            this.stateUpdateInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement.remove();
            this.videoElement = null;
        }

        if (this.faceLandmarker) {
            this.faceLandmarker.close();
            this.faceLandmarker = null;
        }

        console.log('Racing face tracking: Stopped');
    }
}
