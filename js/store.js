import { savePlant, deletePlant, saveActivity, syncPlantsFromFirestore, syncActivitiesFromFirestore } from './sync.js';
import { uid, toISODate, addDays, diffDays } from './utils.js';
import { DB } from './db.js';

const localDB = new DB('cactolog', 2);

export class Store {
  constructor() {
    this.cache = { plants: [], activities: [], settings: {} };
    this.listeners = [];
  }

  /**
   * Initialize store and sync with Firebase
   */
  async init() {
    await localDB.open();

    // Load settings from IndexedDB
    const s = await localDB.get('settings', 'app');
    this.cache.settings = s || {
      theme: 'auto',
      useNotifications: false,
      notifyTime: '09:00',
      version: '2.0.0'
    };
    if (!s) await localDB.put('settings', this.cache.settings, 'app');

    // Try to sync from Firebase (will use local cache if offline)
    await this.syncFromFirebase();

    return this.cache;
  }

  /**
   * Sync data from Firebase
   */
  async syncFromFirebase() {
    try {
      this.cache.plants = await syncPlantsFromFirestore();
      this.cache.activities = await syncActivitiesFromFirestore();
    } catch (error) {
      console.error('Initial sync failed, using local cache:', error);
      // Fallback to local cache
      this.cache.plants = await localDB.getAll('plants');
      this.cache.activities = await localDB.getAll('activities');
    }
    this.notifyListeners();
  }

  /**
   * Subscribe to data changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of data changes
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.cache);
    }
  }

  // Settings
  get settings() {
    return this.cache.settings;
  }

  async saveSettings(patch) {
    Object.assign(this.cache.settings, patch);
    await localDB.put('settings', this.cache.settings, 'app');
    this.notifyListeners();
    return this.cache.settings;
  }

  // Plants
  async upsertPlant(data) {
    const now = new Date().toISOString();

    if (!data.id) {
      data.id = uid('p_');
      data.createdAt = now;
    }

    data.updatedAt = now;

    // Compute next water date
    if (!data.lastWatered) data.lastWatered = toISODate(new Date());
    if (!data.waterIntervalDays) data.waterIntervalDays = 14;
    data.nextWaterDate = addDays(data.lastWatered, data.waterIntervalDays);

    // Save via sync layer (handles both local and Firebase)
    await savePlant(data);

    // Update local cache
    const idx = this.cache.plants.findIndex(p => p.id === data.id);
    if (idx >= 0) {
      this.cache.plants[idx] = data;
    } else {
      this.cache.plants.push(data);
    }

    this.notifyListeners();
    return data;
  }

  async deletePlant(id) {
    // Delete via sync layer
    await deletePlant(id);

    // Remove from cache
    this.cache.plants = this.cache.plants.filter(p => p.id !== id);

    // Delete related activities
    const relatedActivities = this.cache.activities.filter(a => a.plantId === id);
    for (const activity of relatedActivities) {
      await localDB.delete('activities', activity.id);
    }
    this.cache.activities = this.cache.activities.filter(a => a.plantId !== id);

    this.notifyListeners();
    return true;
  }

  getPlant(id) {
    return this.cache.plants.find(p => p.id === id);
  }

  // Activities
  async addActivity({ plantId, type, date, note, photoURL }) {
    const id = uid('a_');
    const when = date || toISODate(new Date());

    const act = {
      id,
      plantId,
      type,
      date: when,
      note: note || '',
      photoURL: photoURL || null,
      timestamp: new Date().toISOString()
    };

    // Save via sync layer
    await saveActivity(act);

    // Add to cache
    this.cache.activities.push(act);

    // React to activity types
    const plant = this.cache.plants.find(p => p.id === plantId);
    if (plant) {
      if (type === 'water') {
        plant.lastWatered = when;
        plant.nextWaterDate = addDays(when, plant.waterIntervalDays || 14);
        plant.updatedAt = new Date().toISOString();
        await savePlant(plant);

        // Update cache
        const idx = this.cache.plants.findIndex(p => p.id === plantId);
        if (idx >= 0) this.cache.plants[idx] = plant;
      }
    }

    this.notifyListeners();
    return act;
  }

  getActivitiesForPlant(plantId) {
    return this.cache.activities
      .filter(a => a.plantId === plantId)
      .sort((a, b) => a.date < b.date ? 1 : -1);
  }

  recentActivity(limit = 10) {
    return [...this.cache.activities]
      .sort((a, b) => a.date < b.date ? 1 : -1)
      .slice(0, limit);
  }

  // Queries
  listPlants({ search = '', type = '', sortBy = 'urgency' } = {}) {
    const s = search.trim().toLowerCase();

    let filtered = this.cache.plants.filter(p => {
      const matchType = type ? p.type === type : true;
      if (!s) return matchType;
      const hay = [p.name, p.species, p.tags, p.location].filter(Boolean).join(' ').toLowerCase();
      return matchType && hay.includes(s);
    });

    // Sorting
    if (sortBy === 'urgency') {
      const today = toISODate(new Date());
      filtered = filtered
        .map(p => ({ ...p, overdueDays: diffDays(today, p.nextWaterDate) }))
        .sort((a, b) => b.overdueDays - a.overdueDays);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    }

    return filtered;
  }

  duePlants(onDate = toISODate(new Date())) {
    return this.cache.plants
      .map(p => ({ ...p, overdueDays: diffDays(onDate, p.nextWaterDate) }))
      .filter(p => p.overdueDays >= 0)
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }

  // Water status helpers
  getWaterStatus(plant) {
    const today = toISODate(new Date());
    const daysUntilDue = -diffDays(today, plant.nextWaterDate);

    if (daysUntilDue < 0) {
      return { status: 'overdue', days: Math.abs(daysUntilDue), class: 'bad' };
    } else if (daysUntilDue === 0) {
      return { status: 'due', days: 0, class: 'warn' };
    } else if (daysUntilDue <= 2) {
      return { status: 'soon', days: daysUntilDue, class: 'warn' };
    } else {
      return { status: 'ok', days: daysUntilDue, class: 'ok' };
    }
  }

  // Export/Import
  async exportBackup() {
    const payload = {
      plants: this.cache.plants,
      activities: this.cache.activities,
      settings: this.cache.settings,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
    return JSON.stringify(payload, null, 2);
  }

  async importBackup(json) {
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.plants)) {
      throw new Error('Invalid backup file');
    }

    // Clear and replace
    await localDB.clear('plants');
    await localDB.clear('activities');
    this.cache.plants = [];
    this.cache.activities = [];

    // Import plants
    for (const p of data.plants) {
      await this.upsertPlant(p);
    }

    // Import activities
    for (const a of data.activities) {
      await this.addActivity(a);
    }

    // Import settings
    if (data.settings) {
      await this.saveSettings(data.settings);
    }

    this.notifyListeners();
    return true;
  }
}
