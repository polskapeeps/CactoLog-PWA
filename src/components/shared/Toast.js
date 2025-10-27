import { Component } from '../../core/Component.js';
import { eventBus } from '../../core/EventBus.js';

/**
 * Toast notification component
 * @class
 */
export class Toast extends Component {
  constructor(container) {
    super(container);
    this.toasts = [];
    this.subscribe();
  }

  subscribe() {
    this.subscriptions.push(
      eventBus.on('toast:show', (data) => this.show(data))
    );
  }

  /**
   * Show toast notification
   * @param {Object} options - Toast options
   */
  show({ message, type = 'success', duration = 3000 }) {
    const toast = this.el('div', {
      className: `toast toast-${type}`,
      'aria-live': 'polite',
      role: 'status'
    }, [message]);

    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        toast.remove();
        this.toasts = this.toasts.filter(t => t !== toast);
      }, 300);
    }, duration);
  }

  render() {
    // Toast container is persistent
  }
}

// Helper functions to show toasts
export const showToast = (message, type = 'success', duration = 3000) => {
  eventBus.emit('toast:show', { message, type, duration });
};

export const showSuccess = (message) => showToast(message, 'success');
export const showError = (message) => showToast(message, 'error');
export const showWarning = (message) => showToast(message, 'warning');
export const showInfo = (message) => showToast(message, 'info');
