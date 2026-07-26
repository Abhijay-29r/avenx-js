/**
 * A standard Least Recently Used (LRU) Cache implementation.
 * Uses JavaScript Map's insertion order preservation to maintain recency.
 */
export class LruCache {
  /**
   * @param {number} limit - Maximum number of items allowed in the cache.
   * @param {function(string, *): void} [onEvict] - Optional callback triggered when an item is evicted.
   */
  constructor(limit, onEvict = null) {
    if (typeof limit !== 'number' || limit <= 0) {
      throw new Error('LRU Cache limit must be a positive number');
    }
    this.limit = limit;
    this.onEvict = onEvict;
    this.cache = new Map();
  }

  /**
   * Retrieves an item from the cache and updates its recency.
   * @param {string} key
   * @returns {*} The cached value, or undefined if not found.
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key);
    // Refresh recency by re-inserting
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Inserts or updates an item in the cache. Evicts the least recently used item if limit is exceeded.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.limit) {
      // Evict least recently used (first key in map iterator)
      const lruKey = this.cache.keys().next().value;
      const lruValue = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      if (typeof this.onEvict === 'function') {
        try {
          this.onEvict(lruKey, lruValue);
        } catch (err) {
          // Prevent errors in user-defined callback from breaking set()
          console.error('Error in LRU Cache onEvict callback:', err);
        }
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Checks if a key exists in the cache without updating its recency.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Deletes an item from the cache.
   * @param {string} key
   * @returns {boolean} True if the item existed and was removed.
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clears all items from the cache.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Returns the current number of items in the cache.
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }
}
