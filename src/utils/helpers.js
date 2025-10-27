/**
 * Generate unique ID with prefix
 * @param {string} prefix - ID prefix
 * @returns {string}
 */
export const uid = (prefix = '') => prefix + crypto.randomUUID();

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string}
 */
export const toISODate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

/**
 * Get today's date as ISO string
 * @returns {string}
 */
export const todayISO = () => toISODate(new Date());

/**
 * Add days to ISO date string
 * @param {string} isoDate - ISO date string
 * @param {number} days - Days to add
 * @returns {string}
 */
export const addDays = (isoDate, days) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/**
 * Calculate difference in days between two ISO dates
 * @param {string} dateA - ISO date string
 * @param {string} dateB - ISO date string
 * @returns {number}
 */
export const diffDays = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
};

/**
 * Format date for display
 * @param {string} isoDate - ISO date string
 * @returns {string}
 */
export const fmtDate = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format relative time (e.g., "2 days ago")
 * @param {string} isoDate - ISO date string
 * @returns {string}
 */
export const relativeTime = (isoDate) => {
  const days = diffDays(todayISO(), isoDate);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
};

/**
 * Clamp number between min and max
 * @param {number} val - Value
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number}
 */
export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Sort array by key
 * @param {Array} arr - Array to sort
 * @param {string} key - Key to sort by
 * @param {boolean} desc - Descending order
 * @returns {Array}
 */
export const sortBy = (arr, key, desc = false) => {
  return [...arr].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (valA < valB) return desc ? 1 : -1;
    if (valA > valB) return desc ? -1 : 1;
    return 0;
  });
};

/**
 * Group array by key
 * @param {Array} arr - Array to group
 * @param {string|Function} keyOrFn - Key or function
 * @returns {Object}
 */
export const groupBy = (arr, keyOrFn) => {
  const fn = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return arr.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
};

/**
 * Generate calendar month matrix (6 weeks x 7 days)
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Array<Array<{date: string, inMonth: boolean}>>}
 */
export const monthMatrix = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const matrix = [];
  let currentDate = new Date(startDate);

  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let day = 0; day < 7; day++) {
      row.push({
        date: toISODate(currentDate),
        inMonth: currentDate.getMonth() === month
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    matrix.push(row);
  }

  return matrix;
};

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function}
 */
export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function}
 */
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Download file
 * @param {string} filename - Filename
 * @param {string} content - File content
 * @param {string} mimeType - MIME type
 */
export const download = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Read file as text
 * @param {File} file - File object
 * @returns {Promise<string>}
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Sleep/delay utility
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
