import { eventBus } from './EventBus.js';

/**
 * @typedef {Object} Plant
 * @property {string} id
 * @property {string} name
 * @property {string} species
 * @property {string} type
 * @property {string} location
 * @property {number} waterIntervalDays
 * @property {string} lastWatered
 * @property {string} nextWaterDate
 * @property {number} repotIntervalMonths
 * @property {string} lastRepot
 * @property {string} tags
 * @property {string} notes
 * @property {string[]} photoIds
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Activity
 * @property {string} id
 * @property {string} plantId
 * @property {string} type
 * @property {string} date
 * @property {string} note
 * @property {string[]} photoIds
 */

/**
 * @typedef {Object} Settings
 * @property {string} theme
 * @property {boolean} useNotifications
 * @property {string} notifyTime
 * @property {string} version
 * @property {boolean} enableCamera
 * @property {boolean} enableGeolocation
 */

/**
 * Central application state store
 * @class
 */
export class Store {
  constructor() {
    /** @type {{ plants: Plant[], activities: Activity[], settings: Settings, photos: Map<string, Blob> }} */
    this.state = {
      plants: [],
      activities: [],
      settings: {
        theme: 'auto',
        useNotifications: false,
        notifyTime: '09:00',
        version: '2.0.0',
        enableCamera: true,
        enableGeolocation: false
      },
      photos: new Map()
    };

    this.loading = false;
    this.error = null;
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return this.state;
  }

  /**
   * Update state and emit change event
   * @param {Object} updates - State updates
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
    eventBus.emit('state:changed', this.state);
  }

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    this.loading = loading;
    eventBus.emit('state:loading', loading);
  }

  /**
   * Set error state
   * @param {Error|string|null} error - Error
   */
  setError(error) {
    this.error = error;
    eventBus.emit('state:error', error);
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setError(null);
  }

  // Plant state mutations
  setPlants(plants) {
    this.setState({ plants });
    eventBus.emit('plants:updated', plants);
  }

  addPlant(plant) {
    const plants = [...this.state.plants, plant];
    this.setPlants(plants);
    eventBus.emit('plant:created', plant);
  }

  updatePlant(plant) {
    const plants = this.state.plants.map(p => p.id === plant.id ? plant : p);
    this.setPlants(plants);
    eventBus.emit('plant:updated', plant);
  }

  removePlant(id) {
    const plants = this.state.plants.filter(p => p.id !== id);
    this.setPlants(plants);
    eventBus.emit('plant:deleted', id);
  }

  getPlantById(id) {
    return this.state.plants.find(p => p.id === id);
  }

  // Activity state mutations
  setActivities(activities) {
    this.setState({ activities });
    eventBus.emit('activities:updated', activities);
  }

  addActivity(activity) {
    const activities = [...this.state.activities, activity];
    this.setActivities(activities);
    eventBus.emit('activity:created', activity);
  }

  removeActivitiesForPlant(plantId) {
    const activities = this.state.activities.filter(a => a.plantId !== plantId);
    this.setActivities(activities);
  }

  // Settings state mutations
  setSettings(settings) {
    this.state.settings = { ...this.state.settings, ...settings };
    this.setState({ settings: this.state.settings });
    eventBus.emit('settings:updated', this.state.settings);
  }

  // Photo state mutations
  setPhoto(id, blob) {
    this.state.photos.set(id, blob);
    eventBus.emit('photo:added', { id, blob });
  }

  getPhoto(id) {
    return this.state.photos.get(id);
  }

  removePhoto(id) {
    this.state.photos.delete(id);
    eventBus.emit('photo:removed', id);
  }
}

// Global singleton instance
export const store = new Store();
