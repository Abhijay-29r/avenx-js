import { DomPatcher } from './domPatch.js';
import { logger } from '../runtime/AvenxLogger.js';

/**
 * Manages deferred loading (<@defer>) of DOM subtrees and component instances.
 */
export class DeferManager {
  /** @type {WeakSet<Element>} */
  #initialized = new WeakSet();

  /** @type {WeakSet<Element>} */
  #loaded = new WeakSet();

  /** @type {WeakMap<Element, Function>} */
  #cleanups = new WeakMap();

  /**
   * @param {DynamicEvaluator} evaluator - Expression evaluator.
   * @param {TemplateRenderer} renderer - Template renderer.
   * @param {EventBinder} [eventBinder] - Event binder.
   * @param {string} [componentName] - Parent component name.
   */
  constructor(evaluator, renderer, eventBinder, componentName) {
    this.evaluator = evaluator;
    this.renderer = renderer;
    this.eventBinder = eventBinder;
    this.componentName = componentName || 'AnonymousComponent';
    this.patcher = new DomPatcher();
  }

  /**
   * Checks if a container element has already loaded its deferred content.
   * @param {Element} el
   * @returns {boolean}
   */
  isLoaded(el) {
    return this.#loaded.has(el);
  }

  /**
   * Processes all [data-ax-defer] container elements within a root element.
   * @param {Element} root - Root container or component element.
   * @param {object} scope - Evaluation scope.
   * @param {object} state - Component state.
   * @param {object} [app] - App context.
   */
  process(root, scope, state, app) {
    if (!root) return;

    const containers = [];
    if (root.matches && root.matches('[data-ax-defer]')) {
      containers.push(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('[data-ax-defer]').forEach((el) => containers.push(el));
    }

    containers.forEach((container) => {
      this.#processContainer(container, scope, state, app);
    });
  }

  /**
   * Processes an individual [data-ax-defer] container element.
   * @param {Element} container
   * @param {object} scope
   * @param {object} state
   * @param {object} [app]
   * #private
   */
  #processContainer(container, scope, state, app) {
    if (this.#loaded.has(container)) return;

    // Initialize placeholder content if not done yet
    if (!this.#initialized.has(container)) {
      this.#initialized.add(container);
      const placeholderTpl = container.querySelector('template[data-ax-defer-placeholder]');
      if (placeholderTpl && container.children.length === container.querySelectorAll('template').length) {
        const placeholderContent = unescapeTemplate(placeholderTpl.innerHTML);
        const renderedPlaceholder = this.renderer.render(placeholderContent, scope);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedPlaceholder;
        while (tempDiv.firstChild) {
          container.insertBefore(tempDiv.firstChild, placeholderTpl);
        }
      }
    }

    const whenAttr = (container.getAttribute('data-ax-defer-when') || 'idle').trim();
    this.setupTrigger(container, whenAttr, scope, state, app);
  }

  /**
   * Sets up trigger conditions based on whenAttr.
   * @param {Element} container
   * @param {string} whenAttr
   * @param {object} scope
   * @param {object} state
   * @param {object} [app]
   */
  setupTrigger(container, whenAttr, scope, state, app) {
    if (this.#loaded.has(container)) return;

    if (whenAttr === 'idle') {
      this.#setupIdleTrigger(container, scope, state, app);
    } else if (whenAttr === 'visible') {
      this.#setupVisibleTrigger(container, scope, state, app);
    }
  }

  /**
   * Triggers deferred loading during browser idle time (requestIdleCallback).
   */
  #setupIdleTrigger(container, scope, state, app) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(() => {
        this.loadDeferredContent(container, scope, state, app);
      });
      this.registerCleanup(container, () => {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(handle);
        }
      });
    } else {
      const timer = setTimeout(() => {
        this.loadDeferredContent(container, scope, state, app);
      }, 1);
      this.registerCleanup(container, () => clearTimeout(timer));
    }
  }

  /**
   * Triggers deferred loading when element becomes visible in viewport (IntersectionObserver).
   */
  #setupVisibleTrigger(container, scope, state, app) {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              observer.disconnect();
              this.loadDeferredContent(container, scope, state, app);
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(container);
      this.registerCleanup(container, () => observer.disconnect());
    } else {
      // Fallback if IntersectionObserver is not available
      this.loadDeferredContent(container, scope, state, app);
    }
  }

  /**
   * Swaps placeholder with deferred content.
   * @param {Element} container
   * @param {object} scope
   * @param {object} state
   * @param {object} [app]
   */
  loadDeferredContent(container, scope, state, app) {
    if (this.#loaded.has(container)) return;
    this.#loaded.add(container);

    // Run cleanup if any trigger listener was set
    const cleanup = this.#cleanups.get(container);
    if (cleanup) {
      cleanup();
      this.#cleanups.delete(container);
    }

    const contentTpl = container.querySelector('template[data-ax-defer-content]');
    if (!contentTpl) return;

    const unescapedContent = unescapeTemplate(contentTpl.innerHTML);
    const renderedHtml = this.renderer.render(unescapedContent, scope);

    // Clear placeholder children (keep templates)
    Array.from(container.childNodes).forEach((child) => {
      if (child.nodeName !== 'TEMPLATE') {
        if (this.eventBinder && child.nodeType === 1) {
          this.eventBinder.unbind(child);
        }
        container.removeChild(child);
      }
    });

    // Mount newly rendered deferred content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedHtml;

    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    container.insertBefore(fragment, contentTpl);

    // Bind events if eventBinder is available
    if (this.eventBinder) {
      this.eventBinder.bind(container, scope);
    }
  }

  /**
   * Registers a cleanup function for a container.
   * @param {Element} container
   * @param {Function} cleanupFn
   */
  registerCleanup(container, cleanupFn) {
    this.#cleanups.set(container, cleanupFn);
  }

  /**
   * Destroys and cleans up all observers and listeners.
   */
  destroy() {
    // Cleanup handlers
  }
}

/**
 * Restores escaped template expressions from {% %} back to {{ }}.
 * @param {string} html
 * @returns {string}
 */
function unescapeTemplate(html) {
  if (!html) return '';
  return html.replace(/\{%/g, '{{').replace(/%\}/g, '}}');
}
