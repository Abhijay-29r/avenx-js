/**
 * @file eventAttributes.js
 * @description Recognises inline event-handler attributes (`onclick`, …).
 *
 * A browser executes an `on*` content attribute only when it names a known
 * event handler. `onclick` and `onerror` run; `once`, `online` and a made-up
 * `onwhatever` do not. Matching the real set rather than every `on`-prefixed
 * name is what lets Avenx refuse a dangerous `onclick="{{ expr }}"` binding
 * without flagging an ordinary attribute that happens to start with `on`.
 *
 * The set is the HTML event-handler content attributes: `GlobalEventHandlers`,
 * `WindowEventHandlers`, and the document/element-specific ones that can appear
 * on an element in a template. It is used by the compiler (to refuse a bound
 * handler and warn on a static one) and by the runtime (defence in depth on the
 * attribute-setting paths), so both agree on exactly what counts.
 * @module lib/core/security/eventAttributes
 */

/**
 * Inline event-handler content attribute names, lowercased.
 * @type {Set<string>}
 */
export const EVENT_HANDLER_ATTRIBUTES = new Set([
  // GlobalEventHandlers
  'onabort', 'onanimationcancel', 'onanimationend', 'onanimationiteration', 'onanimationstart',
  'onauxclick', 'onbeforeinput', 'onbeforematch', 'onbeforetoggle', 'onblur', 'oncancel',
  'oncanplay', 'oncanplaythrough', 'onchange', 'onclick', 'onclose', 'oncontextlost',
  'oncontextmenu', 'oncontextrestored', 'oncopy', 'oncuechange', 'oncut', 'ondblclick',
  'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
  'ondurationchange', 'onemptied', 'onended', 'onerror', 'onfocus', 'onformdata',
  'ongotpointercapture', 'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup',
  'onload', 'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onlostpointercapture',
  'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover',
  'onmouseup', 'onmousewheel', 'onpaste', 'onpause', 'onplay', 'onplaying', 'onpointercancel',
  'onpointerdown', 'onpointerenter', 'onpointerleave', 'onpointermove', 'onpointerout',
  'onpointerover', 'onpointerrawupdate', 'onpointerup', 'onprogress', 'onratechange',
  'onreset', 'onresize', 'onscroll', 'onscrollend', 'onsecuritypolicyviolation', 'onseeked',
  'onseeking', 'onselect', 'onselectionchange', 'onselectstart', 'onslotchange', 'onstalled',
  'onsubmit', 'onsuspend', 'ontimeupdate', 'ontoggle', 'ontransitioncancel', 'ontransitionend',
  'ontransitionrun', 'ontransitionstart', 'onvolumechange', 'onwaiting', 'onwheel',
  // Touch
  'ontouchcancel', 'ontouchend', 'ontouchmove', 'ontouchstart',
  // WindowEventHandlers (valid on <body>/<frameset>, and set on any element)
  'onafterprint', 'onbeforeprint', 'onbeforeunload', 'onhashchange', 'onlanguagechange',
  'onmessage', 'onmessageerror', 'onoffline', 'ononline', 'onpagehide', 'onpageshow',
  'onpopstate', 'onrejectionhandled', 'onstorage', 'onunhandledrejection', 'onunload',
  // Document / media / misc
  'oncachechange', 'onfullscreenchange', 'onfullscreenerror', 'onpointerlockchange',
  'onpointerlockerror', 'onreadystatechange', 'onvisibilitychange', 'onwebkitanimationend',
  'onwebkitanimationiteration', 'onwebkitanimationstart', 'onwebkittransitionend',
]);

/**
 * Whether an attribute name is an inline event-handler content attribute.
 *
 * HTML attribute names are case-insensitive, so `onClick` on a native element
 * is the `onclick` handler; the test lowercases first.
 * @param {string} name - The attribute name as written.
 * @returns {boolean} True when the browser would run its value as a handler.
 */
export function isEventHandlerAttribute(name) {
  return typeof name === 'string' && EVENT_HANDLER_ATTRIBUTES.has(name.toLowerCase());
}
