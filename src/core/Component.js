/**
 * Base Component class for building UI components
 * @class
 */
export class Component {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} props - Component properties
   */
  constructor(container, props = {}) {
    this.container = container;
    this.props = props;
    this.state = {};
    this.subscriptions = [];
  }

  /**
   * Set component state and re-render
   * @param {Object} newState - New state to merge
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  /**
   * Render component (override in subclass)
   */
  render() {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Component lifecycle: Called after first render
   */
  mounted() {}

  /**
   * Component lifecycle: Called before unmount
   */
  beforeUnmount() {}

  /**
   * Unmount and cleanup component
   */
  unmount() {
    this.beforeUnmount();
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Query selector within component
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null}
   */
  $(selector) {
    return this.container.querySelector(selector);
  }

  /**
   * Query all within component
   * @param {string} selector - CSS selector
   * @returns {HTMLElement[]}
   */
  $$(selector) {
    return [...this.container.querySelectorAll(selector)];
  }

  /**
   * Create element helper
   * @param {string} tag - HTML tag
   * @param {Object} attrs - Attributes
   * @param {string|HTMLElement[]} children - Children
   * @returns {HTMLElement}
   */
  el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);

    // First pass: set all attributes except value and checked
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.assign(element.dataset, value);
      } else if (key.startsWith('on')) {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key !== 'value' && key !== 'checked') {
        element.setAttribute(key, value);
      }
    });

    // Add children first
    if (typeof children === 'string') {
      element.textContent = children;
    } else {
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child) {
          element.appendChild(child);
        }
      });
    }

    // Second pass: set value and checked properties after children are added
    if ('value' in attrs) {
      element.value = attrs.value;
    }
    if ('checked' in attrs) {
      element.checked = attrs.checked;
    }

    return element;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string}
   */
  escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[s]));
  }
}
