import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

// ==========================================
// 1. Lightweight Mock DOM & HTML Parser
// ==========================================

class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.childNodes = [];
    this.parentNode = null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

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

  contains(child) {
    let curr = child;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

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

class MockTextNode extends MockNode {
  constructor(text) {
    super(3, '#text');
    this.textContent = text;
  }

  cloneNode() {
    return new MockTextNode(this.textContent);
  }
}

class MockElementNode extends MockNode {
  constructor(tagName, attrs = {}) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
  }

  get attributes() {
    return Object.entries(this.attrs).map(([name, value]) => ({ name, value }));
  }

  hasAttribute(name) {
    return name in this.attrs;
  }

  getAttribute(name) {
    return name in this.attrs ? this.attrs[name] : null;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  get textContent() {
    return this.childNodes.map((c) => c.textContent).join('');
  }

  set textContent(val) {
    this.childNodes.forEach((c) => {
      c.parentNode = null;
    });
    this.childNodes = [];
    this.appendChild(new MockTextNode(val));
  }

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

  set innerHTML(htmlStr) {
    this.childNodes.forEach((c) => {
      c.parentNode = null;
    });
    this.childNodes = [];
    const parsed = parseHTML(htmlStr);
    parsed.forEach((c) => this.appendChild(c));
  }

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

  get firstElementChild() {
    for (const child of this.childNodes) {
      if (child.nodeType === 1) {
        return child;
      }
    }
    return null;
  }

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

  cloneNode(deep) {
    const copy = new MockElementNode(this.tagName, this.attrs);

    if (deep) {
      this.childNodes.forEach((c) => {
        copy.appendChild(c.cloneNode(true));
      });
    }

    return copy;
  }

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
        }

        return el.hasAttribute(attrPart);
      }

      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        const classAttr = el.getAttribute('class') || '';
        return classAttr.split(' ').includes(className);
      }

      return el.tagName === selector.toUpperCase();
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

  querySelector(selector) {
    const res = this.querySelectorAll(selector);
    return res.length > 0 ? res[0] : null;
  }
}

function createMockTextNode(text) {
  return new MockTextNode(text);
}

function createMockElementNode(tagName, attrs = {}, children = []) {
  const el = new MockElementNode(tagName, attrs);
  children.forEach((c) => el.appendChild(c));
  return el;
}

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

        if (endTagIndex !== -1) {
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
      }

      const text = remaining.substring(0, nextTag);
      nodes.push(createMockTextNode(text));
      remaining = remaining.substring(nextTag);
    }
  }

  return nodes;
}

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
// 2. Integration Tests for Slots Fallback
// ==========================================

(async () => {
  try {
    console.log('🧪 Testing HTML Slots Fallback and Transclusion...');
    let unmountCount = 0;

    class FallbackComponent extends AvenxComponent {
      constructor(bridges, props) {
        super(
          {},
          {},
          bridges,
          '<div class="fallback-root"><slot>Default Fallback Content</slot></div>',
          {},
          props,
        );
      }
    }

    class LayoutComponent extends AvenxComponent {
      constructor(bridges, props) {
        super(
          {},
          {},
          bridges,
          '<div class="layout-component-root">' +
          '  <div class="header-container"><slot name="header">Fallback Header</slot></div>' +
          '  <div class="footer-container"><slot name="footer">Fallback Footer</slot></div>' +
          '</div>',
          {
            onUnmount: () => {
              unmountCount++;
            }
          },
          props,
        );
      }
    }

    class SlotsPage extends AvenxPage {
      constructor(bridges, componentRegistry) {
        const cp = new ComponentParser(new StyleProcessor());

        const compiledTemplate = cp.processComponentTags(
          '<div>' +
            '  <!-- Test 1: Empty child -->' +
            '  <FallbackComponent></FallbackComponent>' +
            '  <!-- Test 1: Populated child -->' +
            '  <FallbackComponent><p>Actual Content 1</p><p>Actual Content 2</p></FallbackComponent>' +
            '  <!-- Test 2, 3: Selective, Reactive child -->' +
            '  <LayoutComponent id="static-layout">' +
            '    <h1 slot="header">{{ title }}</h1>' +
            '  </LayoutComponent>' +
            '  <!-- Test 4: Dynamic unmounting child -->' +
            "  {{{ showChild ? '<div data-avenx-comp=\"LayoutComponent\"></div>' : '' }}}" +
          '</div>'
        );

        super(
          {
            title: 'Initial Title',
            showChild: true,
          },
          {},
          bridges,
          compiledTemplate,
          {},
          componentRegistry,
        );
      }
    }

    const registry = new Map();
    registry.set('FallbackComponent', FallbackComponent);
    registry.set('LayoutComponent', LayoutComponent);

    const page = new SlotsPage({}, registry);

    page.mount(testRootElement);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Test 1: Default fallback
    console.log('  Testing default fallback rendering...');
    const fallbacks = testRootElement.querySelectorAll('.fallback-root');
    assert.strictEqual(fallbacks.length, 2, 'Should render two FallbackComponent instances');
    
    // First instance should have fallback text
    assert.strictEqual(fallbacks[0].textContent.trim(), 'Default Fallback Content', 'Empty component should render fallback text');
    
    // Second instance should have custom text, and absolutely no fallback text
    assert.ok(fallbacks[1].textContent.includes('Actual Content 1'), 'Populated component should render transcluded content 1');
    assert.ok(fallbacks[1].textContent.includes('Actual Content 2'), 'Populated component should render transcluded content 2');
    assert.strictEqual(fallbacks[1].textContent.includes('Default Fallback Content'), false, 'Populated component should NOT render fallback text');

    // Test 2: Named slots (Selective transclusion)
    console.log('  Testing selective named slots transclusion...');
    const layoutEls = testRootElement.querySelectorAll('.layout-component-root');
    const staticLayoutEl = layoutEls[0];
    
    assert.ok(staticLayoutEl, 'Static layout component should be mounted');

    const headerContainer = staticLayoutEl.querySelector('.header-container');
    const footerContainer = staticLayoutEl.querySelector('.footer-container');
    
    assert.ok(headerContainer.textContent.includes('Initial Title'), 'Header slot should render provided content');
    assert.strictEqual(headerContainer.textContent.includes('Fallback Header'), false, 'Header slot should NOT render fallback when content provided');
    
    assert.strictEqual(footerContainer.textContent.trim(), 'Fallback Footer', 'Footer slot should render fallback when NO content provided');

    // Test 3: Reactive transcluded content
    console.log('  Testing reactivity of transcluded parent state...');
    page.state.title = 'Updated Title';
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(headerContainer.textContent.includes('Updated Title'), 'Transcluded content should update reactively');
    assert.strictEqual(headerContainer.textContent.includes('Initial Title'), false, 'Old content should be replaced');
    assert.strictEqual(footerContainer.textContent.trim(), 'Fallback Footer', 'Footer slot should remain unaffected');

    // Test 4: Dynamic unmounting
    console.log('  Testing unmount cleanup of slots...');
    page.state.showChild = false;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const allLayouts = testRootElement.querySelectorAll('.layout-component-root');
    assert.strictEqual(allLayouts.length, 1, 'Dynamic layout component should be removed from DOM, leaving only static layout');
    
    // Ensure the unmount hook fired
    assert.strictEqual(unmountCount, 1, 'LayoutComponent onUnmount hook should have fired exactly once for the dynamically removed component');

    console.log('  ✅ HTML Slots Fallback and Transclusion tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ HTML Slots Fallback and Transclusion tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
