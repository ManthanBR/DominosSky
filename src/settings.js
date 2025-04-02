/**
 * Camera Kit Web Demo Settings
 * Centralized configuration for the application
 */

export const Settings = {
  // Camera settings
  camera: {
    fps: 60, // Consider if 60fps is necessary/performant on all devices
    constraints: {
      front: {
        video: {
          facingMode: { exact: "user" },
          // Optional: Add width/height constraints if needed
          // width: { ideal: 1280 },
          // height: { ideal: 720 }
        },
        audio: true, // Keep audio constraint
      },
      back: {
        video: {
          facingMode: { exact: "environment" },
           // width: { ideal: 1280 },
           // height: { ideal: 720 }
        },
        audio: true,
      },
      desktop: {
        video: {
          facingMode: "user", // 'exact' might fail on some desktops
           // width: { ideal: 1280 },
           // height: { ideal: 720 }
        },
        audio: true,
      },
    },
  },

  // Recording settings
  recording: {
    // Consider 'video/webm;codecs=vp9,opus' or 'video/webm;codecs=vp8,opus' for wider compatibility if mp4 fails
    mimeType: "video/mp4;codecs=h264,aac", // Be more specific if possible
    fps: 30, // Match canvas captureStream FPS? 60fps recording is demanding.
    outputFileName: "recording.mp4",
  },

  // FFmpeg settings (ensure these paths are correct relative to your build output)
  ffmpeg: {
    baseURL: "/ffmpeg", // Or wherever you serve these files from
    coreURL: "ffmpeg-core.js",
    wasmURL: "ffmpeg-core.wasm",
    // Added -vf scale to potentially fix issues if needed, copy is usually fine
    outputOptions: ["-movflags", "faststart", "-c", "copy"],
    // Example with scaling: ["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-movflags", "faststart", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac"]
  },

  // UI settings (Simplified as most assets are CSS based now)
  ui: {
    // No longer needed as button backgrounds are CSS based
    // recordButton: {
    //   startImage: "./assets/RecordButton.png",
    //   stopImage: "./assets/RecordStop.png",
    // },
    assets: {
      // Keep only if needed elsewhere, CSS handles most UI images now
      // poweredBySnap: "./assets/Powered_bysnap.png",
      // shareButton: "./assets/ShareButton.png", // Now text buttons
      // downloadButton: "./assets/DownloadButton.png", // Now text buttons
      // backButton: "./assets/BackButton.png", // Replaced by modal close
      // loadingIcon: "./assets/LoadingIcon.png", // Replaced by overlay
       flipIcon: "/flip.png" // Add path for flip icon used in CSS
    },
  },
}