/**
 * Image compression and optimization service
 * @class
 */
export class ImageService {
  constructor() {
    this.maxWidth = 1200;
    this.maxHeight = 1200;
    this.quality = 0.85;
  }

  /**
   * Compress and resize image
   * @param {File} file - Image file
   * @param {Object} options - Compression options
   * @returns {Promise<Blob>}
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = this.maxWidth,
      maxHeight = this.maxHeight,
      quality = this.quality,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          format,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Create thumbnail from image
   * @param {File|Blob} file - Image file
   * @param {number} size - Thumbnail size
   * @returns {Promise<Blob>}
   */
  async createThumbnail(file, size = 200) {
    return this.compressImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.8
    });
  }

  /**
   * Convert Blob to Object URL
   * @param {Blob} blob - Image blob
   * @returns {string}
   */
  blobToURL(blob) {
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke Object URL
   * @param {string} url - Object URL
   */
  revokeURL(url) {
    URL.revokeObjectURL(url);
  }

  /**
   * Get image dimensions
   * @param {File|Blob} file - Image file
   * @returns {Promise<{width: number, height: number}>}
   */
  async getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Capture photo from camera
   * @param {Object} constraints - Media constraints
   * @returns {Promise<Blob>}
   */
  async captureFromCamera(constraints = {}) {
    const defaultConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      ...defaultConstraints,
      ...constraints
    });

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        stream.getTracks().forEach(track => track.stop());

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture photo'));
          }
        }, 'image/jpeg', 0.9);
      };

      video.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Failed to access camera'));
      };
    });
  }

  /**
   * Check if camera is available
   * @returns {Promise<boolean>}
   */
  async isCameraAvailable() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (e) {
      return false;
    }
  }
}

// Singleton instance
export const imageService = new ImageService();
