/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import "./styles/index.v3.css" // Ensure CSS is imported
import { CameraManager } from "./camera"
import { MediaRecorderManager } from "./recorder"
import { UIManager } from "./ui"
import { VideoProcessor } from "./videoProcessor"
import { Settings } from "./settings"
;(async function () {
  // Get environment variables
  const apiToken = process.env.API_TOKEN
  const lensID = process.env.LENS_ID
  const groupID = process.env.GROUP_ID

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables (API_TOKEN, LENS_ID, GROUP_ID). Please check your .env file or environment settings.")
    // Optionally display a message to the user
    document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>Configuration Error</h1>
        <p>Missing required API Token, Lens ID, or Group ID. Please check the setup.</p>
      </div>`;
    return
  }

  // Get canvas element for live render target early
  const liveRenderTarget = document.getElementById("canvas")
  if (!liveRenderTarget) {
      console.error("Canvas element with ID 'canvas' not found.");
      return;
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor() // Assuming FFmpeg setup is correct
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

  try {
      // Show loading indicator early
      uiManager.showLoading(true);

      // Initialize Camera Kit
      const cameraKit = await bootstrapCameraKit({
        apiToken: apiToken,
      })

      // Create camera kit session
      const session = await cameraKit.createSession({ liveRenderTarget })
      session.events.on('error', (event) => {
        console.error('Camera Kit Session Error:', event.detail);
        // Handle specific errors if needed
        if (event.detail.error?.message?.includes('Unauthorized')) {
           alert('Camera Kit API Token is invalid or expired.');
        }
      });


      // Initialize camera and set up source
      const mediaStream = await cameraManager.initializeCamera()
      const source = createMediaStreamSource(mediaStream, {
        cameraType: cameraManager.isBackFacing ? "environment" : "user", // Use initial state
        disableSourceAudio: false, // Audio needed for recording
      })
      await session.setSource(source)

      // Apply initial transform based on camera facing mode
      if (!cameraManager.isBackFacing && !cameraManager.isMobile) { // Mirror front camera on desktop initially
         source.setTransform(Transform2D.MirrorX)
      } else if (!cameraManager.isBackFacing && cameraManager.isMobile) { // Mirror front camera on mobile
          source.setTransform(Transform2D.MirrorX);
      }
      // Back camera (mobile or desktop) usually doesn't need mirroring

      // Set initial render size (UIManager handles DPR)
      uiManager.updateRenderSize(source, liveRenderTarget)

      await session.setFPSLimit(Settings.camera.fps)


      // Load and apply lens
      const lens = await cameraKit.lensRepository.loadLens(lensID, groupID)
      await session.applyLens(lens)

      // Start the session *after* lens is applied
      await session.play()
       console.log("Camera Kit session started");

      // Hide loading indicator
      uiManager.showLoading(false);
      uiManager.showPreRecordControls(); // Show initial controls


      // --- Event Listeners ---

      uiManager.recordButton.addEventListener("click", async () => {
        // Check if already processing/loading
        if (uiManager.loadingIcon.style.display === 'block') {
            console.warn("Recording action ignored: currently processing.");
            return;
        }

        if (uiManager.recordPressedCount % 2 === 0) {
          // Start recording
          const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints())
          if (success) {
            uiManager.updateRecordButtonState(true)
          } else {
             // Reset UI if starting failed
             uiManager.updateRecordButtonState(false);
             uiManager.recordPressedCount = 0; // Ensure count is even
          }
        } else {
          // Stop recording
          uiManager.updateRecordButtonState(false)
          // Don't hide button yet, let onstop handle UI changes after processing
          // uiManager.toggleRecordButton(false) // Old logic
          mediaRecorder.stopRecording() // Triggers onstop -> processing -> UI update
        }
      })

      uiManager.switchButton.addEventListener("click", async () => {
        // Prevent switching while recording or processing
        if (mediaRecorder.mediaRecorder && mediaRecorder.mediaRecorder.state === "recording") {
            console.warn("Cannot switch camera while recording.");
            return;
        }
         if (uiManager.loadingIcon.style.display === 'block') {
            console.warn("Cannot switch camera while processing.");
            return;
        }

        uiManager.showLoading(true); // Show loading during switch
        try {
          const newSource = await cameraManager.updateCamera(session) // updateCamera now returns the new source
          // No need to update render size here if window hasn't resized
          // uiManager.updateRenderSize(newSource, liveRenderTarget) // updateRenderSize takes source now
        } catch (error) {
          console.error("Error switching camera:", error)
          alert("Could not switch camera. Please ensure permissions are granted and the other camera is available.");
        } finally {
            uiManager.showLoading(false);
        }
      })

      // Add back button handler (centralized logic)
      document.getElementById("back-button").addEventListener("click", () => {
        console.log("Back button clicked");
        // Reset recordings, streams, and UI state
        mediaRecorder.resetRecordingVariables();

        // Ensure render size is correct for the live feed
        // Re-fetch the current source from the session if needed, or use the existing one
        // NOTE: cameraManager.updateCamera might not have been called if we went straight
        // from recording -> back. We need the *current* session source.
        const currentSource = session.source;
        if (currentSource) {
             uiManager.updateRenderSize(currentSource, liveRenderTarget);
        } else {
             console.warn("Could not get current source to update render size on back.");
        }
      })

      // Add window resize listener
      window.addEventListener("resize", () => {
          const currentSource = session.source; // Get the current source
           if (currentSource) {
                uiManager.updateRenderSize(currentSource, liveRenderTarget)
           }
      })

  } catch(error) {
      console.error("Initialization failed:", error);
      uiManager.showLoading(false); // Hide loading on error
      // Display a user-friendly error message
      let message = "An unexpected error occurred during initialization.";
      if (error.message) {
          message += `\nDetails: ${error.message}`;
      }
       if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            message = 'Camera/Microphone access was denied. Please allow access in your browser settings and refresh the page.';
       } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
           message = 'No camera/microphone found. Please ensure they are connected and enabled.';
       } else if (error.message?.includes('bootstrapCameraKit')) {
           message = 'Failed to initialize Camera Kit. Check API token and network connection.';
       }
       document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>Initialization Error</h1>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <p>Please try refreshing the page.</p>
      </div>`;
  }

})()