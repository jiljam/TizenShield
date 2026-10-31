import { define } from './define.js';

// IntersectionObserver (Chrome 51) and ResizeObserver (Chrome 64). Sites use
// the first to lazy-load images and for infinite scroll: without it, posters
// and thumbnails never appear. Both re-check on scroll, resize, DOM changes
// and loads, throttled so a weak TV CPU isn't kept busy. Simplifications:
// clipping by scrollable ancestors is ignored, and IntersectionObserver
// rootMargin supports px and %.

var CHECK_DELAY_MS = 100;
var RESIZE_POLL_MS = 1000;

var active = [];
var pending = false;
var listening = false;
var pollTimer = null;

function checkAll() {
  pending = false;
  active.slice().forEach(function (observer) { observer._check(); });
}

function schedule() {
  if (pending) return;
  pending = true;
  setTimeout(checkAll, CHECK_DELAY_MS);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  document.addEventListener('load', schedule, true);
  document.addEventListener('transitionend', schedule, true);
  new MutationObserver(schedule).observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
}

function register(observer) {
  if (active.indexOf(observer) < 0) active.push(observer);
  listen();
  schedule();
  // Size changes from CSS (media queries, fonts loading) fire no events.
  if (observer instanceof SizeObserver && !pollTimer) pollTimer = setInterval(schedule, RESIZE_POLL_MS);
}

function unregister(observer) {
  var i = active.indexOf(observer);
  if (i >= 0) active.splice(i, 1);
  var anySize = active.some(function (o) { return o instanceof SizeObserver; });
  if (!anySize && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function isRendered(el) {
  return document.documentElement.contains(el) && el.getClientRects().length > 0;
}

function plainRect(r) {
  return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top };
}

var EMPTY = plainRect({ top: 0, left: 0, bottom: 0, right: 0 });

// Edge-adjacent rectangles count as intersecting, as in the spec.
export function intersect(a, b) {
  var top = Math.max(a.top, b.top);
  var left = Math.max(a.left, b.left);
  var bottom = Math.min(a.bottom, b.bottom);
  var right = Math.min(a.right, b.right);
  if (bottom < top || right < left) return null;
  return plainRect({ top: top, left: left, bottom: bottom, right: right });
}

// "10px 20%" -> [top, right, bottom, left] as {value, percent} pairs.
export function parseMargin(text) {
  var parts = String(text || '0px').trim().split(/\s+/).map(function (part) {
    var match = /^(-?\d*\.?\d+)(px|%)?$/.exec(part);
    if (!match) throw new SyntaxError('rootMargin must be specified in pixels or percent');
    return { value: parseFloat(match[1]), percent: match[2] === '%' };
  });
  if (parts.length === 1) parts = [parts[0], parts[0], parts[0], parts[0]];
  else if (parts.length === 2) parts = [parts[0], parts[1], parts[0], parts[1]];
  else if (parts.length === 3) parts = [parts[0], parts[1], parts[2], parts[1]];
  return parts.slice(0, 4);
}

// Which threshold band a ratio falls in: the index of the first threshold
// above it, or the number of thresholds.
export function thresholdIndex(thresholds, ratio) {
  for (var i = 0; i < thresholds.length; i++) if (thresholds[i] > ratio) return i;
  return thresholds.length;
}

function Entry(init) {
  for (var key in init) this[key] = init[key];
}
Entry.prototype.intersectionRatio = 0;
Entry.prototype.isIntersecting = false;

export function IntersectionObserver(callback, options) {
  if (typeof callback !== 'function') throw new TypeError('IntersectionObserver callback must be a function');
  options = options || {};
  this._callback = callback;
  this._targets = [];
  this.root = options.root || null;
  this.rootMargin = options.rootMargin || '0px';
  this._margin = parseMargin(this.rootMargin);
  var thresholds = options.threshold === undefined ? [0] : [].concat(options.threshold);
  this.thresholds = thresholds.map(Number).sort(function (a, b) { return a - b; });
}

IntersectionObserver.prototype = {
  constructor: IntersectionObserver,
  observe: function (target) {
    for (var i = 0; i < this._targets.length; i++) if (this._targets[i].el === target) return;
    this._targets.push({ el: target, state: '' });
    register(this);
  },
  unobserve: function (target) {
    this._targets = this._targets.filter(function (t) { return t.el !== target; });
    if (!this._targets.length) unregister(this);
  },
  disconnect: function () {
    this._targets = [];
    unregister(this);
  },
  takeRecords: function () {
    return [];
  },
  _rootRect: function () {
    var base;
    if (this.root) {
      if (!isRendered(this.root)) return null;
      base = plainRect(this.root.getBoundingClientRect());
    } else {
      base = plainRect({ top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth });
    }
    var m = this._margin.map(function (part, i) {
      var size = i % 2 ? base.width : base.height;
      return part.percent ? (part.value / 100) * size : part.value;
    });
    return plainRect({ top: base.top - m[0], right: base.right + m[1], bottom: base.bottom + m[2], left: base.left - m[3] });
  },
  _check: function () {
    var self = this;
    var rootRect = this._rootRect();
    var entries = [];
    this._targets.forEach(function (t) {
      var rendered = isRendered(t.el);
      var rect = rendered ? plainRect(t.el.getBoundingClientRect()) : EMPTY;
      var hit = rendered && rootRect ? intersect(rect, rootRect) : null;
      var area = rect.width * rect.height;
      var ratio = !hit ? 0 : area ? (hit.width * hit.height) / area : 1;
      var state = thresholdIndex(self.thresholds, ratio) + ':' + !!hit;
      if (state === t.state) return;
      t.state = state;
      entries.push(new Entry({
        time: window.performance ? window.performance.now() : Date.now(),
        target: t.el,
        rootBounds: rootRect,
        boundingClientRect: rect,
        intersectionRect: hit || EMPTY,
        intersectionRatio: ratio,
        isIntersecting: !!hit
      }));
    });
    if (entries.length) this._callback(entries, this);
  }
};

function contentSize(el) {
  if (!isRendered(el)) return { width: 0, height: 0, top: 0, left: 0, border: { width: 0, height: 0 } };
  if (el instanceof SVGElement) {
    var box = el.getBoundingClientRect();
    return { width: box.width, height: box.height, top: 0, left: 0, border: { width: box.width, height: box.height } };
  }
  var style = window.getComputedStyle(el);
  var padLeft = parseFloat(style.paddingLeft) || 0;
  var padTop = parseFloat(style.paddingTop) || 0;
  var width = Math.max(0, el.clientWidth - padLeft - (parseFloat(style.paddingRight) || 0));
  var height = Math.max(0, el.clientHeight - padTop - (parseFloat(style.paddingBottom) || 0));
  return { width: width, height: height, top: padTop, left: padLeft, border: { width: el.offsetWidth, height: el.offsetHeight } };
}

function SizeObserver(callback) {
  if (typeof callback !== 'function') throw new TypeError('ResizeObserver callback must be a function');
  this._callback = callback;
  this._targets = [];
}

SizeObserver.prototype = {
  constructor: SizeObserver,
  observe: function (target) {
    for (var i = 0; i < this._targets.length; i++) if (this._targets[i].el === target) return;
    this._targets.push({ el: target, width: -1, height: -1 });
    register(this);
  },
  unobserve: function (target) {
    this._targets = this._targets.filter(function (t) { return t.el !== target; });
    if (!this._targets.length) unregister(this);
  },
  disconnect: function () {
    this._targets = [];
    unregister(this);
  },
  _check: function () {
    var entries = [];
    this._targets.forEach(function (t) {
      var size = contentSize(t.el);
      if (size.width === t.width && size.height === t.height) return;
      t.width = size.width;
      t.height = size.height;
      entries.push({
        target: t.el,
        contentRect: plainRect({ top: size.top, left: size.left, bottom: size.top + size.height, right: size.left + size.width }),
        contentBoxSize: [{ inlineSize: size.width, blockSize: size.height }],
        borderBoxSize: [{ inlineSize: size.border.width, blockSize: size.border.height }]
      });
    });
    if (entries.length) this._callback(entries, this);
  }
};

export function installObservers(win, added) {
  if (!('IntersectionObserver' in win)) {
    define(win, 'IntersectionObserver', IntersectionObserver, added);
    define(win, 'IntersectionObserverEntry', Entry, []);
  }
  define(win, 'ResizeObserver', SizeObserver, added);
}
