import { Component } from '../../core/Component.js';
import { router } from '../../core/Router.js';
import { monthMatrix, toISODate, groupBy } from '../../utils/helpers.js';
import { eventBus } from '../../core/EventBus.js';
import { showError } from '../shared/Toast.js';

/**
 * Calendar page component
 * @class
 */
export class Calendar extends Component {
  constructor(container, { plantService, exportService }) {
    super(container);
    this.plantService = plantService;
    this.exportService = exportService;

    const now = new Date();
    this.state = {
      year: now.getFullYear(),
      month: now.getMonth(),
      events: []
    };

    this.subscribe();
  }

  subscribe() {
    this.subscriptions.push(
      eventBus.on('plants:updated', () => this.loadEvents()),
      eventBus.on('activities:updated', () => this.loadEvents())
    );
  }

  async mounted() {
    await this.loadEvents();
  }

  async loadEvents() {
    const { year, month } = this.state;
    const events = await this.calculateEvents(year, month);
    this.setState({ events });
  }

  async calculateEvents(year, month) {
    const plants = await this.plantService.getAllPlants();
    const events = [];

    // Water events
    for (const plant of plants) {
      const nextWater = new Date(plant.nextWaterDate);
      if (nextWater.getFullYear() === year && nextWater.getMonth() === month) {
        events.push({
          date: plant.nextWaterDate,
          label: plant.name,
          type: 'water',
          plantId: plant.id
        });
      }
    }

    // Repot events
    for (const plant of plants) {
      if (plant.lastRepot && plant.repotIntervalMonths > 0) {
        const lastRepot = new Date(plant.lastRepot);
        const nextRepot = new Date(lastRepot);
        nextRepot.setMonth(nextRepot.getMonth() + plant.repotIntervalMonths);

        if (nextRepot.getFullYear() === year && nextRepot.getMonth() === month) {
          events.push({
            date: toISODate(nextRepot),
            label: plant.name,
            type: 'repot',
            plantId: plant.id
          });
        }
      }
    }

    return events;
  }

  render() {
    const { year, month, events } = this.state;

    const page = this.el('section', { className: 'section calendar' }, [
      // Header
      this.el('div', { className: 'calendar-header' }, [
        this.el('button', {
          className: 'icon-btn',
          'aria-label': 'Previous month',
          onClick: () => this.navigateMonth(-1)
        }, '‹'),

        this.el('h2', { id: 'calendarTitle' },
          new Date(year, month, 1).toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric'
          })
        ),

        this.el('button', {
          className: 'icon-btn',
          'aria-label': 'Next month',
          onClick: () => this.navigateMonth(1)
        }, '›'),

        this.el('div', { className: 'calendar-actions' }, [
          this.el('button', {
            className: 'btn',
            onClick: () => this.goToToday()
          }, 'Today'),
          this.el('button', {
            className: 'btn',
            onClick: () => this.exportICS()
          }, 'Export .ics')
        ])
      ]),

      // Weekday headers
      this.el('div', { className: 'calendar-weekdays' },
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day =>
          this.el('div', { className: 'weekday' }, day)
        )
      ),

      // Calendar grid
      this.renderCalendarGrid(year, month, events)
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(page);
  }

  renderCalendarGrid(year, month, events) {
    const matrix = monthMatrix(year, month);
    const eventsByDate = groupBy(events, e => e.date);
    const today = toISODate(new Date());

    return this.el('div', { className: 'calendar-grid' },
      matrix.map(week =>
        this.el('div', { className: 'calendar-row' },
          week.map(cell => this.renderCalendarCell(cell, eventsByDate, today))
        )
      )
    );
  }

  renderCalendarCell(cell, eventsByDate, today) {
    const isToday = cell.date === today;
    const cellEvents = eventsByDate[cell.date] || [];

    return this.el('div', {
      className: `calendar-cell ${!cell.inMonth ? 'out-of-month' : ''} ${isToday ? 'today' : ''}`,
      'data-date': cell.date
    }, [
      this.el('div', { className: 'cell-date' },
        new Date(cell.date).getDate().toString()
      ),
      this.el('div', { className: 'cell-events' },
        cellEvents.map(event => this.renderEvent(event))
      )
    ]);
  }

  renderEvent(event) {
    const icon = event.type === 'water' ? '💧' : '🪴';

    return this.el('div', {
      className: `event event-${event.type}`,
      onClick: () => router.navigate(`/plants/${event.plantId}`)
    }, `${icon} ${this.escapeHTML(event.label)}`);
  }

  navigateMonth(delta) {
    const { year, month } = this.state;
    const date = new Date(year, month + delta, 1);

    this.setState({
      year: date.getFullYear(),
      month: date.getMonth()
    });

    this.loadEvents();
  }

  goToToday() {
    const now = new Date();
    this.setState({
      year: now.getFullYear(),
      month: now.getMonth()
    });

    this.loadEvents();
  }

  async exportICS() {
    try {
      const { year, month } = this.state;
      await this.exportService.downloadCalendarICS(year, month);
    } catch (err) {
      showError(`Failed to export calendar: ${err.message}`);
    }
  }
}
