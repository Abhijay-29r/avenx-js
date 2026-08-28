import { NavigationDelegate } from './NavigationDelegate.js';

/**
 * In-memory navigation delegate for Node.js / SSR / headless environments.
 * Manages route location state without DOM or window dependencies.
 * @augments NavigationDelegate
 */
export class MemoryNavigationDelegate extends NavigationDelegate {
  /**
   * @param {string} [initialHash] - Initial location hash string.
   */
  constructor(initialHash = '#/') {
    super();
    const initial = initialHash || '#/';
    this.history = [initial];
    this.cursorIndex = 0;
    this.currentHash = initial;
    this.title = '';
    this.hashListeners = new Set();
    this.linkClickListeners = new Set();
    this.activeRouters = new Set();
  }

  /** @override */
  getHash() {
    return this.history[this.cursorIndex] || this.currentHash || '#/';
  }

  /** @override */
  setHash(hash, options = {}) {
    const targetHash = hash || '#/';
    if (options.replace) {
      if (this.history.length === 0) {
        this.history.push(targetHash);
        this.cursorIndex = 0;
      } else {
        this.history[this.cursorIndex] = targetHash;
      }
    } else {
      this.history = this.history.slice(0, this.cursorIndex + 1);
      this.history.push(targetHash);
      this.cursorIndex = this.history.length - 1;
    }
    this.currentHash = this.history[this.cursorIndex];
    for (const listener of this.hashListeners) {
      listener(this.currentHash);
    }
  }

  /** @override */
  back() {
    this.go(-1);
  }

  /** @override */
  forward() {
    this.go(1);
  }

  /** @override */
  go(delta) {
    if (typeof delta !== 'number' || isNaN(delta) || delta === 0) {
      return;
    }
    const targetIndex = this.cursorIndex + delta;
    if (targetIndex < 0 || targetIndex >= this.history.length) {
      return;
    }
    this.cursorIndex = targetIndex;
    this.currentHash = this.history[this.cursorIndex];
    for (const listener of this.hashListeners) {
      listener(this.currentHash);
    }
  }

  /** @override */
  onHashChange(callback) {
    this.hashListeners.add(callback);
    return () => this.hashListeners.delete(callback);
  }

  /** @override */
  onLinkClick(callback) {
    this.linkClickListeners.add(callback);
    return () => this.linkClickListeners.delete(callback);
  }

  /** @override */
  setTitle(title) {
    this.title = title;
  }

  /** @override */
  registerRouter(router) {
    this.activeRouters.add(router);
  }

  /** @override */
  unregisterRouter(router) {
    this.activeRouters.delete(router);
  }

  /** @override */
  getActiveRouters() {
    return this.activeRouters;
  }

  /** @override */
  destroy() {
    this.hashListeners.clear();
    this.linkClickListeners.clear();
    this.activeRouters.clear();
  }
}
