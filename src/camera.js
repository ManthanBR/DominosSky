import { createMediaStreamSource, Transform2D } from "@snap/camera-kit";
import { Settings } from "./settings";

export class CameraManager {
  constructor() {
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.isBackFacing = false; // Start with front camera
    this.mediaStream = null;
    this.currentSource = null; // Keep track of the current source object

    // Add desktop class immediately if not mobile
    if (!this.isMobile) {
      document.body.classList.add("desktop");
    }
  }

  async initializeCamera() {
    console.log("Initializing camera...");
    // Stop existing tracks if any (e.g., re-initialization)
    this.stopMediaStreamTracks();

    this.isBackFacing = false; // Ensure we start with front
    const constraints = this.getConstraints();
    console.log("Using constraints:", JSON.stringify(constraints));
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("Initial MediaStream obtained");
    return this.mediaStream; // Return the stream for initial source creation
  }

  // Helper to stop existing tracks
  stopMediaStreamTracks() {
      if (this.mediaStream) {
          console.log("Stopping existing MediaStream tracks...");
          this.mediaStream.getTracks().forEach((track) => {
              track.stop();
              console.log(`Stopped track: ${track.label || track.id}`);
          });
          this.mediaStream = null;
      }
  }


  async updateCamera(session) {
    console.log(`Switching camera. Current facing back: ${this.isBackFacing}`);
    this.isBackFacing = !this.isBackFacing; // Toggle state

    // Pause session and stop current stream tracks *before* getting new stream
    await session.pause(); // Pause rendering during switch
    this.stopMediaStreamTracks(); // Stop tracks of the *old* stream

    try {
      const constraints = this.getConstraints();
      console.log("Requesting new MediaStream with constraints:", JSON.stringify(constraints));
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("New MediaStream obtained");

      // Create a *new* source object for the new stream
      const newSource = createMediaStreamSource(this.mediaStream, {
        cameraType: this.isBackFacing ? "environment" : "user",
        // Ensure disableSourceAudio matches your intent for recording
        disableSourceAudio: false,
      });
      this.currentSource = newSource; // Update tracked source

      console.log("Setting new source on session");
      await session.setSource(newSource);

      // Apply transform based on the *new* camera direction
      if (!this.isBackFacing) { // Mirror front camera
          console.log("Applying MirrorX transform");
        newSource.setTransform(Transform2D.MirrorX);
      } else {
          console.log("Applying No transform (back camera)");
        newSource.setTransform(Transform2D.NoTransform); // Explicitly set no transform
      }

      // Set render size on the new source *before* playing
      // The size update logic might be better handled in main.js after this returns
      // await newSource.setRenderSize(window.innerWidth, window.innerHeight); // Ensure size is set

      console.log("Resuming session playback");
      await session.play();
      console.log("Camera switch complete.");
      return newSource; // Return the newly created source

    } catch (error) {
      console.error("Failed to get new media stream or update session:", error);
      // Attempt to revert state? Or alert user?
      this.isBackFacing = !this.isBackFacing; // Revert toggle if failed
       alert(`Failed to switch camera: ${error.message}`);
      // Try to restart the previous stream/source? Complex recovery.
      // For now, just re-throw to be handled by caller.
      await session.play(); // Try to resume session even if switch failed
      throw error;
    }
  }

  getConstraints() {
    let constraints;
    if (this.isMobile) {
        constraints = this.isBackFacing ? Settings.camera.constraints.back : Settings.camera.constraints.front;
    } else {
        constraints = Settings.camera.constraints.desktop;
    }
    // Deep clone constraints to avoid modification issues if any library modifies them
    return JSON.parse(JSON.stringify(constraints));
  }

   // Expose the current source if needed externally
   getSource() {
     return this.currentSource;
   }
}