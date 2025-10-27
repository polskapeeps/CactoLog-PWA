import { Database } from './Database.js';

/**
 * Initialize database with schema
 * @returns {Promise<Database>}
 */
export async function initDatabase() {
  const db = new Database('cactolog', 3);

  await db.open((idb, oldVersion, newVersion) => {
    // Plants store
    if (!idb.objectStoreNames.contains('plants')) {
      const plantStore = idb.createObjectStore('plants', { keyPath: 'id' });
      plantStore.createIndex('by_name', 'name', { unique: false });
      plantStore.createIndex('by_type', 'type', { unique: false });
      plantStore.createIndex('by_nextWater', 'nextWaterDate', { unique: false });
    }

    // Activities store
    if (!idb.objectStoreNames.contains('activities')) {
      const activityStore = idb.createObjectStore('activities', { keyPath: 'id' });
      activityStore.createIndex('by_plant', 'plantId', { unique: false });
      activityStore.createIndex('by_date', 'date', { unique: false });
      activityStore.createIndex('by_type', 'type', { unique: false });
    }

    // Settings store
    if (!idb.objectStoreNames.contains('settings')) {
      idb.createObjectStore('settings', { keyPath: 'key' });
    }

    // Photos store (Blob storage)
    if (!idb.objectStoreNames.contains('photos')) {
      const photoStore = idb.createObjectStore('photos', { keyPath: 'id' });
      photoStore.createIndex('by_created', 'createdAt', { unique: false });
    }
  });

  return db;
}

/**
 * Base Repository class
 * @class
 */
export class Repository {
  /**
   * @param {Database} db - Database instance
   * @param {string} storeName - Store name
   */
  constructor(db, storeName) {
    this.db = db;
    this.storeName = storeName;
  }

  /**
   * Get by ID
   * @param {string} id - ID
   * @returns {Promise<*>}
   */
  async getById(id) {
    return this.db.get(this.storeName, id);
  }

  /**
   * Get all
   * @returns {Promise<Array>}
   */
  async getAll() {
    return this.db.getAll(this.storeName);
  }

  /**
   * Save (insert or update)
   * @param {*} entity - Entity
   * @returns {Promise<*>}
   */
  async save(entity) {
    await this.db.put(this.storeName, entity);
    return entity;
  }

  /**
   * Delete by ID
   * @param {string} id - ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    return this.db.delete(this.storeName, id);
  }

  /**
   * Clear all
   * @returns {Promise<void>}
   */
  async clear() {
    return this.db.clear(this.storeName);
  }

  /**
   * Count
   * @returns {Promise<number>}
   */
  async count() {
    return this.db.count(this.storeName);
  }
}

/**
 * Plant Repository
 * @class
 */
export class PlantRepository extends Repository {
  constructor(db) {
    super(db, 'plants');
  }

  /**
   * Get plants by type
   * @param {string} type - Plant type
   * @returns {Promise<Array>}
   */
  async getByType(type) {
    return this.db.getAllByIndex(this.storeName, 'by_type', type);
  }

  /**
   * Get due plants
   * @param {string} date - ISO date
   * @returns {Promise<Array>}
   */
  async getDuePlants(date) {
    const plants = await this.getAll();
    return plants.filter(p => p.nextWaterDate <= date);
  }

  /**
   * Search plants
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const plants = await this.getAll();
    const q = query.toLowerCase();
    return plants.filter(p => {
      const searchText = [p.name, p.species, p.tags, p.location].join(' ').toLowerCase();
      return searchText.includes(q);
    });
  }
}

/**
 * Activity Repository
 * @class
 */
export class ActivityRepository extends Repository {
  constructor(db) {
    super(db, 'activities');
  }

  /**
   * Get activities for plant
   * @param {string} plantId - Plant ID
   * @returns {Promise<Array>}
   */
  async getByPlantId(plantId) {
    return this.db.getAllByIndex(this.storeName, 'by_plant', plantId);
  }

  /**
   * Get activities by date range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Array>}
   */
  async getByDateRange(startDate, endDate) {
    const activities = await this.getAll();
    return activities.filter(a => a.date >= startDate && a.date <= endDate);
  }

  /**
   * Get recent activities
   * @param {number} limit - Limit
   * @returns {Promise<Array>}
   */
  async getRecent(limit = 10) {
    const activities = await this.getAll();
    return activities
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  /**
   * Delete activities for plant
   * @param {string} plantId - Plant ID
   * @returns {Promise<void>}
   */
  async deleteByPlantId(plantId) {
    const activities = await this.getByPlantId(plantId);
    for (const activity of activities) {
      await this.delete(activity.id);
    }
  }
}

/**
 * Settings Repository
 * @class
 */
export class SettingsRepository extends Repository {
  constructor(db) {
    super(db, 'settings');
  }

  /**
   * Get settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    return this.db.get(this.storeName, 'app') || {};
  }

  /**
   * Save settings
   * @param {Object} settings - Settings
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    await this.db.put(this.storeName, { key: 'app', ...settings }, 'app');
  }
}

/**
 * Photo Repository
 * @class
 */
export class PhotoRepository extends Repository {
  constructor(db) {
    super(db, 'photos');
  }

  /**
   * Save photo Blob
   * @param {string} id - Photo ID
   * @param {Blob} blob - Photo Blob
   * @param {Object} metadata - Metadata
   * @returns {Promise<void>}
   */
  async savePhoto(id, blob, metadata = {}) {
    await this.db.put(this.storeName, {
      id,
      blob,
      createdAt: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Get photo Blob
   * @param {string} id - Photo ID
   * @returns {Promise<Blob|null>}
   */
  async getPhoto(id) {
    const record = await this.db.get(this.storeName, id);
    return record?.blob || null;
  }

  /**
   * Delete photos by IDs
   * @param {string[]} ids - Photo IDs
   * @returns {Promise<void>}
   */
  async deletePhotos(ids) {
    for (const id of ids) {
      await this.delete(id);
    }
  }
}
