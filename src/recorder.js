import { Settings } from "./settings"

export class MediaRecorderManager {
  // Constructor updated to only require videoProcessor initially
  // uiManager is linked after UIManager initialization in main.js
  constructor(videoProcessor) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = null // Will be set from main.js
    this.audioVideoStream = null
    this.canvasStream = null
  }

  async startRecording(liveRenderTarget, constraints) {
    // Reset previous recording artifacts if any
    this.resetRecordingVariables();

    try {
      // Get audio stream separately
      this.audioVideoStream = await navigator.mediaDevices.getUserMedia({
          audio: constraints.audio, // Use audio constraint from camera settings
          video: false // We only need audio here
      });
      const audioTracks = this.audioVideoStream.getAudioTracks();

      if (audioTracks.length === 0) {
          console.warn("No audio track found. Recording video only.");
          // Optionally alert the user or proceed without audio
      }

      // Get video stream from canvas
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps);
      const videoTracks = this.canvasStream.getVideoTracks();

       if (videoTracks.length === 0) {
         throw new Error("Canvas capture stream did not provide a video track.");
       }

      // Combine tracks into a new stream for the recorder
      const combinedStream = new MediaStream([
          ...videoTracks,
          ...(audioTracks.length > 0 ? [audioTracks[0]] : []) // Add audio track if available
      ]);


      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: Settings.recording.mimeType,
        // Add videoBitsPerSecond for potentially better quality control if needed
        // videoBitsPerSecond: 2500000, // Example: 2.5 Mbps
      });
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        // console.log("Data available for recorder...");
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log("Recording stopped. Processing...");
        // Ensure UI Manager exists before using it
        if (!this.uiManager) {
            console.error("UIManager not linked to MediaRecorderManager");
            return;
        }
        // Loading indicator is shown in main.js when stop is initiated

        if (this.recordedChunks.length === 0) {
            console.warn("No data recorded.");
            this.uiManager.showLoading(false);
            // Optionally inform the user
            alert("Recording failed: No data captured.");
            this.resetRecordingVariables(); // Clean up streams even if nothing recorded
            this.uiManager.hidePreviewModal(); // Ensure modal doesn't linger if somehow shown
            return;
        }


        try {
            const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType });
            console.log(`Raw blob size: ${blob.size}`);

            // Fix video duration using FFmpeg
            const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
             console.log(`Processed blob size: ${fixedBlob.size}`);

            const url = URL.createObjectURL(fixedBlob);

            this.uiManager.showLoading(false); // Hide loading *before* showing modal
            this.uiManager.showPreviewModal(url, fixedBlob); // Call the new UI method

            // Note: Recorded chunks are cleared in resetRecordingVariables,
            // which should be called when the modal is closed.

        } catch (processingError) {
             console.error("Error processing video:", processingError);
             this.uiManager.showLoading(false);
             alert("Error processing video. Please try again.");
             this.resetRecordingVariables(); // Clean up streams on error
             this.uiManager.hidePreviewModal(); // Ensure modal is hidden
        }
      };

      this.mediaRecorder.onerror = (event) => {
         console.error("MediaRecorder error:", event.error);
         if (this.uiManager) {
            this.uiManager.showLoading(false);
            this.uiManager.setRecordingState(false); // Reset UI button state
            alert(`Recording error: ${event.error.name || 'Unknown error'}`);
         }
         this.resetRecordingVariables(); // Clean up on error
      };

      this.mediaRecorder.start()
      console.log("Recording started.");
      return true // Indicate success

    } catch (error) {
      console.error("Error accessing media devices or starting recorder:", error)
       if (this.uiManager) {
           this.uiManager.showLoading(false);
           this.uiManager.setRecordingState(false); // Reset UI button state
       }
      this.resetRecordingVariables(); // Clean up any partial streams
      return false // Indicate failure
    }
  }

  // Called when modal is closed OR on error/failure
  resetRecordingVariables() {
    console.log("Resetting recording variables and streams.");
    this.recordedChunks = [] // Clear any stored data

    // Stop all tracks in the separate audio stream
    if (this.audioVideoStream) {
      this.audioVideoStream.getTracks().forEach((track) => {
        track.stop()
        console.log(`Stopped audio track: ${track.label || track.id}`);
      })
      this.audioVideoStream = null
    }

    // Stop all tracks in the canvas capture stream
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((track) => {
        track.stop()
         console.log(`Stopped canvas track: ${track.label || track.id}`);
      })
      this.canvasStream = null
    }

     // Explicitly set recorder to null AFTER stopping tracks
     if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
         // Stop might have already been called, but ensure it's inactive
         // this.mediaRecorder.stop(); // Avoid calling stop again if onstop is processing
         console.log("MediaRecorder state before nulling:", this.mediaRecorder.state);
     }
    this.mediaRecorder = null;
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      console.log("Requesting MediaRecorder stop...");
      this.mediaRecorder.stop()
      // The onstop event handler will take over from here.
    } else {
        console.warn("StopRecording called but recorder was not active or null. State:", this.mediaRecorder?.state);
        // If stop is called erroneously, ensure cleanup happens
        this.resetRecordingVariables();
        if (this.uiManager) {
            this.uiManager.showLoading(false); // Hide loading if shown accidentally
            this.uiManager.setRecordingState(false); // Ensure UI consistency
        }
    }
  }
}