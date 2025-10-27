import { Component } from '../../core/Component.js';
import { eventBus } from '../../core/EventBus.js';

/**
 * Loading overlay component
 * @class
 */
export class Loading extends Component {
  constructor(container) {
    super(container);
    this.isVisible = false;
    this.subscribe();
  }

  subscribe() {
    this.subscriptions.push(
      eventBus.on('loading:show', () => this.show()),
      eventBus.on('loading:hide', () => this.hide()),
      eventBus.on('state:loading', (loading) => {
        if (loading) this.show();
        else this.hide();
      })
    );
  }

  render() {
    if (!this.isVisible) {
      this.container.innerHTML = '';
      return;
    }

    const overlay = this.el('div', {
      className: 'loading-overlay',
      role: 'progressbar',
      'aria-label': 'Loading',
      'aria-busy': 'true'
    }, [
      this.el('div', { className: 'spinner' })
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(overlay);
  }

  show() {
    this.isVisible = true;
    this.render();
  }

  hide() {
    this.isVisible = false;
    this.render();
  }
}

// Helper functions
export const showLoading = () => eventBus.emit('loading:show');
export const hideLoading = () => eventBus.emit('loading:hide');
