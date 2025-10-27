/**
 * QR code service for plant data sharing
 * @class
 */
export class QRService {
  /**
   * Generate QR code data from plant
   * @param {Plant} plant - Plant object
   * @returns {string} JSON string
   */
  generatePlantQR(plant) {
    const data = {
      type: 'cactolog-plant',
      version: '2.0',
      plant: {
        name: plant.name,
        species: plant.species,
        type: plant.type,
        location: plant.location,
        waterIntervalDays: plant.waterIntervalDays,
        repotIntervalMonths: plant.repotIntervalMonths,
        tags: plant.tags,
        notes: plant.notes
      }
    };

    return JSON.stringify(data);
  }

  /**
   * Parse QR code data to plant object
   * @param {string} qrData - QR code data
   * @returns {Object} Plant data
   */
  parsePlantQR(qrData) {
    try {
      const data = JSON.parse(qrData);

      if (data.type !== 'cactolog-plant') {
        throw new Error('Invalid QR code: not a CactoLog plant');
      }

      if (!data.plant || !data.plant.name) {
        throw new Error('Invalid QR code: missing plant data');
      }

      return data.plant;
    } catch (e) {
      throw new Error(`Failed to parse QR code: ${e.message}`);
    }
  }

  /**
   * Scan QR code from image file
   * @param {File} file - Image file
   * @returns {Promise<string>} QR code data
   */
  async scanQRFromImage(file) {
    if (!('BarcodeDetector' in window)) {
      throw new Error('QR code scanning not supported in this browser');
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(canvas);

      if (results.length === 0) {
        throw new Error('No QR code found in image');
      }

      return results[0].rawValue;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Generate QR code as SVG
   * @param {string} data - Data to encode
   * @returns {Promise<string>} SVG string
   */
  async generateQRCodeSVG(data) {
    // Simple QR code generation using a library would go here
    // For now, we'll return a placeholder
    // In production, use a library like qrcode or qr-code-styling

    const size = 256;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
        <rect width="${size}" height="${size}" fill="white"/>
        <text x="50%" y="50%" text-anchor="middle" fill="black" font-size="12">
          QR Code: ${data.substring(0, 20)}...
        </text>
      </svg>
    `.trim();

    return svg;
  }

  /**
   * Download QR code as image
   * @param {string} data - Data to encode
   * @param {string} filename - Filename
   * @returns {Promise<void>}
   */
  async downloadQRCode(data, filename = 'qr-code.svg') {
    const svg = await this.generateQRCodeSVG(data);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Check if QR scanning is available
   * @returns {boolean}
   */
  isQRScanAvailable() {
    return 'BarcodeDetector' in window;
  }
}

// Singleton instance
export const qrService = new QRService();
