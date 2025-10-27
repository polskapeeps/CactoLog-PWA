import { toISODate, download } from '../utils/helpers.js';
import { validateBackup } from '../utils/validators.js';

/**
 * Export and backup service
 * @class
 */
export class ExportService {
  /**
   * @param {PlantRepository} plantRepo - Plant repository
   * @param {ActivityRepository} activityRepo - Activity repository
   * @param {SettingsRepository} settingsRepo - Settings repository
   */
  constructor(plantRepo, activityRepo, settingsRepo) {
    this.plantRepo = plantRepo;
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
  }

  /**
   * Export full backup as JSON
   * @returns {Promise<string>}
   */
  async exportBackup() {
    const [plants, activities, settings] = await Promise.all([
      this.plantRepo.getAll(),
      this.activityRepo.getAll(),
      this.settingsRepo.getSettings()
    ]);

    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      plants,
      activities,
      settings
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import backup from JSON
   * @param {string} json - Backup JSON
   * @returns {Promise<void>}
   */
  async importBackup(json) {
    const data = JSON.parse(json);

    const validation = validateBackup(data);
    if (!validation.valid) {
      throw new Error(`Invalid backup: ${validation.errors.join(', ')}`);
    }

    // Clear existing data
    await Promise.all([
      this.plantRepo.clear(),
      this.activityRepo.clear()
    ]);

    // Import plants
    for (const plant of data.plants) {
      await this.plantRepo.save(plant);
    }

    // Import activities
    if (data.activities) {
      for (const activity of data.activities) {
        await this.activityRepo.save(activity);
      }
    }

    // Import settings
    if (data.settings) {
      await this.settingsRepo.saveSettings(data.settings);
    }
  }

  /**
   * Export backup and download
   * @returns {Promise<void>}
   */
  async downloadBackup() {
    const json = await this.exportBackup();
    const filename = `cactolog-backup-${toISODate(new Date())}.json`;
    download(filename, json, 'application/json');
  }

  /**
   * Export plants as CSV
   * @returns {Promise<string>}
   */
  async exportPlantsCSV() {
    const plants = await this.plantRepo.getAll();

    const headers = [
      'Name',
      'Species',
      'Type',
      'Location',
      'Water Interval (days)',
      'Last Watered',
      'Next Water Date',
      'Repot Interval (months)',
      'Last Repot',
      'Tags',
      'Notes'
    ];

    const rows = plants.map(p => [
      this.escapeCSV(p.name),
      this.escapeCSV(p.species),
      this.escapeCSV(p.type),
      this.escapeCSV(p.location),
      p.waterIntervalDays,
      p.lastWatered,
      p.nextWaterDate,
      p.repotIntervalMonths,
      p.lastRepot,
      this.escapeCSV(p.tags),
      this.escapeCSV(p.notes)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    return csv;
  }

  /**
   * Download plants as CSV
   * @returns {Promise<void>}
   */
  async downloadPlantsCSV() {
    const csv = await this.exportPlantsCSV();
    const filename = `cactolog-plants-${toISODate(new Date())}.csv`;
    download(filename, csv, 'text/csv');
  }

  /**
   * Export activities as CSV
   * @returns {Promise<string>}
   */
  async exportActivitiesCSV() {
    const [activities, plants] = await Promise.all([
      this.activityRepo.getAll(),
      this.plantRepo.getAll()
    ]);

    const plantMap = new Map(plants.map(p => [p.id, p.name]));

    const headers = ['Date', 'Plant', 'Type', 'Note'];

    const rows = activities.map(a => [
      a.date,
      this.escapeCSV(plantMap.get(a.plantId) || 'Unknown'),
      a.type,
      this.escapeCSV(a.note)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    return csv;
  }

  /**
   * Download activities as CSV
   * @returns {Promise<void>}
   */
  async downloadActivitiesCSV() {
    const csv = await this.exportActivitiesCSV();
    const filename = `cactolog-activities-${toISODate(new Date())}.csv`;
    download(filename, csv, 'text/csv');
  }

  /**
   * Export calendar events as ICS
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {Promise<string>}
   */
  async exportCalendarICS(year, month) {
    const plants = await this.plantRepo.getAll();

    const events = [];

    // Add watering events
    for (const plant of plants) {
      const nextWater = new Date(plant.nextWaterDate);
      if (nextWater.getFullYear() === year && nextWater.getMonth() === month) {
        events.push({
          date: plant.nextWaterDate,
          summary: `Water · ${plant.name}`
        });
      }
    }

    // Add repotting events
    for (const plant of plants) {
      if (plant.lastRepot && plant.repotIntervalMonths > 0) {
        const lastRepot = new Date(plant.lastRepot);
        const nextRepot = new Date(lastRepot);
        nextRepot.setMonth(nextRepot.getMonth() + plant.repotIntervalMonths);

        if (nextRepot.getFullYear() === year && nextRepot.getMonth() === month) {
          events.push({
            date: toISODate(nextRepot),
            summary: `Repot · ${plant.name}`
          });
        }
      }
    }

    // Generate ICS file
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CactoLog//EN',
      'CALSCALE:GREGORIAN'
    ];

    for (const event of events) {
      const dt = new Date(event.date + 'T09:00:00');
      const dtUTC = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${crypto.randomUUID()}`,
        `DTSTAMP:${dtUTC}`,
        `DTSTART:${dtUTC}`,
        `SUMMARY:${event.summary}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
  }

  /**
   * Download calendar as ICS
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {Promise<void>}
   */
  async downloadCalendarICS(year, month) {
    const ics = await this.exportCalendarICS(year, month);
    const monthStr = String(month + 1).padStart(2, '0');
    const filename = `cactolog-${year}-${monthStr}.ics`;
    download(filename, ics, 'text/calendar');
  }

  /**
   * Escape CSV field
   * @param {string} field - Field value
   * @returns {string}
   */
  escapeCSV(field) {
    if (!field) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
