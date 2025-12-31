import { Component } from '../../core/Component.js';
import { eventBus } from '../../core/EventBus.js';
import { router } from '../../core/Router.js';
import { fmtDate, relativeTime, todayISO } from '../../utils/helpers.js';
import { showSuccess, showError } from '../shared/Toast.js';
import { showLoading, hideLoading } from '../shared/Loading.js';

/**
 * Dashboard page component
 * @class
 */
export class Dashboard extends Component {
  constructor(container, { plantService, activityService }) {
    super(container);
    this.plantService = plantService;
    this.activityService = activityService;
    this.state = {
      stats: null,
      duePlants: [],
      recentActivities: []
    };
    this.subscribe();
  }

  subscribe() {
    this.subscriptions.push(
      eventBus.on('plants:updated', () => this.loadData()),
      eventBus.on('activities:updated', () => this.loadData())
    );
  }

  async mounted() {
    await this.loadData();
  }

  async loadData() {
    try {
      showLoading();
      const [stats, duePlants, recentActivities] = await Promise.all([
        this.plantService.getStatistics(),
        this.plantService.getDuePlants(todayISO()),
        this.activityService.getRecentActivities(10)
      ]);

      this.setState({ stats, duePlants, recentActivities });
      hideLoading();
    } catch (err) {
      hideLoading();
      showError(`Failed to load dashboard: ${err.message}`);
    }
  }

  render() {
    const { stats, duePlants, recentActivities } = this.state;

    if (!stats) {
      this.container.innerHTML = '<div class="loading">Loading...</div>';
      return;
    }

    const dashboard = this.el('section', { className: 'section dashboard' }, [
      this.el('h2', {}, 'Today'),

      // KPIs
      this.renderKPIs(stats),

      // Actions
      this.el('div', { className: 'actions-row' }, [
        this.el('button', {
          className: 'primary-btn',
          onClick: () => this.waterAllDue()
        }, `Water all due (${duePlants.length})`),
        this.el('button', {
          className: 'btn',
          onClick: () => router.navigate('/plants/new')
        }, '+ Add Plant'),
        this.el('button', {
          className: 'btn',
          onClick: () => router.navigate('/scan-qr')
        }, '📷 Scan QR')
      ]),

      // Due plants
      this.el('h3', {}, 'Due Now'),
      this.renderDuePlants(duePlants),

      // Recent activity
      this.el('h3', {}, 'Recent Activity'),
      this.renderRecentActivity(recentActivities)
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(dashboard);
  }

  renderKPIs(stats) {
    return this.el('div', { className: 'kpis' }, [
      this.el('div', { className: 'kpi' }, [
        this.el('h4', {}, '🌱 Total Plants'),
        this.el('div', { className: 'kpi-value' }, String(stats.total)),
        this.el('small', {}, 'in your collection')
      ]),
      this.el('div', { className: 'kpi' }, [
        this.el('h4', {}, '💧 Due to Water'),
        this.el('div', { className: 'kpi-value' }, String(stats.due)),
        this.el('small', {}, 'need attention today')
      ]),
      this.el('div', { className: 'kpi kpi-danger' }, [
        this.el('h4', {}, '⚠️ Overdue'),
        this.el('div', { className: 'kpi-value' }, String(stats.overdue)),
        this.el('small', {}, 'need water urgently')
      ])
    ]);
  }

  renderDuePlants(plants) {
    if (plants.length === 0) {
      return this.el('div', { className: 'empty' }, [
        this.el('div', { style: 'font-size: 3rem; margin-bottom: 1rem;' }, '🌵✨'),
        this.el('div', { style: 'font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;' }, 'All caught up!'),
        this.el('div', {}, 'No plants need watering today. Great job!')
      ]);
    }

    return this.el('div', { className: 'cards' },
      plants.map(plant => this.renderDuePlantCard(plant))
    );
  }

  renderDuePlantCard(plant) {
    const overdueDays = Math.max(0, Date.parse(todayISO()) - Date.parse(plant.nextWaterDate)) / (1000 * 60 * 60 * 24);
    const isOverdue = overdueDays > 0;

    return this.el('div', { className: 'card' }, [
      this.el('header', {}, [
        this.el('strong', {}, this.escapeHTML(plant.name)),
        this.el('span', {
          className: `badge ${isOverdue ? 'bad' : 'warn'}`
        }, isOverdue ? `${Math.floor(overdueDays)} days overdue` : 'due today')
      ]),
      this.el('div', { className: 'row' }, [
        this.el('span', { className: 'tag' }, this.escapeHTML(plant.species || plant.type)),
        this.el('span', { className: 'tag' }, `Every ${plant.waterIntervalDays} days`)
      ]),
      this.el('div', { className: 'row' }, [
        this.el('button', {
          className: 'primary-btn',
          onClick: () => this.waterPlant(plant.id)
        }, 'Mark Watered'),
        this.el('button', {
          className: 'btn',
          onClick: () => router.navigate(`/plants/${plant.id}/activity`)
        }, 'Log Activity')
      ])
    ]);
  }

  renderRecentActivity(activities) {
    if (activities.length === 0) {
      return this.el('div', { className: 'empty' }, [
        this.el('div', { style: 'font-size: 2.5rem; margin-bottom: 1rem;' }, '📝'),
        this.el('div', { style: 'font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;' }, 'No activity yet'),
        this.el('div', {}, 'Start tracking your plant care activities')
      ]);
    }

    return this.el('div', { className: 'timeline' },
      activities.map(activity => this.renderActivityItem(activity))
    );
  }

  renderActivityItem(activity) {
    const plant = this.plantService.getPlant(activity.plantId);
    const activityIcons = {
      'water': '💧',
      'repot': '🪴',
      'fertilize': '🌿',
      'pest': '🐛',
      'note': '📝',
      'custom': '✏️'
    };
    const icon = activityIcons[activity.type] || '•';

    return this.el('div', { className: 'timeline-item' }, [
      this.el('div', { className: 'timeline-content' }, [
        icon + ' ',
        this.el('strong', {}, activity.type.charAt(0).toUpperCase() + activity.type.slice(1)),
        ' · ',
        this.escapeHTML(plant?.name || 'Unknown')
      ]),
      this.el('div', { className: 'timeline-meta' }, [
        fmtDate(activity.date),
        activity.note ? ` · ${this.escapeHTML(activity.note)}` : ''
      ])
    ]);
  }

  async waterPlant(plantId) {
    try {
      showLoading();
      await this.activityService.logActivity({
        plantId,
        type: 'water',
        date: todayISO()
      });
      hideLoading();
      showSuccess('Plant watered!');
      await this.loadData();
    } catch (err) {
      hideLoading();
      showError(`Failed to water plant: ${err.message}`);
    }
  }

  async waterAllDue() {
    const { duePlants } = this.state;
    if (duePlants.length === 0) return;

    try {
      showLoading();
      for (const plant of duePlants) {
        await this.activityService.logActivity({
          plantId: plant.id,
          type: 'water',
          date: todayISO()
        });
      }
      hideLoading();
      showSuccess(`Watered ${duePlants.length} plant(s)!`);
      await this.loadData();
    } catch (err) {
      hideLoading();
      showError(`Failed to water plants: ${err.message}`);
    }
  }
}
