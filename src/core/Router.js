import { eventBus } from './EventBus.js';

/**
 * Client-side router with hash-based routing
 * @class
 */
export class Router {
  constructor() {
    /** @type {Map<string, Function>} */
    this.routes = new Map();
    this.currentRoute = '/';
    this.params = {};

    window.addEventListener('hashchange', () => this.handleRouteChange());
    window.addEventListener('load', () => this.handleRouteChange());
  }

  /**
   * Register a route
   * @param {string} path - Route path (supports :params)
   * @param {Function} handler - Route handler
   */
  on(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to route
   * @param {string} path - Route path
   * @param {Object} state - Optional state to pass
   */
  navigate(path, state = {}) {
    window.location.hash = path;
    eventBus.emit('route:changed', { path, state });
  }

  /**
   * Handle route change
   */
  handleRouteChange() {
    const hash = window.location.hash.slice(1) || '/';
    this.currentRoute = hash;

    // Try exact match first
    if (this.routes.has(hash)) {
      this.params = {};
      this.routes.get(hash)(this.params);
      eventBus.emit('route:changed', { path: hash, params: {} });
      return;
    }

    // Try pattern match
    for (const [pattern, handler] of this.routes) {
      const params = this.matchRoute(pattern, hash);
      if (params) {
        this.params = params;
        handler(params);
        eventBus.emit('route:changed', { path: hash, params });
        return;
      }
    }

    // 404 - route not found
    console.warn(`Route not found: ${hash}`);
    eventBus.emit('route:notfound', hash);
  }

  /**
   * Match route pattern against path
   * @param {string} pattern - Route pattern
   * @param {string} path - Current path
   * @returns {Object|null} Params or null
   */
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }

  /**
   * Get current route
   * @returns {string}
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Get route params
   * @returns {Object}
   */
  getParams() {
    return this.params;
  }
}

// Global singleton instance
export const router = new Router();
