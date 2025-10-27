/**
 * CactoLog v2.0 - Main Application Entry Point
 * Production-ready offline-first plant tracker PWA
 */

import { router } from './core/Router.js';
import { store } from './core/Store.js';
import { eventBus } from './core/EventBus.js';

// Repositories
import { initDatabase, PlantRepository, ActivityRepository, SettingsRepository, PhotoRepository } from './repositories/Repository.js';

// Services
import { PlantService } from './services/PlantService.js';
import { ActivityService } from './services/ActivityService.js';
import { imageService } from './services/ImageService.js';
import { ExportService } from './services/ExportService.js';
import { qrService } from './services/QRService.js';

// UI Components
import { Toast } from './components/shared/Toast.js';
import { Loading } from './components/shared/Loading.js';
import { Dashboard } from './components/pages/Dashboard.js';
import { PlantList } from './components/pages/PlantList.js';
import { PlantForm } from './components/pages/PlantForm.js';
import { Calendar } from './components/pages/Calendar.js';
import { Settings } from './components/pages/Settings.js';

/**
 * Main App class
 * @class
 */
class App {
  constructor() {
    this.db = null;
    this.services = {};
    this.currentPage = null;
    this.themeMediaQuery = null;
    this.themeChangeHandler = null;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      // Show loading
      document.getElementById('app').innerHTML = '<div class="loading">Initializing...</div>';

      // Initialize database
      this.db = await initDatabase();

      // Initialize repositories
      const plantRepo = new PlantRepository(this.db);
      const activityRepo = new ActivityRepository(this.db);
      const settingsRepo = new SettingsRepository(this.db);
      const photoRepo = new PhotoRepository(this.db);

      // Initialize services
      this.services = {
        plantService: new PlantService(plantRepo, activityRepo, photoRepo),
        activityService: new ActivityService(activityRepo, plantRepo, photoRepo),
        imageService,
        exportService: new ExportService(plantRepo, activityRepo, settingsRepo),
        qrService,
        settingsRepo,
        photoRepo,
        store
      };

      // Load initial data into store
      await this.loadInitialData();

      // Initialize UI components
      this.initUI();

      // Setup routing
      this.setupRouting();

      // Initialize service worker
      this.registerServiceWorker();

      // Apply theme
      await this.applyInitialTheme();

      // Setup install prompt
      this.setupInstallPrompt();

      console.log('✅ CactoLog v2.0 initialized');
    } catch (err) {
      console.error('Failed to initialize app:', err);
      document.getElementById('app').innerHTML = `
        <div class="error">
          <h2>Failed to initialize app</h2>
          <p>${err.message}</p>
          <button onclick="window.location.reload()">Reload</button>
        </div>
      `;
    }
  }

  /**
   * Load initial data into store
   */
  async loadInitialData() {
    const [plants, activities, settings] = await Promise.all([
      this.services.plantService.getAllPlants(),
      this.services.activityService.getAllActivities(),
      this.services.settingsRepo.getSettings()
    ]);

    store.setPlants(plants);
    store.setActivities(activities);
    store.setSettings(settings);
  }

  /**
   * Initialize UI components
   */
  initUI() {
    // Toast notifications
    const toastContainer = document.getElementById('toastContainer');
    const toast = new Toast(toastContainer);
    toast.render();

    // Loading overlay
    const loadingContainer = document.getElementById('loadingContainer');
    const loading = new Loading(loadingContainer);
    loading.render();

    // Navigation
    this.setupNavigation();
  }

  /**
   * Setup navigation
   */
  setupNavigation() {
    const menuBtn = document.getElementById('menuBtn');
    const drawer = document.getElementById('drawer');
    const closeDrawer = document.getElementById('closeDrawer');

    menuBtn?.addEventListener('click', () => {
      drawer.classList.add('open');
    });

    closeDrawer?.addEventListener('click', () => {
      drawer.classList.remove('open');
    });

    // Close drawer on route change
    eventBus.on('route:changed', () => {
      drawer.classList.remove('open');
    });

    // Update active nav link
    eventBus.on('route:changed', ({ path }) => {
      document.querySelectorAll('[data-route]').forEach(link => {
        const route = link.getAttribute('href').replace('#', '');
        link.classList.toggle('active', path.startsWith(route));
      });
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle?.addEventListener('click', async () => {
      const settings = store.getState().settings;
      const themes = ['auto', 'light', 'dark'];
      const currentIndex = themes.indexOf(settings.theme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];

      await this.services.settingsRepo.saveSettings({ ...settings, theme: nextTheme });
      store.setSettings({ ...settings, theme: nextTheme });
      this.applyTheme(nextTheme);
    });

    // Reapply theme whenever settings change elsewhere (e.g., Settings page)
    eventBus.on('settings:updated', (updatedSettings = {}) => {
      this.applyTheme(updatedSettings.theme || 'auto');
    });
  }

  /**
   * Setup routing
   */
  setupRouting() {
    const appContainer = document.getElementById('app');

    // Define routes
    router.on('/', () => this.renderPage(appContainer, Dashboard));
    router.on('/dashboard', () => this.renderPage(appContainer, Dashboard));
    router.on('/plants', () => this.renderPage(appContainer, PlantList));
    router.on('/plants/new', () => this.renderPage(appContainer, PlantForm));
    router.on('/plants/:id', () => this.renderPage(appContainer, PlantForm));
    router.on('/plants/:id/edit', () => this.renderPage(appContainer, PlantForm));
    router.on('/calendar', () => this.renderPage(appContainer, Calendar));
    router.on('/settings', () => this.renderPage(appContainer, Settings));

    // Start router
    router.handleRouteChange();
  }

  /**
   * Render page component
   */
  async renderPage(container, PageComponent) {
    // Unmount previous page
    if (this.currentPage) {
      this.currentPage.unmount();
    }

    // Clear container
    container.innerHTML = '';

    // Create and mount new page
    this.currentPage = new PageComponent(container, this.services);
    this.currentPage.render();
    await this.currentPage.mounted();

    // Focus container for accessibility
    container.focus();
  }

  /**
   * Apply initial theme
   */
  async applyInitialTheme() {
    const settings = store.getState().settings;
    this.applyTheme(settings.theme || 'auto');
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme !== 'auto' && this.themeMediaQuery && this.themeChangeHandler) {
      this.themeMediaQuery.removeEventListener('change', this.themeChangeHandler);
      this.themeMediaQuery = null;
      this.themeChangeHandler = null;
    }

    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      // Auto - check system preference
      if (!this.themeMediaQuery) {
        this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.themeChangeHandler = () => this.applyTheme('auto');
        this.themeMediaQuery.addEventListener('change', this.themeChangeHandler);
      }

      if (!this.themeMediaQuery.matches) {
        root.classList.add('light');
      }
    }
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered');
      } catch (err) {
        console.warn('Service Worker registration failed:', err);
      }
    }
  }

  /**
   * Setup PWA install prompt
   */
  setupInstallPrompt() {
    let deferredPrompt = null;
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;

      if (installBtn) {
        installBtn.hidden = false;
      }
    });

    installBtn?.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      deferredPrompt.prompt();
      await deferredPrompt.userChoice;

      deferredPrompt = null;
      installBtn.hidden = true;
    });

    // Hide install button after app is installed
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (installBtn) {
        installBtn.hidden = true;
      }
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}

// Export for debugging
window.CactoLog = { router, store, eventBus };
