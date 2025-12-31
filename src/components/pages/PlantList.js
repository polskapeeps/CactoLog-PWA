import { Component } from '../../core/Component.js';
import { eventBus } from '../../core/EventBus.js';
import { router } from '../../core/Router.js';
import { debounce } from '../../utils/helpers.js';
import { showSuccess, showError } from '../shared/Toast.js';
import { showLoading, hideLoading } from '../shared/Loading.js';
import { showConfirm } from '../shared/Modal.js';

/**
 * Plant list page component
 * @class
 */
export class PlantList extends Component {
  constructor(container, { plantService }) {
    super(container);
    this.plantService = plantService;
    this.state = {
      plants: [],
      filteredPlants: [],
      searchQuery: '',
      typeFilter: '',
      sortBy: 'name'
    };
    this.subscribe();
    this.debouncedSearch = debounce((query) => this.performSearch(query), 300);
  }

  subscribe() {
    this.subscriptions.push(
      eventBus.on('plants:updated', () => this.loadPlants())
    );
  }

  async mounted() {
    await this.loadPlants();
  }

  async loadPlants() {
    try {
      const plants = await this.plantService.getAllPlants();
      this.setState({ plants, filteredPlants: plants });
      this.applyFilters();
    } catch (err) {
      showError(`Failed to load plants: ${err.message}`);
    }
  }

  render() {
    const { filteredPlants, searchQuery, typeFilter, sortBy } = this.state;

    const page = this.el('section', { className: 'section plant-list' }, [
      // Toolbar
      this.el('div', { className: 'toolbar' }, [
        this.el('div', { className: 'search-box' }, [
          this.el('input', {
            type: 'search',
            placeholder: 'Search by name, species, tags...',
            value: searchQuery,
            className: 'search-input',
            onInput: (e) => this.handleSearch(e.target.value)
          })
        ]),
        this.el('div', { className: 'toolbar-actions' }, [
          this.el('select', {
            value: typeFilter,
            className: 'filter-select',
            'aria-label': 'Filter by type',
            onChange: (e) => this.handleTypeFilter(e.target.value)
          }, [
            this.el('option', { value: '' }, 'All types'),
            this.el('option', { value: 'cactus' }, 'Cactus'),
            this.el('option', { value: 'succulent' }, 'Succulent'),
            this.el('option', { value: 'foliage' }, 'Foliage'),
            this.el('option', { value: 'other' }, 'Other')
          ]),
          this.el('select', {
            value: sortBy,
            className: 'sort-select',
            'aria-label': 'Sort by',
            onChange: (e) => this.handleSort(e.target.value)
          }, [
            this.el('option', { value: 'name' }, 'Name'),
            this.el('option', { value: 'nextWaterDate' }, 'Next water'),
            this.el('option', { value: 'createdAt' }, 'Date added')
          ]),
          this.el('button', {
            className: 'primary-btn',
            onClick: () => router.navigate('/plants/new')
          }, '+ Add Plant')
        ])
      ]),

      // Plant grid
      this.renderPlantGrid(filteredPlants)
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(page);
  }

  renderPlantGrid(plants) {
    if (plants.length === 0) {
      return this.el('div', { className: 'empty' }, [
        this.el('div', { style: 'font-size: 4rem; margin-bottom: 1rem;' }, '🌱'),
        this.el('div', { style: 'font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;' }, 'No plants yet'),
        this.el('div', { style: 'margin-bottom: 1.5rem;' }, 'Start your plant collection by adding your first plant'),
        this.el('button', {
          className: 'primary-btn',
          onClick: () => router.navigate('/plants/new')
        }, '+ Add Your First Plant')
      ]);
    }

    return this.el('div', { className: 'cards grid' },
      plants.map(plant => this.renderPlantCard(plant))
    );
  }

  renderPlantCard(plant) {
    const photoURL = plant.photoIds && plant.photoIds.length > 0
      ? this.plantService.getPhotoURL(plant.photoIds[0])
      : 'assets/placeholder.jpg';

    // Calculate days until next watering
    const today = new Date();
    const nextWater = new Date(plant.nextWaterDate);
    const daysUntil = Math.ceil((nextWater - today) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntil < 0;
    const isDueToday = daysUntil === 0;

    // Plant type icons
    const typeIcons = {
      'cactus': '🌵',
      'succulent': '🪴',
      'foliage': '🌿',
      'other': '🌱'
    };

    return this.el('div', { className: 'card plant-card' }, [
      // Photo
      this.el('img', {
        src: photoURL,
        alt: this.escapeHTML(plant.name),
        className: 'plant-photo',
        onClick: () => router.navigate(`/plants/${plant.id}`)
      }),

      // Header
      this.el('header', {}, [
        this.el('div', {}, [
          this.el('strong', {}, this.escapeHTML(plant.name)),
          plant.species ? this.el('div', { className: 'plant-species' },
            this.escapeHTML(plant.species)
          ) : null
        ]),
        this.el('div', { className: 'row' }, [
          this.el('button', {
            className: 'btn btn-sm',
            onClick: () => router.navigate(`/plants/${plant.id}/edit`)
          }, '✏️ Edit'),
          this.el('button', {
            className: 'icon-btn',
            'aria-label': 'More options',
            onClick: (e) => this.showPlantMenu(plant, e)
          }, '⋮')
        ])
      ]),

      // Info
      this.el('div', { className: 'plant-info' }, [
        this.el('div', { className: 'row' }, [
          this.el('span', { className: 'tag' },
            (typeIcons[plant.type] || '🌱') + ' ' + this.escapeHTML(plant.type)
          ),
          plant.location ? this.el('span', { className: 'tag' },
            '📍 ' + this.escapeHTML(plant.location)
          ) : null
        ]),
        this.el('div', { className: 'plant-water-info' }, [
          this.el('div', {}, [
            isOverdue
              ? `⚠️ Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}`
              : isDueToday
                ? '💧 Water today'
                : `Next water: ${this.formatDate(plant.nextWaterDate)}`
          ]),
          this.el('span', {
            className: `badge ${isOverdue ? 'bad' : isDueToday ? 'warn' : 'ok'}`
          }, `Every ${plant.waterIntervalDays} days`)
        ])
      ]),

      // Actions
      this.el('div', { className: 'row' }, [
        this.el('button', {
          className: 'primary-btn',
          onClick: () => this.waterPlant(plant.id)
        }, '💧 Water Now'),
        this.el('button', {
          className: 'btn',
          onClick: () => router.navigate(`/plants/${plant.id}/activity`)
        }, '📝 Log Activity')
      ])
    ]);
  }

  handleSearch(query) {
    this.state.searchQuery = query;
    this.debouncedSearch(query);
  }

  async performSearch(query) {
    const { plants, typeFilter } = this.state;
    let filtered = plants;

    if (query) {
      const q = query.toLowerCase();
      filtered = plants.filter(p => {
        const searchText = [p.name, p.species, p.tags, p.location]
          .join(' ')
          .toLowerCase();
        return searchText.includes(q);
      });
    }

    if (typeFilter) {
      filtered = filtered.filter(p => p.type === typeFilter);
    }

    this.setState({ filteredPlants: filtered });
    this.applySorting();
  }

  handleTypeFilter(type) {
    this.setState({ typeFilter: type });
    this.applyFilters();
  }

  handleSort(sortBy) {
    this.setState({ sortBy });
    this.applySorting();
  }

  applyFilters() {
    const { plants, searchQuery, typeFilter } = this.state;
    let filtered = plants;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const searchText = [p.name, p.species, p.tags, p.location]
          .join(' ')
          .toLowerCase();
        return searchText.includes(q);
      });
    }

    if (typeFilter) {
      filtered = filtered.filter(p => p.type === typeFilter);
    }

    this.setState({ filteredPlants: filtered });
    this.applySorting();
  }

  applySorting() {
    const { filteredPlants, sortBy } = this.state;

    const sorted = [...filteredPlants].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'nextWaterDate') {
        return a.nextWaterDate.localeCompare(b.nextWaterDate);
      }
      if (sortBy === 'createdAt') {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return 0;
    });

    this.setState({ filteredPlants: sorted });
  }

  showPlantMenu(plant, event) {
    event.stopPropagation();

    const menu = this.el('div', {
      className: 'context-menu',
      style: `position: fixed; left: ${event.pageX}px; top: ${event.pageY}px;`
    }, [
      this.el('button', {
        className: 'menu-item',
        onClick: () => this.duplicatePlant(plant.id)
      }, 'Duplicate'),
      this.el('button', {
        className: 'menu-item danger',
        onClick: () => this.deletePlant(plant.id)
      }, 'Delete')
    ]);

    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu, { once: true });
    }, 0);
  }

  async waterPlant(plantId) {
    try {
      showLoading();
      await this.plantService.waterPlant(plantId);
      hideLoading();
      showSuccess('Plant watered!');
      await this.loadPlants();
    } catch (err) {
      hideLoading();
      showError(`Failed to water plant: ${err.message}`);
    }
  }

  async duplicatePlant(plantId) {
    try {
      showLoading();
      await this.plantService.duplicatePlant(plantId);
      hideLoading();
      showSuccess('Plant duplicated!');
      await this.loadPlants();
    } catch (err) {
      hideLoading();
      showError(`Failed to duplicate plant: ${err.message}`);
    }
  }

  async deletePlant(plantId) {
    const confirmed = await showConfirm({
      title: 'Delete Plant',
      message: 'Are you sure? This will also delete all activities and photos for this plant.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });

    if (!confirmed) return;

    try {
      showLoading();
      await this.plantService.deletePlant(plantId);
      hideLoading();
      showSuccess('Plant deleted');
      await this.loadPlants();
    } catch (err) {
      hideLoading();
      showError(`Failed to delete plant: ${err.message}`);
    }
  }

  formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
