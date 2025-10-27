import { uid, toISODate, addDays } from '../utils/helpers.js';
import { validatePlant } from '../utils/validators.js';
import { store } from '../core/Store.js';

/**
 * Plant business logic service
 * @class
 */
export class PlantService {
  /**
   * @param {PlantRepository} plantRepo - Plant repository
   * @param {ActivityRepository} activityRepo - Activity repository
   * @param {PhotoRepository} photoRepo - Photo repository
   */
  constructor(plantRepo, activityRepo, photoRepo) {
    this.plantRepo = plantRepo;
    this.activityRepo = activityRepo;
    this.photoRepo = photoRepo;
  }

  /**
   * Create new plant
   * @param {Object} data - Plant data
   * @returns {Promise<Plant>}
   */
  async createPlant(data) {
    const validation = validatePlant(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const now = new Date().toISOString();
    const plant = {
      id: uid('p_'),
      name: data.name.trim(),
      species: data.species?.trim() || '',
      type: data.type || 'cactus',
      location: data.location?.trim() || '',
      waterIntervalDays: Number(data.waterIntervalDays) || 14,
      lastWatered: data.lastWatered || toISODate(new Date()),
      nextWaterDate: '',
      repotIntervalMonths: Number(data.repotIntervalMonths) || 12,
      lastRepot: data.lastRepot || '',
      tags: data.tags?.trim() || '',
      notes: data.notes?.trim() || '',
      photoIds: data.photoIds || [],
      createdAt: now,
      updatedAt: now
    };

    // Calculate next water date
    plant.nextWaterDate = addDays(plant.lastWatered, plant.waterIntervalDays);

    await this.plantRepo.save(plant);
    store.addPlant(plant);
    return plant;
  }

  /**
   * Update plant
   * @param {string} id - Plant ID
   * @param {Object} updates - Updates
   * @returns {Promise<Plant>}
   */
  async updatePlant(id, updates) {
    const existing = await this.plantRepo.getById(id);
    if (!existing) {
      throw new Error('Plant not found');
    }

    const updated = {
      ...existing,
      ...updates,
      id, // Preserve ID
      updatedAt: new Date().toISOString()
    };

    const validation = validatePlant(updated);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Recalculate next water date if interval or last watered changed
    if (updates.waterIntervalDays || updates.lastWatered) {
      updated.nextWaterDate = addDays(
        updated.lastWatered,
        updated.waterIntervalDays
      );
    }

    await this.plantRepo.save(updated);
    store.updatePlant(updated);
    return updated;
  }

  /**
   * Delete plant
   * @param {string} id - Plant ID
   * @returns {Promise<void>}
   */
  async deletePlant(id) {
    const plant = await this.plantRepo.getById(id);
    if (!plant) {
      throw new Error('Plant not found');
    }

    // Delete associated photos
    if (plant.photoIds && plant.photoIds.length > 0) {
      await this.photoRepo.deletePhotos(plant.photoIds);
    }

    // Delete associated activities
    await this.activityRepo.deleteByPlantId(id);

    await this.plantRepo.delete(id);
    store.removePlant(id);
    store.removeActivitiesForPlant(id);
  }

  /**
   * Duplicate plant
   * @param {string} id - Plant ID
   * @returns {Promise<Plant>}
   */
  async duplicatePlant(id) {
    const original = await this.plantRepo.getById(id);
    if (!original) {
      throw new Error('Plant not found');
    }

    const duplicate = {
      ...original,
      id: undefined,
      name: `${original.name} (copy)`,
      photoIds: [], // Don't copy photos
      createdAt: undefined,
      updatedAt: undefined
    };

    return this.createPlant(duplicate);
  }

  /**
   * Get plant by ID
   * @param {string} id - Plant ID
   * @returns {Promise<Plant>}
   */
  async getPlant(id) {
    return this.plantRepo.getById(id);
  }

  /**
   * Get all plants
   * @returns {Promise<Plant[]>}
   */
  async getAllPlants() {
    const plants = await this.plantRepo.getAll();
    store.setPlants(plants);
    return plants;
  }

  /**
   * Search plants
   * @param {string} query - Search query
   * @param {Object} filters - Filters
   * @returns {Promise<Plant[]>}
   */
  async searchPlants(query = '', filters = {}) {
    let plants = await this.plantRepo.getAll();

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      plants = plants.filter(p => {
        const searchText = [p.name, p.species, p.tags, p.location]
          .join(' ')
          .toLowerCase();
        return searchText.includes(q);
      });
    }

    // Type filter
    if (filters.type) {
      plants = plants.filter(p => p.type === filters.type);
    }

    // Location filter
    if (filters.location) {
      plants = plants.filter(p => p.location === filters.location);
    }

    return plants;
  }

  /**
   * Get due plants
   * @param {string} date - ISO date (default: today)
   * @returns {Promise<Plant[]>}
   */
  async getDuePlants(date = toISODate(new Date())) {
    const plants = await this.plantRepo.getAll();
    return plants.filter(p => p.nextWaterDate <= date);
  }

  /**
   * Get plant statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const plants = await this.plantRepo.getAll();
    const today = toISODate(new Date());
    const due = plants.filter(p => p.nextWaterDate <= today);
    const overdue = due.filter(p => p.nextWaterDate < today);

    const types = plants.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: plants.length,
      due: due.length,
      overdue: overdue.length,
      byType: types
    };
  }

  /**
   * Add photo to plant
   * @param {string} plantId - Plant ID
   * @param {string} photoId - Photo ID
   * @returns {Promise<void>}
   */
  async addPhotoToPlant(plantId, photoId) {
    const plant = await this.plantRepo.getById(plantId);
    if (!plant) {
      throw new Error('Plant not found');
    }

    const photoIds = plant.photoIds || [];
    if (!photoIds.includes(photoId)) {
      photoIds.push(photoId);
      await this.updatePlant(plantId, { photoIds });
    }
  }

  /**
   * Remove photo from plant
   * @param {string} plantId - Plant ID
   * @param {string} photoId - Photo ID
   * @returns {Promise<void>}
   */
  async removePhotoFromPlant(plantId, photoId) {
    const plant = await this.plantRepo.getById(plantId);
    if (!plant) {
      throw new Error('Plant not found');
    }

    const photoIds = (plant.photoIds || []).filter(id => id !== photoId);
    await this.updatePlant(plantId, { photoIds });
    await this.photoRepo.delete(photoId);
  }
}
