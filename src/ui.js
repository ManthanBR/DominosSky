import { Settings } from "./settings"

export class UIManager {
  constructor(mediaRecorderManager) { // Pass recorder manager for reset callback
    // Updated selectors for new HTML
    this.recordButton = document.getElementById("record-button")
    this.flipButton = document.getElementById("flip-button") // Renamed from switchButton
    this.previewModal = document.getElementById("preview-modal")
    this.previewVideo = document.getElementById("preview-video")
    this.closeModalButton = document.getElementById("close-modal-button")
    this.shareButton = document.getElementById("share-button")
    this.saveButton = document.getElementById("save-button") // Renamed from download-button
    this.progressRing = document.getElementById("progress-ring")
    this.progressPath = document.getElementById("progress-path")
    this.loadingOverlay = document.getElementById("loading-overlay") // New loading indicator

    this.isRecording = false
    this.currentFlipRotation = 0 // Track flip button rotation
    this.mediaRecorderManager = mediaRecorderManager // Store reference

    this.setupModalCloseHandler()
  }

  // Replaces toggleRecordButton and updateRecordButtonState
  setRecordingState(isRecording) {
    this.isRecording = isRecording
    if (isRecording) {
      this.recordButton.classList.add("recording")
      // Optionally reset progress if needed at start
      this.updateProgress(0)
      // Hide flip button during recording
      this.flipButton.style.display = 'none';
    } else {
      this.recordButton.classList.remove("recording")
      // Re-show flip button after recording
      this.flipButton.style.display = 'flex';
    }
    // Toggle button disabled state to prevent rapid clicks during state change
    this.recordButton.disabled = true;
    setTimeout(() => { this.recordButton.disabled = false; }, 300); // Short delay
  }

  // Call this if you implement timed recording or want visual feedback
  updateProgress(percentage) {
    const circumference = 2 * Math.PI * 30; // Corresponds to r="30" in SVG
    const offset = circumference - (percentage / 100) * circumference;
    if (this.progressPath) {
        this.progressPath.style.strokeDashoffset = offset;
    }
  }

  animateFlip() {
    this.currentFlipRotation += 180;
    this.flipButton.style.setProperty('--current-rotation', `${this.currentFlipRotation}deg`);
    this.flipButton.classList.add('animate-flip');

    // Remove the class after animation completes (optional, depends on desired effect)
     this.flipButton.addEventListener('transitionend', () => {
       this.flipButton.classList.remove('animate-flip');
     }, { once: true });
  }

  showLoading(show) {
    // Use the new loading overlay
    if (show) {
        this.loadingOverlay.classList.add('show');
    } else {
        this.loadingOverlay.classList.remove('show');
    }
  }

  // Replaces displayPostRecordButtons
  showPreviewModal(url, fixedBlob) {
    this.previewVideo.src = url // Set video source
    this.previewModal.classList.add("show") // Show modal with transition

    // Make UI elements non-interactive behind modal
    this.recordButton.style.display = 'none';
    this.flipButton.style.display = 'none';


    // --- Attach button handlers ---

    // SAVE Button (Previously Download)
    this.saveButton.onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName // Use setting for filename
      document.body.appendChild(a); // Required for Firefox
      a.click()
      document.body.removeChild(a); // Clean up
      URL.revokeObjectURL(url); // Clean up object URL after download initiated
    }

    // SHARE Button
    this.shareButton.onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video", // Customize as needed
            text: "Check out this recording!", // Customize as needed
          })
          console.log("File shared successfully")
        } else if (navigator.share) {
           // Fallback for sharing link if file sharing not supported but share API exists
           await navigator.share({
                title: 'Recorded Video',
                text: 'Check out this video!',
                url: url, // Share the blob URL (might have limited lifetime)
           });
           console.log("Shared video link successfully");
        }
         else {
          console.error("Sharing not supported on this device/browser.");
          alert("Sharing not supported on this device."); // User feedback
        }
      } catch (error) {
        console.error("Error while sharing:", error)
        if (error.name !== 'AbortError') { // Don't alert if user cancelled share
           alert("Error sharing file.");
        }
      }
    }
  }

  setupModalCloseHandler() {
     // CLOSE Modal Button
    this.closeModalButton.onclick = () => {
      this.hidePreviewModal()
    }
  }


  hidePreviewModal() {
    if (this.previewVideo.src) {
        URL.revokeObjectURL(this.previewVideo.src)
        this.previewVideo.removeAttribute('src');
        this.previewVideo.load();
    }
    this.previewModal.classList.remove("show") // Just remove the class

    // --- REMOVE THIS LINE (or comment out) ---
    // this.previewModal.style.display = 'none';
    // --- END OF REMOVED LINE ---

    // Reset UI state
    this.recordButton.style.display = 'flex';
    this.flipButton.style.display = 'flex';
    this.setRecordingState(false);

    if (this.mediaRecorderManager) {
        this.mediaRecorderManager.resetRecordingVariables();
    }

    this.recordButton.disabled = false;
    this.flipButton.disabled = false;
  }


  updateRenderSize(source, liveRenderTarget) {
    // Calculate based on window size - ensure canvas fills viewport
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update canvas CSS size for display
    liveRenderTarget.style.width = `${width}px`;
    liveRenderTarget.style.height = `${height}px`;

    // Update CameraKit source render size (internal resolution)
    // You might want to cap this or use devicePixelRatio for performance/quality
    source.setRenderSize(width, height);
  }
}