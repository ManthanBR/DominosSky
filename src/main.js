/**
 * Camera Kit Web Demo with Recording Feature
 * Updated with new UI structure
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA // <-- Update copyright year if needed
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";
// Removed CSS import here as it's inline in HTML now
import { CameraManager } from "./camera";
import { MediaRecorderManager } from "./recorder";
import { UIManager } from "./ui";
import { VideoProcessor } from "./videoProcessor";
import { Settings } from "./settings";

;(async function () {
  // Get environment variables
  const apiToken = process.env.API_TOKEN;
  const lensID = process.env.LENS_ID;
  const groupID = process.env.GROUP_ID;

  if (!apiToken || !lensID || !groupID) {
    console.error("Missing required environment variables. API_TOKEN, LENS_ID, GROUP_ID must be set.");
    // Provide user feedback if possible
    document.body.innerHTML = '<p style="color: red; text-align: center; margin-top: 50px;">Configuration Error: Missing API Token, Lens ID, or Group ID. Please check setup.</p>';
    return;
  }

  // Initialize managers
  const cameraManager = new CameraManager();
  const videoProcessor = new VideoProcessor();
  // Pass videoProcessor and uiManager reference later
  const mediaRecorder = new MediaRecorderManager(videoProcessor);
  // Pass mediaRecorder to UI Manager so it can call resetRecordingVariables
  const uiManager = new UIManager(mediaRecorder);
  // Now link uiManager to mediaRecorder
  mediaRecorder.uiManager = uiManager;


  try {
    // Show loading indicator early
    uiManager.showLoading(true);

    // Initialize Camera Kit
    const cameraKit = await bootstrapCameraKit({
      apiToken: apiToken,
    });

    // Get canvas element for live render target
    const liveRenderTarget = document.getElementById("canvas");
    if (!liveRenderTarget) {
        throw new Error("Canvas element with ID 'canvas' not found.");
    }

    // Create camera kit session
    const session = await cameraKit.createSession({ liveRenderTarget });

    // Initialize camera and set up source
    const mediaStream = await cameraManager.initializeCamera();
    const source = createMediaStreamSource(mediaStream, {
      cameraType: "user",
      disableSourceAudio: false, // Keep audio enabled for recording
    });
    await session.setSource(source);

    // Apply initial transform based on default camera (user facing)
    if (!cameraManager.isBackFacing) {
       source.setTransform(Transform2D.MirrorX);
    }

    // Set initial render size
    uiManager.updateRenderSize(source, liveRenderTarget); // Call after source is set

    await session.setFPSLimit(Settings.camera.fps);

    // Load and apply lens
    const lens = await cameraKit.lensRepository.loadLens(lensID, groupID);
    await session.applyLens(lens);

    // Hide loading indicator and play session
    uiManager.showLoading(false);
    await session.play();

    // --- Set up event listeners ---

    // Record Button Listener
    uiManager.recordButton.addEventListener("click", async () => {
      if (!uiManager.isRecording) {
        const success = await mediaRecorder.startRecording(liveRenderTarget, cameraManager.getConstraints());
        if (success) {
          uiManager.setRecordingState(true);
        } else {
           console.error("Failed to start recording.");
           alert("Could not start recording. Please check permissions.");
           uiManager.setRecordingState(false); // Ensure UI resets
        }
      } else {
        // Stop recording triggers onstop event which shows modal
        mediaRecorder.stopRecording();
        // UI state update (removing recording class) happens in stopRecording's onstop via hidePreviewModal or directly
         uiManager.setRecordingState(false); // Visually stop immediately
         uiManager.showLoading(true); // Show processing indicator
      }
    });

    // Flip Button Listener (replaces switchButton)
    uiManager.flipButton.addEventListener("click", async () => {
      // Disable button during switch
      uiManager.flipButton.disabled = true;
      uiManager.animateFlip(); // Trigger animation

      try {
        // updateCamera handles stream stopping/starting and setting source
        const newSource = await cameraManager.updateCamera(session);
        // Re-apply render size to the new source
        uiManager.updateRenderSize(newSource, liveRenderTarget);
      } catch (error) {
        console.error("Error switching camera:", error);
        alert("Could not switch camera."); // User feedback
        // Optionally revert animation or state if switch fails
      } finally {
         // Re-enable button after operation attempt
         setTimeout(() => { uiManager.flipButton.disabled = false; }, 300); // Delay to avoid rapid clicks
      }
    });

    // Removed back button listener (now handled by modal close)

    // Add window resize listener
    window.addEventListener("resize", () => {
        if (session.source) { // Ensure source exists before resizing
            uiManager.updateRenderSize(session.source, liveRenderTarget);
        }
    });

    // Initial render size update (redundant check, already called after source setup)
    // uiManager.updateRenderSize(source, liveRenderTarget);

  } catch (error) {
      console.error("Initialization failed:", error);
      uiManager.showLoading(false); // Hide loading if error occurs
      document.body.innerHTML = `<p style="color: red; text-align: center; margin-top: 50px;">Initialization Error: ${error.message}. Please check console and permissions.</p>`;
  }

})();