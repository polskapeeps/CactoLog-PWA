/**
 * Validation utilities
 */

/**
 * Validate plant data
 * @param {Object} data - Plant data
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validatePlant = (data) => {
  const errors = [];

  if (!data.name || !data.name.trim()) {
    errors.push('Plant name is required');
  }

  if (data.name && data.name.length > 100) {
    errors.push('Plant name must be 100 characters or less');
  }

  const waterInterval = Number(data.waterIntervalDays);
  if (isNaN(waterInterval) || waterInterval < 1 || waterInterval > 365) {
    errors.push('Water interval must be between 1 and 365 days');
  }

  const repotInterval = Number(data.repotIntervalMonths);
  if (isNaN(repotInterval) || repotInterval < 0 || repotInterval > 120) {
    errors.push('Repot interval must be between 0 and 120 months');
  }

  if (data.lastWatered && !isValidDate(data.lastWatered)) {
    errors.push('Invalid last watered date');
  }

  if (data.lastRepot && !isValidDate(data.lastRepot)) {
    errors.push('Invalid last repot date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate activity data
 * @param {Object} data - Activity data
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateActivity = (data) => {
  const errors = [];

  if (!data.plantId) {
    errors.push('Plant ID is required');
  }

  if (!data.type) {
    errors.push('Activity type is required');
  }

  if (!data.date || !isValidDate(data.date)) {
    errors.push('Valid date is required');
  }

  const validTypes = ['water', 'repot', 'fertilize', 'pest', 'note', 'custom'];
  if (data.type && !validTypes.includes(data.type)) {
    errors.push('Invalid activity type');
  }

  if (data.note && data.note.length > 500) {
    errors.push('Note must be 500 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate image file
 * @param {File} file - File object
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateImage = (file) => {
  const errors = [];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!file.type.startsWith('image/')) {
    errors.push('File must be an image');
  }

  if (file.size > maxSize) {
    errors.push('Image must be under 10MB');
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!validTypes.includes(file.type)) {
    errors.push('Image must be JPEG, PNG, WebP, or HEIC format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate backup data structure
 * @param {Object} data - Backup data
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateBackup = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup data');
    return { valid: false, errors };
  }

  if (!Array.isArray(data.plants)) {
    errors.push('Backup must contain plants array');
  }

  if (data.plants) {
    data.plants.forEach((plant, i) => {
      if (!plant.name || typeof plant.name !== 'string') {
        errors.push(`Plant ${i + 1}: Name is required`);
      }
      if (plant.waterIntervalDays && (typeof plant.waterIntervalDays !== 'number' || plant.waterIntervalDays < 1)) {
        errors.push(`Plant ${i + 1}: Invalid water interval`);
      }
    });
  }

  if (data.activities && !Array.isArray(data.activities)) {
    errors.push('Activities must be an array');
  }

  if (data.activities) {
    data.activities.forEach((activity, i) => {
      if (!activity.plantId || !activity.type || !activity.date) {
        errors.push(`Activity ${i + 1}: Missing required fields`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Check if string is valid ISO date
 * @param {string} dateString - Date string
 * @returns {boolean}
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Sanitize string for safe display
 * @param {string} str - String to sanitize
 * @returns {string}
 */
export const sanitize = (str) => {
  if (!str) return '';
  return String(str).trim();
};

/**
 * Validate settings data
 * @param {Object} data - Settings data
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateSettings = (data) => {
  const errors = [];

  const validThemes = ['auto', 'light', 'dark'];
  if (data.theme && !validThemes.includes(data.theme)) {
    errors.push('Invalid theme');
  }

  if (data.notifyTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.notifyTime)) {
    errors.push('Invalid notification time format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
