import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.controlsContainer = document.getElementById("controls") // Get parent container
    this.actionButtonContainer = document.getElementById("action-buttons")
    this.switchButtonContainer = document.getElementById("switch-cam") // Get parent container
    this.switchButton = document.getElementById("switch-button") // Keep reference if needed elsewhere
    this.loadingIcon = document.getElementById("loading")
    this.backButtonContainer = document.getElementById("back-button-container")
    this.videoPreview = document.getElementById("video-preview") // Get video preview element
    this.canvas = document.getElementById("canvas") // Get canvas element
    this.recordPressedCount = 0
    this.currentPreviewUrl = null // To store the object URL for revocation
  }

  // Renamed for clarity
  showPreRecordControls() {
    this.controlsContainer.style.display = "flex" // Use flex as defined in CSS
    this.recordOutline.style.display = "block"
    this.recordButton.style.display = "block"
    // Show switch button container only if not desktop
    if (!document.body.classList.contains("desktop")) {
       this.switchButtonContainer.style.display = "block"
    }
  }

  // Renamed for clarity
  hidePreRecordControls() {
     this.controlsContainer.style.display = "none"
     this.switchButtonContainer.style.display = "none"
  }

  updateRecordButtonState(isRecording) {
    this.recordButton.style.backgroundImage = isRecording ? `url('${Settings.ui.recordButton.stopImage}')` : `url('${Settings.ui.recordButton.startImage}')`
    if (isRecording) {
        this.recordButton.classList.add('pressed') // Optional: Add class if needed by CSS
    } else {
         this.recordButton.classList.remove('pressed')
    }
    this.recordPressedCount++
  }

  showLoading(show) {
    this.loadingIcon.style.display = show ? "block" : "none"
  }

  // Combined showing preview and post-record buttons
  displayPostRecordUI(url, fixedBlob) {
    this.hidePreRecordControls() // Hide record/switch buttons

    // --- Show Video Preview ---
    this.currentPreviewUrl = url // Store URL for later revocation
    this.videoPreview.src = this.currentPreviewUrl
    this.videoPreview.style.display = "block"
    this.canvas.style.display = "none" // Hide the live canvas feed
    document.body.classList.add("preview-active") // Add class for potential CSS rules
    // Consider adding this.videoPreview.play() if autoplay is desired,
    // but be aware of browser restrictions. Controls are enabled.

    // --- Show Action Buttons ---
    this.actionButtonContainer.style.display = "flex" // Use flex as defined in CSS
    this.backButtonContainer.style.display = "block"
    // this.switchButtonContainer.style.display = "none" // Already hidden by hidePreRecordControls

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url // Use the passed URL directly
      a.download = Settings.recording.outputFileName
      a.click()
      a.remove()
    }

    document.getElementById("share-button").onclick = async () => {
      try {
        // Use the passed blob directly
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully")
        } else {
          // Fallback or error message
          alert("Sharing files is not supported on this device/browser, please use the download button.");
          console.error("Sharing files is not supported on this device.")
        }
      } catch (error) {
        // Handle potential errors during share (e.g., user cancellation)
        if (error.name !== 'AbortError') {
            console.error("Error while sharing:", error)
            alert("An error occurred during sharing.")
        } else {
            console.log("Sharing aborted by user.")
        }
      }
    }

    // Note: The back button's core logic is moved to main.js for better coordination
  }

  // Hides all post-record elements including the preview
  hidePostRecordUI() {
    this.actionButtonContainer.style.display = "none"
    this.backButtonContainer.style.display = "none"

    // --- Hide Video Preview ---
    if (this.videoPreview.style.display !== "none") {
        this.videoPreview.pause()
        this.videoPreview.src = "" // Clear source
        this.videoPreview.style.display = "none"
        this.canvas.style.display = "block" // Show the live canvas feed again
        document.body.classList.remove("preview-active")
        // Revoke the old object URL to free memory
        if (this.currentPreviewUrl) {
            URL.revokeObjectURL(this.currentPreviewUrl)
            this.currentPreviewUrl = null
        }
    }
  }


  updateRenderSize(source, liveRenderTarget) {
    // Use clientWidth/Height for dimensions available for content
    const width = document.documentElement.clientWidth
    const height = document.documentElement.clientHeight

    // Update canvas CSS size
    liveRenderTarget.style.width = `${width}px`
    liveRenderTarget.style.height = `${height}px`

    // Update canvas render buffer size AND source size
    // Use devicePixelRatio for sharper rendering on high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const effectiveWidth = width * dpr;
    const effectiveHeight = height * dpr;

    liveRenderTarget.width = effectiveWidth;
    liveRenderTarget.height = effectiveHeight;

    // Update Camera Kit source render size
    if (source && typeof source.setRenderSize === 'function') {
      source.setRenderSize(effectiveWidth, effectiveHeight)
       console.log(`Render size updated: ${effectiveWidth}x${effectiveHeight} (DPR: ${dpr})`)
    } else {
       console.warn("Source object invalid or missing setRenderSize method during resize.")
    }

     // Also update video preview size if visible (optional, CSS already handles it)
    // this.videoPreview.style.width = `${width}px`;
    // this.videoPreview.style.height = `${height}px`;
  }
}