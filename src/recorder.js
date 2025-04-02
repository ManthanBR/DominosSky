import { Settings } from "./settings"

export class MediaRecorderManager {
  constructor(videoProcessor, uiManager) {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoProcessor = videoProcessor
    this.uiManager = uiManager
    this.audioVideoStream = null
    this.canvasStream = null
  }

  async startRecording(liveRenderTarget, constraints) {
    try {
      // Ensure previous streams are stopped before starting new ones
      this.stopAllTracks();

      // Get audio track separately first
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio, video: false });
      const audioTrack = audioStream.getAudioTracks()[0];

      // Get video stream from canvas
      // Use the canvas actual width/height for captureStream for better quality matching render size
      this.canvasStream = liveRenderTarget.captureStream(Settings.recording.fps)
      const videoTrack = this.canvasStream.getVideoTracks()[0];

      // Combine tracks into a new stream for the recorder
      const combinedStream = new MediaStream([videoTrack, audioTrack]);
      this.audioVideoStream = audioStream; // Keep reference to stop audio track later


      this.mediaRecorder = new MediaRecorder(combinedStream, { // Use the combined stream
        mimeType: Settings.recording.mimeType,
        // Optional: Add bitrates for more control if needed
        // videoBitsPerSecond: 2500000,
        // audioBitsPerSecond: 128000,
      })
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        // console.log("Data available:", event.data.size); // More informative log
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log("Recording stopped. Processing video...");
        this.uiManager.showLoading(true);

        // Stop the tracks *after* recording is fully stopped and data is collected
        this.stopAllTracks(); // Stop tracks from canvas and audio source

        try {
          const blob = new Blob(this.recordedChunks, { type: Settings.recording.mimeType });
          console.log("Original blob size:", blob.size);

          // Check if ffmpeg processing is needed (e.g., for duration fix or format conversion)
          // For MP4, the duration fix is often necessary for web playback compatibility
          const fixedBlob = await this.videoProcessor.fixVideoDuration(blob);
          console.log("Processed blob size:", fixedBlob.size);

          const url = URL.createObjectURL(fixedBlob);

          this.uiManager.showLoading(false);
          this.uiManager.displayPostRecordUI(url, fixedBlob); // Show preview and buttons
        } catch (error) {
            console.error("Error processing video:", error);
            this.uiManager.showLoading(false);
            alert("Failed to process the recorded video. Please try again.");
            // Reset UI back to recording state
            this.resetRecordingVariables(); // Ensure UI is reset on error too
             this.uiManager.hidePostRecordUI();
             this.uiManager.showPreRecordControls();
        } finally {
             // Clear chunks regardless of success or failure after processing attempt
             this.recordedChunks = [];
        }
      }

      this.mediaRecorder.start()
      console.log("Recording started.");
      return true
    } catch (error) {
      console.error("Error accessing media devices or starting recording:", error)
       // Provide more specific feedback if possible
       if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('Camera/Microphone access was denied. Please allow access in your browser settings and refresh the page.');
       } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
           alert('No camera/microphone found. Please ensure they are connected and enabled.');
       } else {
           alert('Could not start recording. Please ensure your browser supports the required features.');
       }
      this.stopAllTracks(); // Clean up any tracks that might have been partially acquired
      return false
    }
  }

   // Helper function to stop all tracks
  stopAllTracks() {
      if (this.canvasStream) {
        this.canvasStream.getTracks().forEach((track) => track.stop());
        this.canvasStream = null;
      }
      if (this.audioVideoStream) {
        this.audioVideoStream.getTracks().forEach((track) => track.stop());
        this.audioVideoStream = null;
      }
      console.log("All media tracks stopped.");
  }


  resetRecordingVariables() {
    // Stop recorder if it's somehow still active
    this.stopRecording();

    // Stop tracks
    this.stopAllTracks();

    // Reset state variables
    this.mediaRecorder = null
    this.recordedChunks = []

    // Reset UI elements via UIManager
    this.uiManager.hidePostRecordUI(); // Hide preview, action buttons, back button
    this.uiManager.showPreRecordControls(); // Show record, switch buttons
    this.uiManager.recordPressedCount = 0; // Reset record button state counter
    this.uiManager.updateRecordButtonState(false); // Ensure record button shows start image
    this.uiManager.showLoading(false); // Ensure loading is hidden

    console.log("Recording variables and UI reset.");
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
       console.log("Stopping media recorder...");
      this.mediaRecorder.stop() // This triggers the 'onstop' event handler
    } else {
       // If stopRecording is called when not recording (e.g., via back button),
       // ensure tracks are stopped anyway.
       this.stopAllTracks();
    }
  }
}