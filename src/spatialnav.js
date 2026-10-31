import { toArray } from './dom.js';

// Moves focus between links, buttons and fields with the arrow keys, like a
// TV app. When nothing focusable is close enough in that direction, the page
// scrolls instead, so long articles can still be read.

var FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex],[contenteditable="true"]';
var EDGE_MARGIN = 80;
var SCROLL_FRACTION = 0.6;

function viewport() {
  return { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
}

function onScreen(r, vp) {
  return r.bottom > vp.top && r.top < vp.bottom && r.right > vp.left && r.left < vp.right;
}

function isShown(node) {
  var style = window.getComputedStyle(node);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

// The edge of the screen opposite the direction of travel: where to measure
// from when nothing on screen is focused.
function edgeRect(dir, vp) {
  if (dir === 'down') return { top: vp.top, bottom: vp.top, left: vp.left, right: vp.right };
  if (dir === 'up') return { top: vp.bottom, bottom: vp.bottom, left: vp.left, right: vp.right };
  if (dir === 'right') return { top: vp.top, bottom: vp.bottom, left: vp.left, right: vp.left };
  return { top: vp.top, bottom: vp.bottom, left: vp.right, right: vp.right };
}

// Distance between the intervals [a1, a2] and [b1, b2]; 0 when they overlap.
function gap(a1, a2, b1, b2) {
  return Math.max(0, b1 - a2, a1 - b2);
}

// How far r is from `from` when travelling in dir: `along` is the distance
// in that direction, `score` also penalises sideways misalignment. Returns
// null when r isn't in that direction at all.
function measure(from, r, dir) {
  var along, across;
  var fromMidY = (from.top + from.bottom) / 2;
  var fromMidX = (from.left + from.right) / 2;
  if (dir === 'down' || dir === 'up') {
    var midY = (r.top + r.bottom) / 2;
    if (dir === 'down' ? midY <= fromMidY || r.bottom <= from.bottom : midY >= fromMidY || r.top >= from.top) return null;
    along = dir === 'down' ? Math.max(0, r.top - from.bottom) : Math.max(0, from.top - r.bottom);
    across = gap(from.left, from.right, r.left, r.right);
  } else {
    var midX = (r.left + r.right) / 2;
    if (dir === 'right' ? midX <= fromMidX || r.right <= from.right : midX >= fromMidX || r.left >= from.left) return null;
    along = dir === 'right' ? Math.max(0, r.left - from.right) : Math.max(0, from.left - r.right);
    across = gap(from.top, from.bottom, r.top, r.bottom);
  }
  return { along: along, score: along + across * 3 };
}

export function focusables(scope, exclude) {
  return toArray(scope.querySelectorAll(FOCUSABLE)).filter(function (node) {
    if (node.disabled || node.getAttribute('tabindex') === '-1') return false;
    return !(exclude && exclude.contains(node));
  });
}

// Keeps a little space between the focused element and the screen edge.
function reveal(node) {
  var r = node.getBoundingClientRect();
  var height = window.innerHeight;
  if (r.height > height - 2 * EDGE_MARGIN) return;
  if (r.top < EDGE_MARGIN) window.scrollBy(0, r.top - EDGE_MARGIN);
  else if (r.bottom > height - EDGE_MARGIN) window.scrollBy(0, r.bottom - height + EDGE_MARGIN);
}

function scrollPage(dir, vp) {
  var dy = Math.round(vp.bottom * SCROLL_FRACTION);
  var dx = Math.round(vp.right * SCROLL_FRACTION);
  if (dir === 'down') window.scrollBy(0, dy);
  else if (dir === 'up') window.scrollBy(0, -dy);
  else if (dir === 'right') window.scrollBy(dx, 0);
  else window.scrollBy(-dx, 0);
}

// options.scope: element to search in; options.exclude: element to skip
// (our own UI); options.scroll: scroll when there's no target. Returns true
// when focus moved or the page scrolled.
export function move(dir, options) {
  var vp = viewport();
  var candidates = focusables(options.scope, options.exclude);
  var current = document.activeElement;
  var from = null;
  if (current && candidates.indexOf(current) >= 0) {
    var rect = current.getBoundingClientRect();
    if (onScreen(rect, vp)) from = rect;
  }
  if (!from) {
    current = null;
    from = edgeRect(dir, vp);
  }

  var best = null;
  var bestScore = Infinity;
  var bestAlong = 0;
  candidates.forEach(function (node) {
    if (node === current) return;
    var r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var m = measure(from, r, dir);
    // getComputedStyle is the slow part, so only check likely winners.
    if (!m || m.score >= bestScore || !isShown(node)) return;
    best = node;
    bestScore = m.score;
    bestAlong = m.along;
  });

  var reach = dir === 'up' || dir === 'down' ? vp.bottom * 0.75 : vp.right;
  if (best && (!options.scroll || bestAlong <= reach)) {
    best.focus();
    reveal(best);
    return true;
  }
  if (options.scroll) {
    scrollPage(dir, vp);
    return true;
  }
  return false;
}
