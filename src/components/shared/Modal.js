import { Component } from '../../core/Component.js';

/**
 * Modal dialog component
 * @class
 */
export class Modal extends Component {
  /**
   * @param {Object} props - Modal props
   * @param {string} props.title - Modal title
   * @param {Function} props.onClose - Close callback
   * @param {HTMLElement|string} props.content - Modal content
   * @param {Object[]} props.actions - Action buttons
   */
  constructor(container, props) {
    super(container, props);
    this.dialog = null;
  }

  render() {
    this.dialog = this.el('dialog', {
      className: 'modal',
      'aria-labelledby': 'modal-title',
      'aria-modal': 'true'
    }, [
      this.el('div', { className: 'modal-header' }, [
        this.el('h3', { id: 'modal-title', className: 'modal-title' }, this.props.title),
        this.el('button', {
          className: 'icon-btn',
          'aria-label': 'Close',
          onClick: () => this.close()
        }, [
          this.createCloseIcon()
        ])
      ]),
      this.el('div', { className: 'modal-content' }, [
        typeof this.props.content === 'string'
          ? this.el('p', {}, this.props.content)
          : this.props.content
      ]),
      this.el('div', { className: 'modal-actions' },
        (this.props.actions || []).map(action =>
          this.el('button', {
            className: action.primary ? 'primary-btn' : 'btn',
            onClick: () => {
              if (action.onClick) action.onClick();
              if (!action.keepOpen) this.close();
            }
          }, action.label)
        )
      )
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(this.dialog);

    // Close on backdrop click
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.close();
      }
    });

    // Close on Escape
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  createCloseIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.innerHTML = '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>';
    return svg;
  }

  open() {
    if (this.dialog) {
      this.dialog.showModal();
      // Focus first focusable element
      const focusable = this.dialog.querySelector('button, input, textarea, select');
      if (focusable) focusable.focus();
    }
  }

  close() {
    if (this.dialog) {
      this.dialog.close();
      if (this.props.onClose) {
        this.props.onClose();
      }
    }
  }

  beforeUnmount() {
    if (this.dialog) {
      this.dialog.close();
    }
  }
}

/**
 * Create and show modal
 * @param {Object} options - Modal options
 * @returns {Modal}
 */
export function showModal(options) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const modal = new Modal(container, {
    ...options,
    onClose: () => {
      if (options.onClose) options.onClose();
      modal.unmount();
      container.remove();
    }
  });

  modal.render();
  modal.open();

  return modal;
}

/**
 * Show confirmation dialog
 * @param {Object} options - Confirmation options
 * @returns {Promise<boolean>}
 */
export function showConfirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    showModal({
      title,
      content: message,
      actions: [
        {
          label: cancelLabel,
          onClick: () => resolve(false)
        },
        {
          label: confirmLabel,
          primary: true,
          onClick: () => resolve(true)
        }
      ],
      onClose: () => resolve(false)
    });
  });
}
