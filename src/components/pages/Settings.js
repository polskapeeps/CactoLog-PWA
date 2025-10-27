import { Component } from '../../core/Component.js';
import { store as appStore } from '../../core/Store.js';
import { showSuccess, showError } from '../shared/Toast.js';
import { showLoading, hideLoading } from '../shared/Loading.js';
import { showConfirm } from '../shared/Modal.js';
import { readFileAsText } from '../../utils/helpers.js';

/**
 * Settings page component
 * @class
 */
export class Settings extends Component {
  constructor(container, { settingsRepo, exportService, photoRepo, store }) {
    super(container);
    this.settingsRepo = settingsRepo;
    this.exportService = exportService;
    this.photoRepo = photoRepo || exportService?.photoRepo || null;
    this.store = store || appStore;

    this.state = {
      settings: {
        theme: 'auto',
        useNotifications: false,
        notifyTime: '09:00',
        version: '2.0.0'
      }
    };
  }

  async mounted() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const stored = await this.settingsRepo.getSettings();
      const cleanStored = { ...(stored || {}) };
      delete cleanStored.key;
      const settings = { ...this.state.settings, ...cleanStored };
      this.setState({ settings });
    } catch (err) {
      showError(`Failed to load settings: ${err.message}`);
    }
  }

  render() {
    const { settings } = this.state;

    const page = this.el('section', { className: 'section settings' }, [
      this.el('h2', {}, 'Settings'),

      // Appearance
      this.el('div', { className: 'settings-group' }, [
        this.el('h3', {}, 'Appearance'),

        this.el('label', { className: 'setting-item' }, [
          'Theme',
          this.el('select', {
            name: 'theme',
            value: settings.theme,
            onChange: (e) => this.updateSetting('theme', e.target.value)
          }, [
            this.el('option', { value: 'auto' }, 'Auto (System)'),
            this.el('option', { value: 'light' }, 'Light'),
            this.el('option', { value: 'dark' }, 'Dark')
          ])
        ])
      ]),

      // Notifications
      this.el('div', { className: 'settings-group' }, [
        this.el('h3', {}, 'Notifications'),

        this.el('label', { className: 'setting-item' }, [
          this.el('input', {
            type: 'checkbox',
            name: 'useNotifications',
            checked: settings.useNotifications,
            onChange: (e) => this.updateSetting('useNotifications', e.target.checked)
          }),
          ' Enable watering reminders'
        ]),

        this.el('label', { className: 'setting-item' }, [
          'Reminder time',
          this.el('input', {
            type: 'time',
            name: 'notifyTime',
            value: settings.notifyTime,
            onChange: (e) => this.updateSetting('notifyTime', e.target.value)
          })
        ])
      ]),

      // Data
      this.el('div', { className: 'settings-group' }, [
        this.el('h3', {}, 'Data'),

        this.el('div', { className: 'row' }, [
          this.el('button', {
            className: 'btn',
            onClick: () => this.exportBackup()
          }, 'Export Backup (JSON)'),

          this.el('button', {
            className: 'btn',
            onClick: () => this.exportPlantsCSV()
          }, 'Export Plants (CSV)'),

          this.el('button', {
            className: 'btn',
            onClick: () => this.exportActivitiesCSV()
          }, 'Export Activities (CSV)')
        ]),

        this.el('div', { className: 'row', style: 'margin-top: 1rem;' }, [
          this.el('label', { className: 'btn' }, [
            'Import Backup',
            this.el('input', {
              type: 'file',
              accept: '.json',
              style: 'display: none;',
              onChange: (e) => this.importBackup(e.target.files[0])
            })
          ]),

          this.el('button', {
            className: 'btn danger',
            onClick: () => this.clearAllData()
          }, 'Clear All Data')
        ])
      ]),

      // About
      this.el('details', { className: 'settings-group' }, [
        this.el('summary', {}, this.el('h3', {}, 'About')),
        this.el('p', {}, 'CactoLog - Offline-first plant tracker'),
        this.el('p', {}, [
          'Version: ',
          this.el('strong', {}, settings.version)
        ]),
        this.el('p', {}, 'All data is stored locally in your browser using IndexedDB.'),
        this.el('p', {}, [
          this.el('a', {
            href: 'https://github.com/polskapeeps/CactoLog-PWA',
            target: '_blank',
            rel: 'noopener'
          }, 'View on GitHub')
        ])
      ])
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(page);
  }

  async updateSetting(key, value) {
    try {
      const settings = { ...this.state.settings, [key]: value };
      const persistable = { ...settings };
      delete persistable.key;
      await this.settingsRepo.saveSettings(persistable);
      this.setState({ settings: persistable });
      this.store?.setSettings(persistable);

      // Apply theme immediately
      if (key === 'theme') {
        this.applyTheme(value);
      }

      showSuccess('Settings saved');
    } catch (err) {
      showError(`Failed to save settings: ${err.message}`);
    }
  }

  applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      // Auto - check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!prefersDark) {
        root.classList.add('light');
      }
    }
  }

  async exportBackup() {
    try {
      showLoading();
      await this.exportService.downloadBackup();
      hideLoading();
      showSuccess('Backup exported!');
    } catch (err) {
      hideLoading();
      showError(`Failed to export backup: ${err.message}`);
    }
  }

  async exportPlantsCSV() {
    try {
      showLoading();
      await this.exportService.downloadPlantsCSV();
      hideLoading();
      showSuccess('Plants exported!');
    } catch (err) {
      hideLoading();
      showError(`Failed to export plants: ${err.message}`);
    }
  }

  async exportActivitiesCSV() {
    try {
      showLoading();
      await this.exportService.downloadActivitiesCSV();
      hideLoading();
      showSuccess('Activities exported!');
    } catch (err) {
      hideLoading();
      showError(`Failed to export activities: ${err.message}`);
    }
  }

  async importBackup(file) {
    if (!file) return;

    const confirmed = await showConfirm({
      title: 'Import Backup',
      message: 'This will replace all current data. Are you sure?',
      confirmLabel: 'Import',
      cancelLabel: 'Cancel'
    });

    if (!confirmed) return;

    try {
      showLoading();
      const json = await readFileAsText(file);
      await this.exportService.importBackup(json);
      hideLoading();
      showSuccess('Backup imported! Reloading...');

      // Reload page to refresh all data
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      hideLoading();
      showError(`Failed to import backup: ${err.message}`);
    }
  }

  async clearAllData() {
    const confirmed = await showConfirm({
      title: 'Clear All Data',
      message: 'This will permanently delete all plants, activities, and photos. This cannot be undone!',
      confirmLabel: 'Clear All',
      cancelLabel: 'Cancel'
    });

    if (!confirmed) return;

    try {
      showLoading();
      // Clear all repositories
      await this.exportService.plantRepo.clear();
      await this.exportService.activityRepo.clear();
      await this.photoRepo?.clear();
      hideLoading();
      showSuccess('All data cleared! Reloading...');

      // Reload page
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      hideLoading();
      showError(`Failed to clear data: ${err.message}`);
    }
  }
}
