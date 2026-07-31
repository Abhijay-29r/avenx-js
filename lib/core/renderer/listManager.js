import { DomPatcher } from './domPatch.js';
import { logger } from '../runtime/AvenxLogger.js';
import { AvenxErrorCodes, formatMessage } from '../runtime/AvenxError.js';

/**
 * Handles efficient rendering of lists by managing DOM fragments and performing keyed diffing.
 */
export class ListManager {
  /** @type {WeakMap<HTMLTemplateElement, {listRef: Array, items: Array}>} */
  #listCache = new WeakMap();

  /** @type {WeakMap<HTMLTemplateElement, Array<Element>>} */
  #nodePool = new WeakMap();

  /**
   * @param {DynamicEvaluator} evaluator - The expression evaluator.
   * @param {TemplateRenderer} renderer - The template renderer.
   * @param {EventBinder} [eventBinder] - The event binder to unbind removed elements.
   */
  constructor(evaluator, renderer, eventBinder) {
    this.evaluator = evaluator;
    this.renderer = renderer;
    this.eventBinder = eventBinder;
    this.patcher = new DomPatcher();
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.parserDiv = document.createElement('div');
    }
  }

  /**
   * Processes all template-based lists within a root element.
   * @param {Element} root - The root element to search in.
   * @param {object} scope - The evaluation scope.
   * @param {object} state - The component state.
   * @param {object} [app] - The application context.
   */
  process(root, scope, state, app) {
    const templates = root.querySelectorAll('template[data-ax-for]');
    templates.forEach((template) => {
      let parent = template.parentNode;
      let insideSlot = false;
      while (parent) {
        if (parent.nodeName === 'SLOT' && parent.hasAttribute && parent.hasAttribute('data-avenx-transcluded')) {
          insideSlot = true;
          break;
        }
        parent = parent.parentNode;
      }
      if (!insideSlot) {
        this.#updateList(template, scope, state, app);
      }
    });
  }

  /**
   * Updates a specific list based on its template and current state.
   * @param {HTMLTemplateElement} template - The list template.
   * @param {object} scope - The evaluation scope.
   * @param {object} state - The component state.
   * @param {object} [app] - The application context.
   * @private
   */
  #updateList(template, scope, state, app) {
    const listExpr = template.getAttribute('data-ax-for');
    const itemVar = template.getAttribute('data-ax-as');
    const keyExpr = template.getAttribute('data-ax-key');

    let list;
    try {
      list = this.evaluator.evaluateExpression(listExpr, scope, state);
    } catch (e) {
      logger.warn(
        formatMessage(AvenxErrorCodes.RENDER_LIST_EVALUATION_FAILED, listExpr, e.message || e)
      );
      return;
    }

    if (!Array.isArray(list)) {
      list = [];
    }

    const cached = this.#listCache.get(template);
    if (
      cached &&
      cached.listRef === list &&
      cached.items.length === list.length &&
      cached.items.every((item, i) => item === list[i])
    ) {
      return;
    }

    const currentItems = this.#getCurrentItems(template);
    const rawItems = list.map((item, index) => {
      const itemScope = { ...scope, [itemVar]: item, index };
      let key = index;
      if (keyExpr) {
        try {
          key = this.evaluator.evaluateExpression(keyExpr, itemScope, state);
        } catch (e) {
          logger.warn(
            formatMessage(AvenxErrorCodes.RENDER_KEY_EVALUATION_FAILED, keyExpr, e.message || e)
          );
        }
      }
      return { item, key: String(key), itemScope, index };
    });

    const keyCounts = {};
    for (const entry of rawItems) {
      keyCounts[entry.key] = (keyCounts[entry.key] || 0) + 1;
    }

    const warnedKeys = new Set();
    const nextItems = rawItems.map((entry) => {
      let finalKey = entry.key;
      if (keyCounts[entry.key] > 1) {
        if (!warnedKeys.has(entry.key)) {
          logger.warn(
            formatMessage(AvenxErrorCodes.RENDER_LIST_DUPLICATE_KEY, entry.key, listExpr)
          );
          warnedKeys.add(entry.key);
        }
        finalKey = `${entry.key}_${entry.index}`;
      }
      return { item: entry.item, key: finalKey, itemScope: entry.itemScope };
    });

    // 1. Double-ended list diffing: common prefix and common suffix matching
    const currentItemsMap = this.#getCurrentItems(template);
    const oldChildren = Array.from(currentItemsMap.values());
    const itemTemplate = template.innerHTML.replace(/{%/g, '{{').replace(/%}/g, '}}');

    let i = 0;
    let e1 = oldChildren.length - 1;
    let e2 = nextItems.length - 1;

    // 1.1 Sync Head (Common Prefix)
    while (i <= e1 && i <= e2) {
      const oldChild = oldChildren[i];
      const nextItem = nextItems[i];
      const oldKey = oldChild.getAttribute('data-ax-key-val');
      if (oldKey === nextItem.key) {
        this.#createOrPatchItem(nextItem, oldChild, itemTemplate, scope, state, app, template);
        i++;
      } else {
        break;
      }
    }

    // 1.2 Sync Tail (Common Suffix)
    while (i <= e1 && i <= e2) {
      const oldChild = oldChildren[e1];
      const nextItem = nextItems[e2];
      const oldKey = oldChild.getAttribute('data-ax-key-val');
      if (oldKey === nextItem.key) {
        this.#createOrPatchItem(nextItem, oldChild, itemTemplate, scope, state, app, template);
        e1--;
        e2--;
      } else {
        break;
      }
    }

    // 1.3 Additions only (common prefix/suffix covered all old items)
    if (i > e1) {
      if (i <= e2) {
        const anchor = e2 + 1 < nextItems.length ? currentItemsMap.get(nextItems[e2 + 1].key) : null;
        let lastEl = i > 0 ? currentItemsMap.get(nextItems[i - 1].key) : template;
        for (let k = i; k <= e2; k++) {
          const newEl = this.#createOrPatchItem(nextItems[k], null, itemTemplate, scope, state, app, template);
          if (anchor) {
            this.#insertNodeBefore(newEl, anchor, lastEl);
          } else {
            this.#insertNodeAfter(newEl, lastEl);
          }
          lastEl = newEl;
        }
      }
    }
    // 1.4 Deletions only (common prefix/suffix covered all new items)
    else if (i > e2) {
      while (i <= e1) {
        this.#removeItem(oldChildren[i], template, app);
        i++;
      }
    }
    // 1.5 General case (fallback linear patch for unhandled middle sequence)
    else {
      const nextKeys = new Set(nextItems.map((item) => item.key));
      for (const [key, element] of currentItemsMap.entries()) {
        if (!nextKeys.has(key)) {
          this.#removeItem(element, template, app);
        }
      }

      let lastElement = template;
      nextItems.forEach((nextItem) => {
        const element = this.#createOrPatchItem(
          nextItem,
          currentItemsMap.get(nextItem.key),
          itemTemplate,
          scope,
          state,
          app,
          template
        );
        if (element) {
          if (element.previousElementSibling !== lastElement) {
            this.#insertNodeAfter(element, lastElement);
          }
          lastElement = element;
        }
      });
    }

    this.#listCache.set(template, {
      listRef: list,
      items: [...list],
    });
  }

  /**
   * Helper to create a new item element or patch an existing element in-place.
   * @private
   */
  #createOrPatchItem(nextItem, existingElement, itemTemplate, scope, state, app, template) {
    const { key, itemScope } = nextItem;
    const resolver = (expr) => this.evaluator.evaluateExpression(expr, itemScope, state);
    const html = this.renderer.render(itemTemplate, resolver).trim();

    let newElement = null;
    if (this.parserDiv) {
      this.parserDiv.innerHTML = html;
      newElement = this.parserDiv.firstElementChild;
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      newElement = temp.firstElementChild;
    }

    if (newElement) {
      newElement = this.patcher.cleanElement(newElement);
      newElement.setAttribute('data-ax-list-item', '');
      newElement.setAttribute('data-ax-key-val', key);
    }

    let element = existingElement;
    if (element) {
      if (newElement) {
        let needsPatch = element.outerHTML !== newElement.outerHTML;
        if (!needsPatch && hasDirectivesHelper(element)) {
          needsPatch = true;
        }
        if (needsPatch) {
          this.patcher.patchElement(element, newElement, resolver, app);
        }
      }
    } else {
      const pool = this.#nodePool.get(template);
      const recycledElement = pool ? pool.pop() : null;

      if (recycledElement && newElement) {
        this.patcher.patchElement(recycledElement, newElement, resolver, app);
        element = recycledElement;
        this.patcher.triggerEnter(element, resolver);
      } else if (newElement) {
        element = newElement;
        this.patcher.applyDirectives(element, resolver, app);
        this.patcher.triggerEnter(element, resolver);
      }
    }

    if (this.parserDiv) {
      this.parserDiv.innerHTML = '';
    }

    return element;
  }

  /**
   * Helper to remove a list item element and recycle it into the node pool.
   * @private
   */
  #removeItem(element, template, app) {
    if (this.eventBinder) {
      this.eventBinder.unbind(element);
    }
    this.patcher.triggerLeave(element, null, () => {
      this.#resetNodeState(element);
      element.remove();
      let pool = this.#nodePool.get(template);
      if (!pool) {
        pool = [];
        this.#nodePool.set(template, pool);
      }
      pool.push(element);
    }, app);
  }

  /**
   * Helper to insert a DOM node after a target element.
   * @private
   */
  #insertNodeAfter(node, target) {
    if (!node || !target) return;
    if (typeof target.after === 'function') {
      target.after(node);
    } else if (target.parentNode) {
      if (target.nextSibling && typeof target.parentNode.insertBefore === 'function') {
        target.parentNode.insertBefore(node, target.nextSibling);
      } else if (typeof target.parentNode.appendChild === 'function') {
        target.parentNode.appendChild(node);
      }
    }
  }

  /**
   * Helper to insert a DOM node before an anchor node, or after a fallback element.
   * @private
   */
  #insertNodeBefore(node, anchor, fallbackLast) {
    if (!node) return;
    if (anchor && anchor.parentNode) {
      if (typeof anchor.parentNode.insertBefore === 'function') {
        anchor.parentNode.insertBefore(node, anchor);
        return;
      }
      if (typeof anchor.before === 'function') {
        anchor.before(node);
        return;
      }
      if (anchor.previousElementSibling && typeof anchor.previousElementSibling.after === 'function') {
        anchor.previousElementSibling.after(node);
        return;
      }
    }
  }

  /**
   * Resets element state like focus, selection, and inputs.
   * @param {Element} element - The element to reset.
   * @private
   */
  #resetNodeState(element) {
    if (typeof document !== 'undefined' && document.activeElement &&
        (element === document.activeElement || element.contains(document.activeElement))) {
      if (typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }

    if (typeof window !== 'undefined' && window.getSelection) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          if (element.contains(range.commonAncestorContainer)) {
            selection.removeAllRanges();
          }
        } catch {
          // Ignore
        }
      }
    }

    const inputs = [];
    ['input', 'textarea', 'select'].forEach((tag) => {
      const found = element.querySelectorAll(tag);
      if (found && found.forEach) {
        found.forEach((el) => inputs.push(el));
      }
    });
    inputs.forEach((input) => {
      if (input.tagName === 'INPUT') {
        const type = input.getAttribute('type');
        if (type === 'checkbox' || type === 'radio') {
          input.checked = false;
        } else {
          input.value = '';
          if (typeof input.setSelectionRange === 'function') {
            try {
              input.setSelectionRange(0, 0);
            } catch {
              // Ignore
            }
          }
        }
      } else if (input.tagName === 'TEXTAREA') {
        input.value = '';
        if (typeof input.setSelectionRange === 'function') {
          try {
            input.setSelectionRange(0, 0);
          } catch {
            // Ignore
          }
        }
      } else if (input.tagName === 'SELECT') {
        input.selectedIndex = -1;
      }
    });
  }

  /**
   * Retrieves currently rendered items for a template by scanning subsequent siblings.
   * @param {HTMLTemplateElement} template - The template.
   * @returns {Map<string, Element>}
   * @private
   */
  #getCurrentItems(template) {
    const items = new Map();
    let current = template.nextElementSibling;
    while (current && current.hasAttribute('data-ax-list-item')) {
      if (!current._isLeaving) {
        const key = current.getAttribute('data-ax-key-val');
        items.set(key, current);
      }
      current = current.nextElementSibling;
    }
    return items;
  }
}

/**
 * Helper to check if an element or its descendants have custom directives.
 * @param {Element} el
 * @returns {boolean}
 */
function hasDirectivesHelper(el) {
  if (!el || el.nodeType !== 1) return false;
  const checkAttrs = (node) => {
    if (!node.attributes) return false;
    for (const attr of node.attributes) {
      const name = attr.name;
      if (
        name.startsWith('data-ax-') &&
        name !== 'data-ax-static' &&
        name !== 'data-ax-list-item' &&
        name !== 'data-ax-key-val'
      ) {
        return true;
      }
    }
    return false;
  };
  if (checkAttrs(el)) return true;
  if (typeof el.querySelectorAll === 'function') {
    const descendants = el.querySelectorAll('*');
    for (const desc of descendants) {
      if (checkAttrs(desc)) return true;
    }
  }
  return false;
}
