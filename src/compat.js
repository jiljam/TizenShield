import { el, hostOf, toArray } from './dom.js';
import { MODAL, createModal, modalButton } from './modal.js';

// Explains blank pages. Script errors are recorded from the moment
// TizenBrew injects us; a few seconds after the page loads, if it still
// looks empty, the most likely cause is shown instead of a silent blank
// screen. Errors thrown before injection are missed, hence the softer
// "still looks empty" fallback later on.

var STRONG_DELAY_MS = 2500;
var WEAK_DELAY_MS = 10000;
var NO_LOAD_TIMEOUT_MS = 20000;
var EMPTY_TEXT_MAX = 200;

var SYNTAX = /SyntaxError|Unexpected (token|identifier|string|number|reserved word|strict mode)|missing \) after|Invalid regular expression|Block-scoped declarations/i;
var MISSING = /(?:ReferenceError|TypeError):\s*(?:Can't find variable:\s*)?([\w$.]+) is not (?:defined|a function|a constructor)/;
var TOO_NEW = "This site can't run on your TV's browser";

var report = { errors: 0, syntax: 0, missing: [], blocked: [] };

function siteOf(host) {
  return host.split('.').slice(-2).join('.');
}

export function classifyError(message) {
  var missing = MISSING.exec(message);
  return { syntax: SYNTAX.test(message), missing: missing ? missing[1] : null };
}

export function watchErrors() {
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window) {
      // A resource failed. Only the site's own scripts matter: ad and
      // tracker scripts blocked by DNS are expected.
      var src = target.tagName === 'SCRIPT' ? target.src : '';
      if (src && siteOf(hostOf(src)) === siteOf(window.location.hostname)) report.blocked.push(hostOf(src));
      return;
    }
    report.errors++;
    var kind = classifyError(String(event.message || ''));
    if (kind.syntax) report.syntax++;
    if (kind.missing && report.missing.indexOf(kind.missing) < 0) report.missing.push(kind.missing);
  }, true);
}

// Chrome 47 ignores <script type="module">: a page with no fallback
// (nomodule) script never starts.
function moduleOnly() {
  return !!document.querySelector('script[type="module"]') && !document.querySelector('script[nomodule]');
}

export function compatReport() {
  return {
    errors: report.errors,
    syntax: report.syntax,
    missing: report.missing.slice(),
    blocked: report.blocked.slice(),
    moduleOnly: moduleOnly()
  };
}

function looksEmpty() {
  var body = document.body;
  if (!body) return true;
  if ((body.innerText || '').replace(/\s+/g, ' ').trim().length > EMPTY_TEXT_MAX) return false;
  var width = window.innerWidth;
  var height = window.innerHeight;
  return !toArray(document.querySelectorAll('img,picture,video,canvas,iframe,svg,embed,object')).some(function (node) {
    var r = node.getBoundingClientRect();
    return r.width >= 150 && r.height >= 100 && r.bottom > 0 && r.top < height && r.right > 0 && r.left < width;
  });
}

// What to tell the user, or null when the page seems fine.
function diagnose(allowWeak) {
  if (!looksEmpty()) return null;
  var r = compatReport();
  if (r.moduleOnly) return { title: TOO_NEW, reason: 'It loads its code in a way that browsers older than 2018 skip, so nothing appears.' };
  if (r.syntax) return { title: TOO_NEW, reason: "Its code uses newer JavaScript that your TV's browser can't read." };
  if (r.missing.length) {
    return { title: TOO_NEW, reason: "It needs browser features your TV doesn't have (" + r.missing.slice(0, 3).join(', ') + ').' };
  }
  if (r.blocked.length) {
    return {
      title: "Part of this site didn't load",
      reason: "Some of the site's own code was blocked or unavailable. Your DNS ad blocking may be blocking it, or the site may be down.",
      network: true
    };
  }
  if (r.errors) return { title: TOO_NEW, reason: "Its scripts failed while starting, most likely because your TV's browser is too old for them." };
  if (allowWeak && document.querySelector('script[src]')) {
    return { title: 'This page still looks empty', reason: "It may need a newer browser than your TV's." };
  }
  return null;
}

// Calls show(result) at most once, if the page looks broken after loading.
export function checkWhenLoaded(show) {
  var done = false;
  function run(allowWeak) {
    if (done) return;
    var result = diagnose(allowWeak);
    if (!result) return;
    done = true;
    show(result);
  }
  function afterLoad() {
    setTimeout(function () { run(false); }, STRONG_DELAY_MS);
    setTimeout(function () { run(true); }, WEAK_DELAY_MS);
  }
  if (document.readyState === 'complete') afterLoad();
  else {
    window.addEventListener('load', afterLoad);
    setTimeout(function () { run(true); }, NO_LOAD_TIMEOUT_MS);
  }
}

export function engineVersion() {
  var match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return match ? match[1] : '?';
}

function details(r) {
  var parts = [];
  if (r.errors) parts.push(r.errors + (r.errors === 1 ? ' script error' : ' script errors'));
  if (r.moduleOnly) parts.push('module scripts only');
  if (r.missing.length) parts.push('missing: ' + r.missing.slice(0, 3).join(', '));
  if (r.blocked.length) parts.push("didn't load: " + r.blocked[0]);
  return parts.length ? 'Details: ' + parts.join(' · ') : '';
}

export function createCompatPanel(actions) {
  var modal = createModal('tizenshield-compat', true);

  function open(result, fixCount) {
    var card = modal.card;
    card.innerHTML = '';
    var explain = result.network
      ? 'Try pausing your DNS ad blocking for a moment, then reload.'
      : "Your TV's browser is Chrome " + engineVersion() + ", and older TVs can't update it. " +
        (fixCount ? 'TizenShield added ' + fixCount + ' missing features to this page, but ' : 'Missing features can be added to a page, but ') +
        'newer JavaScript itself can\'t be.';
    var goBack = modalButton('Go back', function () { modal.close(); actions.back(); });
    card.appendChild(el('div', { style: MODAL.heading, text: result.title }));
    card.appendChild(el('div', { style: MODAL.text, text: result.reason }));
    card.appendChild(el('div', { style: MODAL.muted, text: explain }));
    var info = details(compatReport());
    if (info) card.appendChild(el('div', { style: MODAL.muted, text: info }));
    card.appendChild(el('div', { style: MODAL.row }, [goBack, modalButton('Stay on this page', modal.close)]));
    modal.open(goBack);
  }

  return {
    root: modal.root,
    open: open,
    close: modal.close,
    isOpen: modal.isOpen
  };
}
