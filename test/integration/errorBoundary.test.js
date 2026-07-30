import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

// ==========================================
// 1. Lightweight Mock DOM & HTML Parser
// ==========================================

/**
 *
 */
class MockNode {
  /**
   *
   * @param nodeType
   * @param nodeName
   */
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.childNodes = [];
    this.parentNode = null;
  }

  /**
   *
   * @param child
   */
  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  /**
   *
   * @param child
   */
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  /**
   *
   * @param newChild
   * @param oldChild
   */
  replaceChild(newChild, oldChild) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      if (newChild.parentNode) {
        newChild.parentNode.removeChild(newChild);
      }
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      oldChild.parentNode = null;
    }
    return oldChild;
  }

  /**
   *
   * @param child
   */
  contains(child) {
    let curr = child;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  /**
   *
   */
  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  /**
   *
   * @param newNode
   */
  after(newNode) {
    if (!this.parentNode) return;
    if (newNode.parentNode) {
      newNode.parentNode.removeChild(newNode);
    }
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx !== -1) {
      this.parentNode.childNodes.splice(idx + 1, 0, newNode);
      newNode.parentNode = this.parentNode;
    }
  }
}

/**
 *
 */
class MockTextNode extends MockNode {
  /**
   *
   * @param text
   */
  constructor(text) {
    super(3, '#text');
    this.textContent = text;
  }

  /**
   *
   * @param deep
   */
  cloneNode() {
    return new MockTextNode(this.textContent);
  }
}

/**
 *
 */
class MockElementNode extends MockNode {
  /**
   *
   * @param tagName
   * @param attrs
   */
  constructor(tagName, attrs = {}) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
  }

  /**
   *
   */
  get attributes() {
    return Object.entries(this.attrs).map(([name, value]) => ({ name, value }));
  }

  /**
   *
   * @param name
   */
  hasAttribute(name) {
    return name in this.attrs;
  }

  /**
   *
   * @param name
   */
  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }

  /**
   *
   * @param name
   * @param value
   */
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  /**
   *
   * @param name
   */
  removeAttribute(name) {
    delete this.attrs[name];
  }

  /**
   *
   */
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join('');
  }

  /**
   *
   */
  set textContent(val) {
    this.childNodes.forEach((c) => {
      c.parentNode = null;
    });
    this.childNodes = [];
    this.appendChild(new MockTextNode(val));
  }

  /**
   *
   */
  get innerHTML() {
    return this.childNodes
      .map((c) => {
        if (c.nodeType === 3) {
          return c.textContent;
        } else if (c.nodeType === 1) {
          return c.outerHTML;
        }
        return '';
      })
      .join('');
  }

  /**
   *
   */
  set innerHTML(htmlStr) {
    this.childNodes.forEach((c) => {
      c.parentNode = null;
    });
    this.childNodes = [];
    const parsed = parseHTML(htmlStr);
    parsed.forEach((c) => this.appendChild(c));
  }

  /**
   *
   */
  get outerHTML() {
    const attrsStr = Object.entries(this.attrs)
      .map(([name, value]) => {
        if (value === '') return ` ${name}`;
        return ` ${name}="${value}"`;
      })
      .join('');
    const tag = this.tagName.toLowerCase();
    return `<${tag}${attrsStr}>${this.innerHTML}</${tag}>`;
  }

  /**
   *
   */
  get firstElementChild() {
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        return child;
      }
    }
    return null;
  }

  /**
   *
   */
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    for (let i = idx - 1; i >= 0; i--) {
      const sibling = this.parentNode.childNodes[i];
      if (sibling.nodeType === 1) {
        return sibling;
      }
    }
    return null;
  }

  /**
   *
   */
  get nextElementSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    for (let i = idx + 1; i < this.parentNode.childNodes.length; i++) {
      const sibling = this.parentNode.childNodes[i];
      if (sibling.nodeType === 1) {
        return sibling;
      }
    }
    return null;
  }

  /**
   *
   * @param deep
   */
  cloneNode(deep) {
    const copy = new MockElementNode(this.tagName, this.attrs);
    if (deep) {
      this.childNodes.forEach((c) => {
        copy.appendChild(c.cloneNode(true));
      });
    }
    return copy;
  }

  /**
   *
   * @param selector
   */
  querySelectorAll(selector) {
    const results = [];
    const matchSelector = (el) => {
      if (selector.includes('[')) {
        const parts = selector.split('[');
        const tagNamePart = parts[0].toUpperCase();
        const attrPart = parts[1].slice(0, -1);

        if (tagNamePart && el.tagName !== tagNamePart) {
          return false;
        }

        if (attrPart.includes('=')) {
          const [name, val] = attrPart.split('=');
          const cleanVal = val.replace(/^["']|["']$/g, '');
          return el.getAttribute(name) === cleanVal;
        } else {
          return el.hasAttribute(attrPart);
        }
      } else if (selector.startsWith('.')) {
        const className = selector.slice(1);
        return el.getAttribute('class') === className;
      } else {
        return el.tagName === selector.toUpperCase();
      }
    };
    const traverse = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 1) {
          if (matchSelector(child)) {
            results.push(child);
          }
          traverse(child);
        }
      });
    };
    traverse(this);
    return results;
  }

  /**
   *
   * @param selector
   */
  querySelector(selector) {
    const res = this.querySelectorAll(selector);
    return res.length > 0 ? res[0] : null;
  }
}

/**
 *
 * @param text
 */
function createMockTextNode(text) {
  return new MockTextNode(text);
}

/**
 *
 * @param tagName
 * @param attrs
 * @param children
 */
function createMockElementNode(tagName, attrs = {}, children = []) {
  const el = new MockElementNode(tagName, attrs);
  children.forEach((c) => el.appendChild(c));
  return el;
}

/**
 *
 * @param htmlStr
 */
function parseHTML(htmlStr) {
  htmlStr = htmlStr.trim();
  if (!htmlStr) return [];

  const nodes = [];
  let remaining = htmlStr;

  while (remaining.length > 0) {
    if (remaining.startsWith('<')) {
      const closeTagIndex = remaining.indexOf('>');
      if (closeTagIndex === -1) {
        nodes.push(createMockTextNode(remaining));
        break;
      }
      const tagContent = remaining.substring(1, closeTagIndex);
      const isSelfClosing = tagContent.endsWith('/');
      const cleanTagContent = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent.trim();

      const firstSpace = cleanTagContent.indexOf(' ');
      let tagName = firstSpace === -1 ? cleanTagContent : cleanTagContent.substring(0, firstSpace);
      tagName = tagName.toUpperCase();

      const attrs = {};
      if (firstSpace !== -1) {
        const attrStr = cleanTagContent.substring(firstSpace + 1);
        const attrRegex = /([\w\d@:-]+)=["']([^"']*)["']/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2];
        }
      }

      remaining = remaining.substring(closeTagIndex + 1);

      let children = [];
      if (!isSelfClosing) {
        const endTag = `</${tagName.toLowerCase()}>`;
        const endTagIndex = findClosingTagIndex(remaining, tagName);
        if (endTagIndex === -1) {
          // treat as self-closing
        } else {
          const body = remaining.substring(0, endTagIndex);
          children = parseHTML(body);
          remaining = remaining.substring(endTagIndex + endTag.length);
        }
      }

      nodes.push(createMockElementNode(tagName, attrs, children));
    } else {
      const nextTag = remaining.indexOf('<');
      if (nextTag === -1) {
        nodes.push(createMockTextNode(remaining));
        break;
      } else {
        const text = remaining.substring(0, nextTag);
        nodes.push(createMockTextNode(text));
        remaining = remaining.substring(nextTag);
      }
    }
  }
  return nodes;
}

/**
 *
 * @param str
 * @param tagName
 */
function findClosingTagIndex(str, tagName) {
  const startTagPattern = new RegExp(`<${tagName.toLowerCase()}[\\s>]`, 'i');
  const endTagPattern = new RegExp(`</${tagName.toLowerCase()}>`, 'i');

  let depth = 1;
  let index = 0;
  let remaining = str;

  while (remaining.length > 0) {
    const startMatch = remaining.match(startTagPattern);
    const endMatch = remaining.match(endTagPattern);

    if (startMatch && (!endMatch || startMatch.index < endMatch.index)) {
      depth++;
      index += startMatch.index + startMatch[0].length;
      remaining = remaining.substring(startMatch.index + startMatch[0].length);
    } else if (endMatch) {
      depth--;
      if (depth === 0) {
        return index + endMatch.index;
      }
      index += endMatch.index + endMatch[0].length;
      remaining = remaining.substring(endMatch.index + endMatch[0].length);
    } else {
      break;
    }
  }
  return -1;
}

// Set up globals
const testRootElement = createMockElementNode('div', { id: 'app' });

global.document = {
  querySelector: (selector) => {
    if (selector === '#app') return testRootElement;
    return null;
  },
  querySelectorAll: () => [],
  createElement: (tagName) => {
    return new MockElementNode(tagName);
  },
};

global.DOMParser = class {
  /**
   *
   * @param html
   * @param type
   */
  parseFromString(html) {
    const body = createMockElementNode('body');
    const parsed = parseHTML(html);
    parsed.forEach((c) => body.appendChild(c));
    return { body };
  }
};

global.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};

// ==========================================
// 2. Component Props Integration Tests
// ==========================================

(async () => {
  try {


    console.log('🧪 Testing Error Boundaries (onErrorCaptured)...');

    // Setup DOM for AvenxApp
    testRootElement.innerHTML = '';

    // ==============================================
    // Test 1: Capture descendant errors inside onMount
    // ==============================================
    console.log('  Testing capture descendant errors inside onMount...');
    let capturedError = null;
    let globalErrorFired = false;
    
    class ChildComponent extends AvenxComponent {
      constructor(bridges) {
        super({}, {}, bridges, '<div>Child</div>');
      }
      onMount() {
        throw new Error('Child mount failed');
      }
    }
    
    const reg1 = new Map();
    reg1.set('child-comp', ChildComponent);
    
    class ParentComponent extends AvenxPage {
      constructor(bridges) {
        super({}, {}, bridges, '<div data-avenx-comp="child-comp"></div>', {}, reg1);
      }
      onErrorCaptured(err, comp, origin) {
        capturedError = err;
        return false; // stop propagation
      }
    }
    
    const app = new AvenxApp({ target: '#app' });
    app.register('parent', ParentComponent);
    app._handleError = (err) => { 
      globalErrorFired = true; 
    };
    
    app.mount('parent');
    await new Promise(r => setTimeout(r, 20));
    
    assert.strictEqual(capturedError instanceof Error, true, 'Parent should capture the error');
    assert.strictEqual(capturedError.message, 'Child mount failed');
    assert.strictEqual(globalErrorFired, false, 'Global handler should not fire if captured hook returns false');
    

    testRootElement.innerHTML = '';
    
    // ==============================================
    // Test 2: Bubble error if onErrorCaptured returns true
    // ==============================================
    console.log('  Testing error bubbling if onErrorCaptured returns true...');
    capturedError = null;
    globalErrorFired = false;
    
    class ChildComponent2 extends AvenxComponent {
      constructor(bridges) {
        super({}, {}, bridges, '<div>Child</div>');
      }
      onMount() {
        throw new Error('Child mount failed 2');
      }
    }
    
    const reg2 = new Map();
    reg2.set('child-comp2', ChildComponent2);
    
    class ParentComponent2 extends AvenxPage {
      constructor(bridges) {
        super({}, {}, bridges, '<div data-avenx-comp="child-comp2"></div>', {}, reg2);
      }
      onErrorCaptured(err, comp, origin) {
        capturedError = err;
        return true; // continue propagation
      }
    }
    
    const app2 = new AvenxApp({ target: '#app' });
    app2.register('parent2', ParentComponent2);
    app2._handleError = (err) => { globalErrorFired = true; };
    
    app2.mount('parent2');
    await new Promise(r => setTimeout(r, 20));
    
    assert.strictEqual(capturedError instanceof Error, true, 'Parent should capture the error');
    assert.strictEqual(capturedError.message, 'Child mount failed 2');
    assert.strictEqual(globalErrorFired, true, 'Global handler should fire if captured hook returns true');
    

    testRootElement.innerHTML = '';
    
    // ==============================================
    // Test 3: Errors inside template expression evaluation
    // ==============================================
    console.log('  Testing errors inside template expression evaluation...');
    capturedError = null;
    
    class ChildComponent3 extends AvenxComponent {
      constructor(bridges) {
        super({ msg: 'hello' }, {}, bridges, '<div>{{ badFunction() }}</div>');
      }
    }
    
    const reg3 = new Map();
    reg3.set('child-comp3', ChildComponent3);
    
    class ParentComponent3 extends AvenxPage {
      constructor(bridges) {
        super({}, {}, bridges, '<div data-avenx-comp="child-comp3"></div>', {}, reg3);
      }
      onErrorCaptured(err, comp, origin) {
        capturedError = err;
        return false; // stop propagation
      }
    }
    
    const app3 = new AvenxApp({ target: '#app' });
    app3.register('parent3', ParentComponent3);
    
    app3.mount('parent3');
    await new Promise(r => setTimeout(r, 20));
    
    assert.strictEqual(capturedError instanceof Error, true, 'Parent should capture template evaluation errors');
    assert.match(capturedError.message, /badFunction is not defined|badFunction is not a function/);
    


    console.log('  ✅ Error Boundaries tests passed!');
  } catch (error) {
    console.error('❌ Error Boundaries tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
