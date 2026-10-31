import { define, defineGetter } from './define.js';

// Page APIs newer than Chrome 47.

// KeyboardEvent.key arrived in Chrome 51. Without it, sites that check
// event.key === 'Enter' or 'ArrowDown' ignore the remote entirely.
var KEY_NAMES = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Control', 18: 'Alt', 19: 'Pause', 20: 'CapsLock',
  27: 'Escape', 32: ' ', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home', 37: 'ArrowLeft', 38: 'ArrowUp',
  39: 'ArrowRight', 40: 'ArrowDown', 45: 'Insert', 46: 'Delete', 91: 'Meta', 93: 'ContextMenu',
  // Samsung remote keys
  10009: 'GoBack', 415: 'MediaPlay', 10252: 'MediaPlayPause', 413: 'MediaStop', 417: 'MediaFastForward',
  412: 'MediaRewind', 403: 'ColorF0Red', 404: 'ColorF1Green', 405: 'ColorF2Yellow', 406: 'ColorF3Blue',
  427: 'ChannelUp', 428: 'ChannelDown'
};

export function keyName(event) {
  if (event.type === 'keypress' && event.charCode) return String.fromCharCode(event.charCode);
  var code = event.keyCode || event.which;
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code >= 112 && code <= 123) return 'F' + (code - 111);
  if (code >= 96 && code <= 105) return String(code - 96);
  if (code >= 48 && code <= 57 && !event.shiftKey) return String(code - 48);
  if (code >= 65 && code <= 90) {
    var letter = String.fromCharCode(code);
    return event.shiftKey ? letter : letter.toLowerCase();
  }
  return 'Unidentified';
}

// The arguments of append(), before(), ... as one node.
function nodeFrom(args) {
  var fragment = document.createDocumentFragment();
  for (var i = 0; i < args.length; i++) {
    var item = args[i];
    fragment.appendChild(item instanceof Node ? item : document.createTextNode(String(item)));
  }
  return fragment;
}

var parentNodeMethods = {
  append: function () { this.appendChild(nodeFrom(arguments)); },
  prepend: function () { this.insertBefore(nodeFrom(arguments), this.firstChild); }
};

var childNodeMethods = {
  before: function () {
    if (this.parentNode) this.parentNode.insertBefore(nodeFrom(arguments), this);
  },
  after: function () {
    if (this.parentNode) this.parentNode.insertBefore(nodeFrom(arguments), this.nextSibling);
  },
  replaceWith: function () {
    if (this.parentNode) this.parentNode.replaceChild(nodeFrom(arguments), this);
  }
};

function installMethods(prototypes, methods, added) {
  Object.keys(methods).forEach(function (name) {
    var defined = [];
    prototypes.forEach(function (proto) { define(proto, name, methods[name], defined); });
    if (defined.length) added.push('Node.' + name);
  });
}

// scroll options ({ top, left, behavior }) arrived in Chrome 61, as did
// element.scrollTo() itself. Smooth scrolling is approximated as instant.
function installScrollOptions(win, added) {
  if ('scrollBehavior' in win.document.documentElement.style) return;
  ['scroll', 'scrollTo', 'scrollBy'].forEach(function (name) {
    var original = win[name];
    if (typeof original !== 'function') return;
    win[name] = function (a, b) {
      if (!a || typeof a !== 'object') return original.apply(win, arguments);
      var by = name === 'scrollBy';
      var x = a.left !== undefined ? +a.left : by ? 0 : win.pageXOffset;
      var y = a.top !== undefined ? +a.top : by ? 0 : win.pageYOffset;
      return original.call(win, x || 0, y || 0);
    };
  });
  function elementScroll(by) {
    return function (a, b) {
      var options = a && typeof a === 'object' ? a : { left: a, top: b };
      if (options.left !== undefined) this.scrollLeft = (by ? this.scrollLeft : 0) + (+options.left || 0);
      if (options.top !== undefined) this.scrollTop = (by ? this.scrollTop : 0) + (+options.top || 0);
    };
  }
  var EP = win.Element.prototype;
  define(EP, 'scroll', elementScroll(false), added, 'Element.scroll');
  define(EP, 'scrollTo', elementScroll(false), added, 'Element.scrollTo');
  define(EP, 'scrollBy', elementScroll(true), added, 'Element.scrollBy');
  added.push('scroll options');
}

function SimpleRect(x, y, width, height) {
  this.x = +x || 0;
  this.y = +y || 0;
  this.width = +width || 0;
  this.height = +height || 0;
}
SimpleRect.prototype = {
  constructor: SimpleRect,
  get top() { return Math.min(this.y, this.y + this.height); },
  get left() { return Math.min(this.x, this.x + this.width); },
  get right() { return Math.max(this.x, this.x + this.width); },
  get bottom() { return Math.max(this.y, this.y + this.height); },
  toJSON: function () {
    return { x: this.x, y: this.y, width: this.width, height: this.height,
      top: this.top, left: this.left, right: this.right, bottom: this.bottom };
  }
};
SimpleRect.fromRect = function (r) {
  r = r || {};
  return new SimpleRect(r.x, r.y, r.width, r.height);
};

export function installDom(win, added) {
  var KE = win.KeyboardEvent;
  if (KE) defineGetter(KE.prototype, 'key', function () { return keyName(this); }, added, 'KeyboardEvent.key');

  var NL = win.NodeList.prototype;
  define(NL, 'forEach', win.Array.prototype.forEach, added, 'NodeList.forEach');
  define(NL, win.Symbol.iterator, win.Array.prototype[win.Symbol.iterator], added, 'NodeList iteration');
  define(win.HTMLCollection.prototype, win.Symbol.iterator, win.Array.prototype[win.Symbol.iterator], added, 'HTMLCollection iteration');

  installMethods([win.Element.prototype, win.Document.prototype, win.DocumentFragment.prototype], parentNodeMethods, added);
  installMethods([win.Element.prototype, win.CharacterData.prototype, win.DocumentType.prototype], childNodeMethods, added);

  var EP = win.Element.prototype;
  define(EP, 'toggleAttribute', function (name, force) {
    var on = force === undefined ? !this.hasAttribute(name) : !!force;
    if (on) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return on;
  }, added, 'Element.toggleAttribute');
  define(EP, 'getAttributeNames', function () {
    return Array.prototype.map.call(this.attributes, function (attr) { return attr.name; });
  }, added, 'Element.getAttributeNames');
  defineGetter(win.Node.prototype, 'isConnected', function () {
    if (this.nodeType === 9) return true;
    var doc = this.ownerDocument;
    return !!doc && doc.documentElement.contains(this);
  }, added, 'Node.isConnected');
  define(win.Event.prototype, 'composedPath', function () {
    if (this.path) return Array.prototype.slice.call(this.path);
    var path = [];
    // Up to the document, then its window (which has no parentNode).
    for (var node = this.target; node; node = node.parentNode || (node.nodeType === 9 ? node.defaultView : null)) {
      path.push(node);
    }
    return path;
  }, added, 'Event.composedPath');

  // getBoundingClientRect() gives a ClientRect without x/y before Chrome 61.
  var CR = win.ClientRect;
  if (CR) {
    defineGetter(CR.prototype, 'x', function () { return this.left; }, added, 'ClientRect.x');
    defineGetter(CR.prototype, 'y', function () { return this.top; }, added, 'ClientRect.y');
  }
  define(win, 'DOMRect', SimpleRect, added);

  installScrollOptions(win, added);

  define(win, 'requestIdleCallback', function (callback) {
    var start = Date.now();
    return setTimeout(function () {
      callback({ didTimeout: false, timeRemaining: function () { return Math.max(0, 50 - (Date.now() - start)); } });
    }, 1);
  }, added);
  define(win, 'cancelIdleCallback', function (id) { clearTimeout(id); }, added);
}
