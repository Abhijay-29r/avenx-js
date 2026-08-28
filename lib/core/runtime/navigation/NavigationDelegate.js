/**
 * Base abstract class defining the navigation delegate interface.
 * Encapsulates environment-specific URL location management, event listening,
 * and page title operations.
 */
export class NavigationDelegate {
  /**
   * Gets the current location hash string (e.g. '#/home').
   * @returns {string}
   */
  getHash() {
    return '#/';
  }

  /* eslint-disable no-unused-vars */
  /**
   * Navigates/sets the current location hash string.
   * @param {string} hash - The target hash.
   * @param {object} [options] - Navigation options such as replace.
   */
  setHash(hash, options = {}) {}

  /**
   * Navigates backward in history.
   */
  back() {}

  /**
   * Navigates forward in history.
   */
  forward() {}

  /**
   * Navigates to a specific history position relative to current position.
   * @param {number} delta - Relative step count in history (e.g. -1 for back, 1 for forward).
   */
  go(delta) {}
  /* eslint-enable no-unused-vars */
  /**
   * Subscribes to location/hash change events.
   * @returns {Function} Unsubscribe function.
   */
  onHashChange() {
    return () => {};
  }

  /**
   * Subscribes to click events on links (e.g. [data-ax-link]).
   * @returns {Function} Unsubscribe function.
   */
  onLinkClick() {
    return () => {};
  }

  /**
   * Sets the document or in-memory title.
   */
  setTitle() {}

  /**
   * Registers a router instance for active router tracking.
   */
  registerRouter() {}

  /**
   * Unregisters a router instance.
   */
  unregisterRouter() {}

  /**
   * Returns all active router instances.
   * @returns {Set<object>}
   */
  getActiveRouters() {
    return new Set();
  }

  /**
   * Destroys the delegate and cleans up event listeners.
   */
  destroy() {}
}
