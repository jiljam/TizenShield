import { GENERIC, SITE } from './filters.js';
import { el, toArray } from './dom.js';

var STYLE_ID = 'tizenshield-adhide';
var PROBE_ID = 'tizenshield-probe';
var SWEEP_DELAY = 250;

export function selectorsFor(host) {
  var list = GENERIC.slice();
  Object.keys(SITE).forEach(function (domain) {
    var suffix = '.' + domain;
    if (host === domain || host.slice(-suffix.length) === suffix) list = list.concat(SITE[domain]);
  });
  return list.filter(function (selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch (e) {
      return false;
    }
  });
}

// Hides ads with a stylesheet, which applies before paint. On sites whose
// Content-Security-Policy blocks injected <style> tags, falls back to hiding
// matching elements one by one as the page changes.
export function startAdHiding(host) {
  var selectors = selectorsFor(host);
  if (!selectors.length || document.getElementById(STYLE_ID)) return;
  var root = document.head || document.documentElement;

  var style = el('style', { id: STYLE_ID });
  style.textContent = selectors.join(',\n') + ',#' + PROBE_ID + '{display:none!important}';
  root.appendChild(style);

  var probe = el('div', { id: PROBE_ID });
  document.documentElement.appendChild(probe);
  var applied = window.getComputedStyle(probe).display === 'none';
  document.documentElement.removeChild(probe);
  if (!applied) hideWithScript(selectors.join(','));
}

function hideWithScript(selector) {
  var pending = false;
  function sweep() {
    pending = false;
    toArray(document.querySelectorAll(selector)).forEach(function (node) {
      node.style.setProperty('display', 'none', 'important');
    });
  }
  sweep();
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(sweep, SWEEP_DELAY);
  }).observe(document.documentElement, { childList: true, subtree: true });
}
