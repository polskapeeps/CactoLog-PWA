import { onAuthChange, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, getCurrentUser } from './firebase.js';
import { syncPlantsFromFirestore, syncActivitiesFromFirestore, savePlant, deletePlant, saveActivity, getAllPlants, getAllActivities, setupRealtimeListeners, loadSyncQueue } from './sync.js';
import { uploadPlantPhoto, uploadPlantThumbnail, fileToDataURL, deletePhoto } from './firebaseStorage.js';
import { uid, fmtDate, toISODate, addDays, diffDays } from './utils.js';

// App state
const state = {
  currentView: 'home',
  plants: [],
  activities: [],
  currentFilter: 'all',
  currentSort: 'urgency', // urgency, name, recent
  searchQuery: '',
  currentPlantId: null,
  isAuthMode: 'signin', // signin or signup
  settings: {
    theme: 'auto',
    notificationsEnabled: false,
    reminderTime: '09:00'
  }
};

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

let openAddPlantDialog = () => {};
let openPlantDetails = () => {};

// Theme handling
const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(mode) {
  document.documentElement.classList.remove('light');
  if (mode === 'light') document.documentElement.classList.add('light');
  if (mode === 'auto' && !colorScheme.matches) document.documentElement.classList.add('light');
}

// Initialize app
async function init() {
  // Load settings from localStorage
  const savedSettings = localStorage.getItem('settings');
  if (savedSettings) {
    state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
  }

  applyTheme(state.settings.theme);

  colorScheme.addEventListener('change', () => {
    if (state.settings.theme === 'auto') applyTheme('auto');
  });

  // Load sync queue
  loadSyncQueue();

  // Check auth state
  onAuthChange(async (user) => {
    if (user) {
      await onUserSignedIn();
    } else {
      showAuthScreen();
    }
  });

  // Set up auth UI
  setupAuthUI();

  // Set up main app UI
  setupMainAppUI();

  // Register service worker
  registerSW();
}

// Show auth screen
function showAuthScreen() {
  qs('#authScreen').hidden = false;
  qs('#mainApp').hidden = true;
}

// Hide auth screen and show main app
function showMainApp() {
  qs('#authScreen').hidden = true;
  qs('#mainApp').hidden = false;
}

// When user signs in
async function onUserSignedIn() {
  showMainApp();

  // Sync data from Firestore
  state.plants = await syncPlantsFromFirestore();
  state.activities = await syncActivitiesFromFirestore();

  // Set up real-time listeners
  setupRealtimeListeners(
    (plants) => {
      state.plants = plants;
      renderCurrentView();
    },
    (activities) => {
      state.activities = activities;
    }
  );

  // Render home view
  navigateTo('home');
}

// Set up auth UI
function setupAuthUI() {
  const form = qs('#authForm');
  const googleBtn = qs('#googleSignInBtn');
  const toggleBtn = qs('#authToggleBtn');
  const toggleText = qs('#authToggleText');
  const submitBtn = qs('#authSubmitBtn');

  // Toggle between sign in and sign up
  toggleBtn.addEventListener('click', () => {
    state.isAuthMode = state.isAuthMode === 'signin' ? 'signup' : 'signin';
    if (state.isAuthMode === 'signup') {
      toggleText.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Sign In';
      submitBtn.textContent = 'Sign Up';
    } else {
      toggleText.textContent = "Don't have an account?";
      toggleBtn.textContent = 'Sign Up';
      submitBtn.textContent = 'Sign In';
    }
  });

  // Email/password auth
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value;
    const password = form.password.value;

    try {
      if (state.isAuthMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });

  // Google sign in
  googleBtn.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
}

// Set up main app UI
function setupMainAppUI() {
  // Bottom navigation
  qsa('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.nav;
      if (view === 'add') {
        openAddPlantDialog();
      } else {
        navigateTo(view);
      }
    });
  });

  // Search
  const searchBtn = qs('#searchBtn');
  const searchBar = qs('#searchBar');
  const searchInput = qs('#searchInput');
  const closeSearchBtn = qs('#closeSearchBtn');

  searchBtn.addEventListener('click', () => {
    searchBar.hidden = false;
    searchInput.focus();
  });

  closeSearchBtn.addEventListener('click', () => {
    searchBar.hidden = true;
    state.searchQuery = '';
    searchInput.value = '';
    renderCurrentView();
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderCurrentView();
  });

  // Filter chips
  qsa('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentFilter = chip.dataset.filter;
      renderCurrentView();
    });
  });

  // Sort button
  qs('#sortBtn').addEventListener('click', () => {
    // Cycle through sort options
    const sorts = ['urgency', 'name', 'recent'];
    const currentIndex = sorts.indexOf(state.currentSort);
    state.currentSort = sorts[(currentIndex + 1) % sorts.length];
    renderCurrentView();
  });

  // Plant dialog
  setupPlantDialog();
  setupPlantDetailsDialog();
}

// Navigate to view
function navigateTo(view) {
  state.currentView = view;

  // Update nav buttons
  qsa('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === view);
  });

  renderCurrentView();
}

// Render current view
function renderCurrentView() {
  const app = qs('#app');

  if (state.currentView === 'home') {
    renderHome(app);
  } else if (state.currentView === 'settings') {
    renderSettings(app);
  }
}

// Render home view (plant grid)
function renderHome(container) {
  const tpl = qs('#tpl-home').content.cloneNode(true);
  container.innerHTML = '';

  const grid = qs('#plantGrid', tpl);
  const emptyState = qs('#emptyState', tpl);

  // Get filtered and sorted plants
  const plants = getFilteredSortedPlants();

  if (plants.length === 0) {
    emptyState.hidden = false;
    grid.hidden = true;
  } else {
    emptyState.hidden = true;
    grid.hidden = false;

    plants.forEach(plant => {
      const card = createPlantCard(plant);
      grid.appendChild(card);
    });
  }

  container.appendChild(tpl);
}

// Create plant card
function createPlantCard(plant) {
  const card = document.createElement('div');
  card.className = 'plant-card';

  const today = toISODate(new Date());
  const daysUntil = diffDays(plant.nextWaterDate, today);
  const isOverdue = daysUntil < 0;
  const isDueToday = daysUntil === 0;
  const isDueSoon = daysUntil > 0 && daysUntil <= 3;

  let badgeClass = 'ok';
  let badgeText = `${daysUntil} days`;

  if (isOverdue) {
    badgeClass = 'overdue';
    badgeText = `${Math.abs(daysUntil)} days overdue`;
  } else if (isDueToday) {
    badgeClass = 'due';
    badgeText = 'Due today';
  } else if (isDueSoon) {
    badgeClass = 'soon';
    badgeText = `${daysUntil} days`;
  }

  card.innerHTML = `
    <div class="plant-card-image" style="background-image: url('${plant.photoURL || plant.thumbnailURL || 'assets/placeholder.jpg'}')">
      <span class="water-badge ${badgeClass}">${badgeText}</span>
    </div>
    <div class="plant-card-info">
      <h3>${escapeHTML(plant.name)}</h3>
      <p class="plant-card-species">${escapeHTML(plant.species || plant.type || '')}</p>
    </div>
  `;

  card.addEventListener('click', () => {
    openPlantDetails(plant.id);
  });

  return card;
}

// Get filtered and sorted plants
function getFilteredSortedPlants() {
  let plants = [...state.plants];

  // Apply filter
  if (state.currentFilter !== 'all') {
    if (state.currentFilter === 'due') {
      const today = toISODate(new Date());
      plants = plants.filter(p => diffDays(p.nextWaterDate, today) <= 0);
    } else {
      plants = plants.filter(p => p.type === state.currentFilter);
    }
  }

  // Apply search
  if (state.searchQuery) {
    plants = plants.filter(p => {
      const searchable = [p.name, p.species, p.tags, p.location].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(state.searchQuery);
    });
  }

  // Apply sort
  const today = toISODate(new Date());
  if (state.currentSort === 'urgency') {
    plants.sort((a, b) => {
      const daysA = diffDays(a.nextWaterDate, today);
      const daysB = diffDays(b.nextWaterDate, today);
      return daysA - daysB; // Most urgent first
    });
  } else if (state.currentSort === 'name') {
    plants.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.currentSort === 'recent') {
    plants.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  return plants;
}

// Render settings
function renderSettings(container) {
  const tpl = qs('#tpl-settings').content.cloneNode(true);
  container.innerHTML = '';

  const user = getCurrentUser();
  qs('#userEmail', tpl).textContent = user?.email || 'Not signed in';

  const themeSelect = qs('#themeSelect', tpl);
  themeSelect.value = state.settings.theme;
  themeSelect.addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    applyTheme(state.settings.theme);
    saveSettings();
  });

  const notificationToggle = qs('#notificationToggle', tpl);
  notificationToggle.checked = state.settings.notificationsEnabled;
  notificationToggle.addEventListener('change', (e) => {
    state.settings.notificationsEnabled = e.target.checked;
    saveSettings();
    if (e.target.checked) {
      requestNotificationPermission();
    }
  });

  const reminderTime = qs('#reminderTime', tpl);
  reminderTime.value = state.settings.reminderTime;
  reminderTime.addEventListener('change', (e) => {
    state.settings.reminderTime = e.target.value;
    saveSettings();
  });

  qs('#signOutBtn', tpl).addEventListener('click', async () => {
    await signOut();
    state.plants = [];
    state.activities = [];
  });

  qs('#exportBtn', tpl).addEventListener('click', exportBackup);
  qs('#importFile', tpl).addEventListener('change', importBackup);

  container.appendChild(tpl);
}

// Save settings
function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(state.settings));
}

// Plant dialog
function setupPlantDialog() {
  const dialog = qs('#plantDialog');
  const form = qs('#plantForm');
  const photoInput = qs('#plantPhotoInput');
  const photoPreview = qs('#plantPhotoPreview');
  const closeBtn = qs('#closePlantDialog');
  const cancelBtn = qs('#cancelPlantBtn');

  let selectedFile = null;
  let currentPlant = null;

  // Photo upload
  photoPreview.addEventListener('click', () => {
    photoInput.click();
  });

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      const dataUrl = await fileToDataURL(file);
      photoPreview.style.backgroundImage = `url('${dataUrl}')`;
      photoPreview.style.backgroundSize = 'cover';
      photoPreview.style.backgroundPosition = 'center';
      photoPreview.innerHTML = '';
    }
  });

  // Close dialog
  const closeDialog = () => {
    dialog.close();
    form.reset();
    photoPreview.style.backgroundImage = '';
    photoPreview.innerHTML = `
      <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.5">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
      </svg>
      <p>Tap to add photo</p>
    `;
    selectedFile = null;
    currentPlant = null;
  };

  closeBtn.addEventListener('click', closeDialog);
  cancelBtn.addEventListener('click', closeDialog);

  // Submit form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const plantData = {
      name: formData.get('name').trim(),
      species: formData.get('species').trim(),
      type: formData.get('type'),
      location: formData.get('location').trim(),
      waterIntervalDays: Number(formData.get('waterIntervalDays') || 14),
      lastWatered: formData.get('lastWatered') || toISODate(new Date()),
      tags: formData.get('tags').trim(),
      notes: formData.get('notes').trim(),
    };

    // Calculate next water date
    plantData.nextWaterDate = addDays(plantData.lastWatered, plantData.waterIntervalDays);

    // Generate ID if new plant
    if (!currentPlant) {
      plantData.id = uid('p_');
      plantData.createdAt = new Date().toISOString();
    } else {
      plantData.id = currentPlant.id;
      plantData.createdAt = currentPlant.createdAt;
    }

    plantData.updatedAt = new Date().toISOString();

    // Upload photos if selected
    if (selectedFile) {
      try {
        const [photoURL, thumbnailURL] = await Promise.all([
          uploadPlantPhoto(selectedFile, plantData.id),
          uploadPlantThumbnail(selectedFile, plantData.id)
        ]);
        plantData.photoURL = photoURL;
        plantData.thumbnailURL = thumbnailURL;
      } catch (error) {
        console.error('Failed to upload photos:', error);
        // Use data URL as fallback
        plantData.photoData = await fileToDataURL(selectedFile);
      }
    } else if (currentPlant) {
      plantData.photoURL = currentPlant.photoURL;
      plantData.thumbnailURL = currentPlant.thumbnailURL;
      plantData.photoData = currentPlant.photoData;
    }

    // Save plant
    await savePlant(plantData);

    // Update local state
    const index = state.plants.findIndex(p => p.id === plantData.id);
    if (index >= 0) {
      state.plants[index] = plantData;
    } else {
      state.plants.push(plantData);
    }

    closeDialog();
    renderCurrentView();
  });

  // Function to open add/edit dialog
  openAddPlantDialog = (plant = null) => {
    currentPlant = plant;
    qs('#plantDialogTitle').textContent = plant ? 'Edit Plant' : 'Add Plant';

    if (plant) {
      form.name.value = plant.name || '';
      form.species.value = plant.species || '';
      form.type.value = plant.type || 'cactus';
      form.location.value = plant.location || '';
      form.waterIntervalDays.value = plant.waterIntervalDays || 14;
      form.lastWatered.value = plant.lastWatered || '';
      form.tags.value = plant.tags || '';
      form.notes.value = plant.notes || '';

      if (plant.photoURL || plant.thumbnailURL || plant.photoData) {
        const url = plant.thumbnailURL || plant.photoURL || plant.photoData;
        photoPreview.style.backgroundImage = `url('${url}')`;
        photoPreview.style.backgroundSize = 'cover';
        photoPreview.style.backgroundPosition = 'center';
        photoPreview.innerHTML = '';
      }
    } else {
      form.reset();
      form.lastWatered.value = toISODate(new Date());
    }

    dialog.showModal();
  };
}

// Plant details dialog
function setupPlantDetailsDialog() {
  const dialog = qs('#plantDetailsDialog');
  const closeBtn = qs('#closePlantDetails');
  const editBtn = qs('#editPlantBtn');
  const waterBtn = qs('#waterNowBtn');
  const deleteBtn = qs('#deletePlantBtn');

  closeBtn.addEventListener('click', () => dialog.close());

  editBtn.addEventListener('click', () => {
    const plant = state.plants.find(p => p.id === state.currentPlantId);
    if (plant) {
      dialog.close();
      openAddPlantDialog(plant);
    }
  });

  waterBtn.addEventListener('click', async () => {
    const plant = state.plants.find(p => p.id === state.currentPlantId);
    if (plant) {
      const today = toISODate(new Date());
      const activity = {
        id: uid('a_'),
        plantId: plant.id,
        type: 'water',
        date: today,
        note: '',
        timestamp: new Date().toISOString()
      };
      await saveActivity(activity);
      state.activities.push(activity);

      // Update plant
      plant.lastWatered = today;
      plant.nextWaterDate = addDays(today, plant.waterIntervalDays);
      plant.updatedAt = new Date().toISOString();
      await savePlant(plant);

      // Update local state
      const index = state.plants.findIndex(p => p.id === plant.id);
      if (index >= 0) {
        state.plants[index] = plant;
      }

      dialog.close();
      renderCurrentView();
    }
  });

  deleteBtn.addEventListener('click', async () => {
    const plantId = state.currentPlantId;
    if (!plantId) return;

    if (confirm('Delete this plant? This cannot be undone.')) {
      const plant = state.plants.find(p => p.id === plantId);
      await deletePlant(plantId);

      if (plant) {
        await Promise.all([
          deletePhoto(plant.photoURL),
          deletePhoto(plant.thumbnailURL)
        ]);
      }

      state.plants = state.plants.filter(p => p.id !== plantId);
      state.activities = state.activities.filter(a => a.plantId !== plantId);
      state.currentPlantId = null;
      dialog.close();
      renderCurrentView();
    }
  });

  openPlantDetails = (plantId) => {
    state.currentPlantId = plantId;
    const plant = state.plants.find(p => p.id === plantId);
    if (!plant) return;

    qs('#plantDetailsName').textContent = plant.name;
    qs('#detailSpecies').textContent = plant.species || '—';
    qs('#detailType').textContent = plant.type || '—';
    qs('#detailLocation').textContent = plant.location || '—';
    qs('#detailLastWatered').textContent = fmtDate(plant.lastWatered);
    qs('#detailNextWater').textContent = fmtDate(plant.nextWaterDate);

    const carousel = qs('#plantPhotoCarousel');
    carousel.innerHTML = '';
    const img = document.createElement('img');
    img.src = plant.photoURL || plant.photoData || 'assets/placeholder.jpg';
    img.alt = plant.name;
    carousel.appendChild(img);

    const notes = qs('#plantNotes');
    if (plant.notes) {
      notes.innerHTML = `<h4>Notes</h4><p>${escapeHTML(plant.notes)}</p>`;
    } else {
      notes.innerHTML = '';
    }

    dialog.showModal();
  };
}

// Export backup
async function exportBackup() {
  const backup = {
    plants: state.plants,
    activities: state.activities,
    settings: state.settings,
    exportedAt: new Date().toISOString(),
    version: '2.0.0'
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cactolog-backup-${toISODate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import backup
async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.plants || !Array.isArray(backup.plants)) {
      throw new Error('Invalid backup file');
    }

    if (confirm('This will replace all your current data. Continue?')) {
      // Import plants
      for (const plant of backup.plants) {
        await savePlant(plant);
      }

      // Import activities
      if (backup.activities) {
        for (const activity of backup.activities) {
          await saveActivity(activity);
        }
      }

      // Reload data
      state.plants = await getAllPlants();
      state.activities = await getAllActivities();
      renderCurrentView();
    }
  } catch (error) {
    alert('Failed to import backup: ' + error.message);
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// Register service worker
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.warn('SW registration failed:', error);
    }
  }
}

// Utility function
function escapeHTML(str = '') {
  return str.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]));
}

// Initialize app
init();
