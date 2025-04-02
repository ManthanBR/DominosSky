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
  // --- Early Setup ---
  const apiToken = process.env.API_TOKEN
  const lensID = process.env.LENS_ID
  const groupID = process.env.GROUP_ID

  // Get canvas element early
  const liveRenderTarget = document.getElementById("canvas")
  if (!liveRenderTarget) {
      console.error("Canvas element with ID 'canvas' not found.")
      // Use a simple mechanism for initial error display if UI Manager isn't ready
      document.body.innerHTML = `<div class="init-error">Canvas element not found. App cannot start.</div>`;
      return;
  }

   // Initialize UI Manager FIRST to show loading/errors
   const uiManager = new UIManager()
   uiManager.showLoading(true); // Show loading indicator immediately

  // Check environment variables AFTER UI manager is ready
  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables (API_TOKEN, LENS_ID, GROUP_ID).")
    uiManager.showLoading(false);
    document.body.innerHTML = `<div class="init-error">
        <h1>Configuration Error</h1>
        <p>Missing required API Token, Lens ID, or Group ID. Please check setup and environment variables.</p>
      </div>`;
    return
  }

  // Initialize other managers
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor() // Assuming FFmpeg setup is correct
  const mediaRecorder = new MediaRecorderManager(videoProcessor, uiManager)

  let mediaStream = null;
  let session = null;
  let source = null; // Define source variable in the outer scope

  try {
    // --- 1. Request Camera Permissions ASAP ---
    console.log("Requesting camera permissions...");
    try {
        mediaStream = await cameraManager.initializeCamera();
        console.log("Camera permissions granted and stream obtained.");
    } catch (permissionError) {
        console.error("Failed to get camera permissions:", permissionError);
        uiManager.showLoading(false);
         let message = "Could not access camera/microphone.";
         if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
            message = 'Camera/Microphone access was denied. Please allow access in your browser settings and refresh the page.';
         } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
             message = 'No camera/microphone found. Please ensure they are connected and enabled.';
         } else if (permissionError.name === 'NotReadableError') {
              message = 'Camera/Microphone might be in use by another application or hardware error occurred.';
         } else {
              message = `An unexpected error occurred while accessing media devices: ${permissionError.name}`;
         }
         document.body.innerHTML = `<div class="init-error"><h1>Permissions Error</h1><p>${message}</p></div>`;
        return; // Stop execution if permissions fail
    }

    // --- 2. Initialize Camera Kit ---
    console.log("Initializing Camera Kit...");
    const cameraKit = await bootstrapCameraKit({ apiToken: apiToken });
    console.log("Camera Kit bootstrapped.");

    // --- 3. Create Session ---
    console.log("Creating Camera Kit session...");
    // Ensure the canvas is ready for the session
    liveRenderTarget.width = liveRenderTarget.clientWidth * (window.devicePixelRatio || 1);
    liveRenderTarget.height = liveRenderTarget.clientHeight * (window.devicePixelRatio || 1);
    session = await cameraKit.createSession({ liveRenderTarget });
    console.log("Session created.");

    session.events.on('error', (event) => {
        console.error('Camera Kit Session Error:', event.detail);
        // Display a non-fatal error to the user if possible
         if (event.detail.error?.message?.includes('Unauthorized')) {
             alert('Camera Kit API Token is invalid or expired. Lens features may not work correctly.');
         } else if (event.detail.error?.type === 'LensExecutionError') {
              console.warn("Lens execution error occurred:", event.detail.error);
              // Maybe inform user the lens crashed but continue? Or attempt reload?
              // alert("The AR Lens encountered an error.");
         }
    });

    // --- 4. Create and Set Source ---
    console.log("Creating media stream source...");
    source = createMediaStreamSource(mediaStream, { // Use the globally scoped 'source'
        cameraType: cameraManager.isBackFacing ? "environment" : "user",
        // It's generally recommended to disable source audio if you handle audio separately
        // for recording, but keep it if CameraKit needs it or for simplicity.
        // Let's keep it enabled as per original code unless issues arise.
        disableSourceAudio: false,
    });
    console.log("Setting source to session...");
    await session.setSource(source);
    console.log("Source set.");

    // Apply initial transform based on camera facing mode
    if (!cameraManager.isBackFacing) { // Mirror front camera by default
        console.log("Applying MirrorX transform for front camera.");
        source.setTransform(Transform2D.MirrorX);
    } else {
        source.setTransform(Transform2D.None); // Ensure back isn't mirrored
    }

    // Set initial render size (UIManager handles DPR)
    uiManager.updateRenderSize(source, liveRenderTarget);

    // Set FPS limit
    await session.setFPSLimit(Settings.camera.fps);

    // --- 5. Play Session (Show Raw Camera Feed) ---
    console.log("Starting session playback (raw feed)...");
    await session.play();
    console.log("Session playing.");

    // --- 6. Update UI (Hide Loading, Show Controls) ---
    uiManager.showLoading(false);
    uiManager.showPreRecordControls();
    console.log("Initial UI ready.");

    // --- 7. Load and Apply Lens (Asynchronously) ---
    console.log(`Loading lens (ID: ${lensID}, Group: ${groupID})...`);
    try {
        const lens = await cameraKit.lensRepository.loadLens(lensID, groupID);
        console.log("Lens loaded, applying...");
        await session.applyLens(lens);
        console.log("Lens applied successfully.");
    } catch (lensError) {
        console.error("Failed to load or apply lens:", lensError);
        // Non-fatal error: Show a message but continue with the raw feed
        alert(`Could not load the AR lens (ID: ${lensID}). The experience will continue without the effect. Error: ${lensError.message}`);
    }

    // --- Event Listeners Setup ---

    uiManager.recordButton.addEventListener("click", async () => {
      // Prevent action if already processing
      if (uiManager.loadingIcon.style.display === 'block') {
          console.warn("Recording action ignored: currently processing.");
          return;
      }
      // Prevent action if session is not playing (e.g., during camera switch)
      if (session.playbackState !== 'playing') {
           console.warn("Recording action ignored: session not playing.");
           return;
      }

      if (uiManager.recordPressedCount % 2 === 0) {
        // Start recording
        console.log("Attempting to start recording...");
        const constraints = cameraManager.getConstraints(); // Get current constraints
        const success = await mediaRecorder.startRecording(liveRenderTarget, constraints);
        if (success) {
          uiManager.updateRecordButtonState(true);
          console.log("Recording started successfully via UI.");
        } else {
          // Reset UI if starting failed (alert/log handled in startRecording)
          uiManager.updateRecordButtonState(false);
          uiManager.recordPressedCount = 0; // Ensure count is even
           console.log("Recording failed to start via UI.");
        }
      } else {
        // Stop recording
        console.log("Attempting to stop recording via UI...");
        uiManager.updateRecordButtonState(false);
        // Let MediaRecorder handle the rest (onstop event)
        mediaRecorder.stopRecording();
      }
    });

    // Only add switch button listener if it exists (i.e., not desktop)
    if (uiManager.switchButton) {
        uiManager.switchButton.addEventListener("click", async () => {
          // Prevent switching while recording or processing
          if (mediaRecorder.mediaRecorder && mediaRecorder.mediaRecorder.state === "recording") {
              console.warn("Cannot switch camera while recording.");
              alert("Please stop recording before switching camera.");
              return;
          }
           if (uiManager.loadingIcon.style.display === 'block') {
              console.warn("Cannot switch camera while processing video.");
              return;
          }
           if (session.playbackState !== 'playing') {
               console.warn("Cannot switch camera while session is not playing.");
               return;
           }


          console.log("Attempting to switch camera...");
          uiManager.showLoading(true); // Show loading during switch
          try {
              // updateCamera pauses/resumes session, sets new source, applies transform
              const newSource = await cameraManager.updateCamera(session);
              // Update the main 'source' variable reference
              source = newSource;

              // Update render size just in case constraints changed aspect ratio etc.
              uiManager.updateRenderSize(source, liveRenderTarget);
              console.log("Camera switched successfully.");

          } catch (error) {
              console.error("Error switching camera:", error);
              alert(`Could not switch camera. Please ensure permissions are granted and the other camera is available. Error: ${error.message}`);
              // Attempt to ensure session is playing if error occurred mid-switch
              if(session.playbackState !== 'playing') {
                  await session.play().catch(e => console.error("Failed to resume session after switch error:", e));
              }
          } finally {
              uiManager.showLoading(false);
          }
        });
    } else {
        console.log("Switch button not found (expected on desktop).");
    }


    // Back button listener (for returning from preview)
    document.getElementById("back-button").addEventListener("click", () => {
      console.log("Back button clicked - returning to live view.");
      // Reset recordings, streams, and UI state (includes hiding preview/showing controls)
      mediaRecorder.resetRecordingVariables();

      // Ensure render size is correct for the live feed using the current source
      if (source && session.playbackState === 'playing') {
           uiManager.updateRenderSize(source, liveRenderTarget);
      } else if (!source) {
           console.warn("Could not get current source to update render size on back.");
      } else if (session.playbackState !== 'playing') {
           console.warn("Session not playing when returning via back button.");
           // Optionally try to play again if it makes sense
           // session.play().catch(e => console.error("Failed to play session on back button:", e));
      }
    });

    // Window resize listener
    window.addEventListener("resize", () => {
        console.log("Window resize detected.");
        // Only resize if we have a valid source and session is active
        if (source && session && session.playbackState === 'playing') {
            uiManager.updateRenderSize(source, liveRenderTarget)
        } else {
             console.log("Resize ignored: source or session not ready.");
        }
    });

  } catch (error) {
    // Catch errors during the main async setup (post-permission grant)
    console.error("Initialization failed:", error);
    uiManager.showLoading(false); // Hide loading indicator
    // Display a user-friendly error message on the page
    let message = `An unexpected error occurred during initialization: ${error.message || 'Unknown error'}.`;
     if (error.message?.includes('bootstrapCameraKit')) {
           message = 'Failed to initialize Camera Kit. Check API token and network connection.';
     } else if (error.message?.includes('createSession')) {
           message = 'Failed to create Camera Kit session. The rendering context might be unavailable.';
     }

    document.body.innerHTML = `<div class="init-error">
        <h1>Initialization Error</h1>
        <p>${message}</p>
        <p>Please try refreshing the page. If the problem persists, check browser compatibility and console logs.</p>
      </div>`;
  }
})();

// Add basic CSS for error messages dynamically if needed
// (Useful if CSS file loading fails or for very early errors)
const style = document.createElement('style');
style.textContent = `
  .init-error {
    box-sizing: border-box;
    padding: 20px;
    margin: 10%; /* Add some margin */
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    color: #dc3545; /* Red text */
    background-color: #f8d7da; /* Light red background */
    border: 1px solid #f5c6cb; /* Red border */
    border-radius: 5px; /* Rounded corners */
    position: fixed; /* Keep it visible */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2000; /* Ensure it's on top */
    max-width: 80%;
    width: auto; /* Adjust width based on content */
  }
   .init-error h1 {
     color: #721c24; /* Darker red for heading */
     margin-top: 0;
     margin-bottom: 10px;
     font-size: 1.5em;
   }
   .init-error p {
      margin-bottom: 5px;
      line-height: 1.4;
   }
`;
document.head.appendChild(style);