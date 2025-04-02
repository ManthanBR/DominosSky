import { createMediaStreamSource, Transform2D } from "@snap/camera-kit";
import { Settings } from "./settings";

export class CameraManager {
    constructor() {
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.isBackFacing = false;
        this.mediaStream = null;
        this.currentSource = null; // Keep track of the current source
    }

    async initializeCamera() {
        if (this.mediaStream) {
             this.mediaStream.getTracks().forEach((track) => track.stop());
             this.mediaStream = null;
        }

        if (!this.isMobile) {
            document.body.classList.add("desktop");
        }

        const constraints = this.getConstraints();
        console.log("Requesting media with constraints:", constraints);
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Media stream obtained:", this.mediaStream);
        return this.mediaStream; // Return the stream for initial setup
    }

    // updateCamera now takes the session and updates it directly
    async updateCamera(session) {
        this.isBackFacing = !this.isBackFacing;
        console.log(`Switching camera to: ${this.isBackFacing ? 'back' : 'front'}`);

        // Stop existing tracks before getting new ones
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => {
                track.stop();
            });
            this.mediaStream = null;
            console.log("Previous media stream stopped.");
        }
        // If there's an existing source on the session, destroy it
        // Note: CameraKit doesn't have an explicit source.destroy(),
        // setting a new source handles cleanup internally.
        // if (this.currentSource) {
        //     console.log("Destroying previous source (handled by setSource).");
        // }

        try {
            // Pause session during switch to avoid potential rendering issues
            await session.pause();
            console.log("Session paused for camera switch.");

            this.mediaStream = await navigator.mediaDevices.getUserMedia(this.getConstraints());
             console.log("New media stream obtained:", this.mediaStream);

            const newSource = createMediaStreamSource(this.mediaStream, {
                cameraType: this.isBackFacing ? "environment" : "user",
                disableSourceAudio: false, // Ensure audio is captured
            });
            this.currentSource = newSource; // Update tracked source

            console.log("Setting new source on session...");
            await session.setSource(newSource);
             console.log("New source set.");

            // Apply transform immediately after setting source
            if (!this.isBackFacing) {
                console.log("Applying MirrorX transform for front camera.");
                newSource.setTransform(Transform2D.MirrorX);
            } else {
                 console.log("Applying None transform for back camera.");
                newSource.setTransform(Transform2D.None); // Explicitly remove mirroring for back camera
            }

            await session.play();
            console.log("Session resumed after camera switch.");
            // No need to return source, main.js uses the outer scope variable 'source'
            // which gets updated when setSource is called on the session.
            // OR, more accurately, the reference held by main.js needs to point to the NEW source.
            // Let's modify main.js slightly to handle this.

        } catch (error) {
            console.error("Failed to switch camera or set new source:", error);
             // Attempt to revert state? Or just throw?
             // Reverting might be complex, best to let the caller handle the error.
             await session.play().catch(e => console.error("Failed to resume session after error:", e)); // Try to resume session even on error
            throw error; // Re-throw error to be caught in main.js
        }
    }

    getConstraints() {
        const constraints = this.isMobile
            ? (this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front)
            : Settings.camera.constraints.desktop;
         // Ensure audio is always requested if needed for recording
         constraints.audio = true; // Force audio constraint
        return constraints;
    }
}