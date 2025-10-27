import { uid, toISODate, addDays } from '../utils/helpers.js';
import { validateActivity } from '../utils/validators.js';
import { store } from '../core/Store.js';

/**
 * Activity business logic service
 * @class
 */
export class ActivityService {
  /**
   * @param {ActivityRepository} activityRepo - Activity repository
   * @param {PlantRepository} plantRepo - Plant repository
   * @param {PhotoRepository} photoRepo - Photo repository
   */
  constructor(activityRepo, plantRepo, photoRepo) {
    this.activityRepo = activityRepo;
    this.plantRepo = plantRepo;
    this.photoRepo = photoRepo;
  }

  /**
   * Log activity
   * @param {Object} data - Activity data
   * @returns {Promise<Activity>}
   */
  async logActivity(data) {
    const validation = validateActivity(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const activity = {
      id: uid('a_'),
      plantId: data.plantId,
      type: data.type,
      date: data.date || toISODate(new Date()),
      note: data.note?.trim() || '',
      photoIds: data.photoIds || []
    };

    await this.activityRepo.save(activity);
    store.addActivity(activity);

    // Update plant based on activity type
    await this.updatePlantFromActivity(activity);

    return activity;
  }

  /**
   * Update plant state based on activity
   * @param {Activity} activity - Activity
   * @returns {Promise<void>}
   */
  async updatePlantFromActivity(activity) {
    const plant = await this.plantRepo.getById(activity.plantId);
    if (!plant) return;

    const updates = { updatedAt: new Date().toISOString() };

    if (activity.type === 'water') {
      updates.lastWatered = activity.date;
      updates.nextWaterDate = addDays(activity.date, plant.waterIntervalDays);
    }

    if (activity.type === 'repot') {
      updates.lastRepot = activity.date;
    }

    if (Object.keys(updates).length > 1) {
      const updated = { ...plant, ...updates };
      await this.plantRepo.save(updated);
      store.updatePlant(updated);
    }
  }

  /**
   * Get activity by ID
   * @param {string} id - Activity ID
   * @returns {Promise<Activity>}
   */
  async getActivity(id) {
    return this.activityRepo.getById(id);
  }

  /**
   * Get activities for plant
   * @param {string} plantId - Plant ID
   * @returns {Promise<Activity[]>}
   */
  async getActivitiesForPlant(plantId) {
    return this.activityRepo.getByPlantId(plantId);
  }

  /**
   * Get recent activities
   * @param {number} limit - Limit
   * @returns {Promise<Activity[]>}
   */
  async getRecentActivities(limit = 10) {
    return this.activityRepo.getRecent(limit);
  }

  /**
   * Get activities by date range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Activity[]>}
   */
  async getActivitiesByDateRange(startDate, endDate) {
    return this.activityRepo.getByDateRange(startDate, endDate);
  }

  /**
   * Get all activities
   * @returns {Promise<Activity[]>}
   */
  async getAllActivities() {
    const activities = await this.activityRepo.getAll();
    store.setActivities(activities);
    return activities;
  }

  /**
   * Search activities
   * @param {string} query - Search query
   * @param {Object} filters - Filters
   * @returns {Promise<Activity[]>}
   */
  async searchActivities(query = '', filters = {}) {
    let activities = await this.activityRepo.getAll();

    // Type filter
    if (filters.type) {
      activities = activities.filter(a => a.type === filters.type);
    }

    // Plant filter
    if (filters.plantId) {
      activities = activities.filter(a => a.plantId === filters.plantId);
    }

    // Date range filter
    if (filters.startDate && filters.endDate) {
      activities = activities.filter(
        a => a.date >= filters.startDate && a.date <= filters.endDate
      );
    }

    // Text search in notes
    if (query) {
      const q = query.toLowerCase();
      activities = activities.filter(a => a.note.toLowerCase().includes(q));
    }

    return activities.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Delete activity
   * @param {string} id - Activity ID
   * @returns {Promise<void>}
   */
  async deleteActivity(id) {
    const activity = await this.activityRepo.getById(id);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // Delete associated photos
    if (activity.photoIds && activity.photoIds.length > 0) {
      await this.photoRepo.deletePhotos(activity.photoIds);
    }

    await this.activityRepo.delete(id);
  }

  /**
   * Get activity statistics
   * @param {string} plantId - Optional plant ID filter
   * @returns {Promise<Object>}
   */
  async getStatistics(plantId = null) {
    let activities = await this.activityRepo.getAll();

    if (plantId) {
      activities = activities.filter(a => a.plantId === plantId);
    }

    const byType = activities.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {});

    const byMonth = activities.reduce((acc, a) => {
      const month = a.date.substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    return {
      total: activities.length,
      byType,
      byMonth
    };
  }
}
