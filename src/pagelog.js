import { hostOf } from './dom.js';

// Records what happens on the current page for the on-screen Page log:
// script errors, downloads that failed, the site's own data requests (failed,
// slow, or still waiting), console errors, and TizenShield's own events.
// Started the moment TizenBrew injects us; anything before that is missed,
// which the log says. Page stages (first response, content ready, loaded)
// come from the browser's navigation timing, so they're right even then.

var MAX_ENTRIES = 300;
var SLOW_REQUEST_MS = 5000;
var STILL_LOADING_MS = [30000, 60000];
// TizenShield's own check of the link to TizenBrew; not the site's request.
var OWN_PROBE = 'http://127.0.0.1:8081/';

var SYNTAX = /SyntaxError|Unexpected (token|identifier|string|number|reserved word|strict mode)|missing \) after|Invalid regular expression|Block-scoped declarations/i;
var MISSING = /(?:ReferenceError|TypeError):\s*(?:Can't find variable:\s*)?([\w$.]+) is not (?:defined|a function|a constructor)/;

var RESOURCE_NAMES = { SCRIPT: 'Script', LINK: 'Stylesheet', IMG: 'Image', VIDEO: 'Video', AUDIO: 'Audio', SOURCE: 'Media' };

var started = false;
var t0 = Date.now();
var entries = [];
var dropped = 0;
var pending = {};
var nextRequestId = 1;
var stats = { errors: 0, syntax: 0, missing: [], blockedOwn: [], failedDownloads: 0, failedRequests: 0, slowRequests: 0 };

export function classifyError(message) {
  var missing = MISSING.exec(message);
  return { syntax: SYNTAX.test(message), missing: missing ? missing[1] : null };
}

// "+12.3 s"
export function formatSeconds(ms) {
  return '+' + (Math.max(0, ms) / 1000).toFixed(1) + ' s';
}

// Address shortened for a TV-width row: host and path, no query string.
export function shortUrl(url, max) {
  var text = String(url || '').replace(/^[a-z]+:\/\//i, '').split(/[?#]/)[0];
  var limit = max || 90;
  return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
}

// "cdn.example.com:443" -> "example.com"; IP addresses are compared whole.
export function siteOf(host) {
  var name = String(host).split(':')[0];
  return /^\d+(\.\d+){3}$/.test(name) ? name : name.split('.').slice(-2).join('.');
}

function sameSite(host) {
  return siteOf(host) === siteOf(window.location.hostname);
}

function elapsed() {
  return Date.now() - t0;
}

// kind: 'error', 'failed', 'slow', 'info' or 'done'.
export function logEvent(kind, text, detail) {
  if (entries.length >= MAX_ENTRIES) {
    dropped++;
    return;
  }
  entries.push({ time: elapsed(), kind: kind, text: text, detail: detail || '' });
}

function absolute(url) {
  var link = document.createElement('a');
  link.href = url;
  return link.href;
}

function onError(event) {
  var target = event.target;
  if (target && target !== window) {
    var name = RESOURCE_NAMES[target.tagName];
    var url = target.src || target.href || '';
    if (!name || !url) return;
    var host = hostOf(url);
    var own = sameSite(host);
    stats.failedDownloads++;
    if (own && target.tagName === 'SCRIPT') stats.blockedOwn.push(host);
    logEvent('failed', name + " didn't load", shortUrl(url) + (own
      ? "  (the site's own)"
      : '  (another site: often an ad or tracker blocked by DNS)'));
    return;
  }
  var message = String(event.message || 'Unknown error');
  var kind = classifyError(message);
  stats.errors++;
  if (kind.syntax) stats.syntax++;
  if (kind.missing && stats.missing.indexOf(kind.missing) < 0) stats.missing.push(kind.missing);
  var where = event.filename ? shortUrl(event.filename, 70) + (event.lineno ? ':' + event.lineno : '') : '';
  var why = kind.syntax ? 'Code too new for this browser' : kind.missing ? 'Missing browser feature: ' + kind.missing : '';
  if (message === 'Script error.') where = 'from another site, which hides the details';
  logEvent('error', 'Script error: ' + message.replace(/^Uncaught /, ''), [why, where].filter(Boolean).join(' · '));
}

function requestStarted(kind, method, url) {
  var id = nextRequestId++;
  pending[id] = { kind: kind, method: (method || 'GET').toUpperCase(), url: url, start: elapsed() };
  return id;
}

function requestEnded(id, status, ok, aborted) {
  var request = pending[id];
  if (!request) return;
  delete pending[id];
  if (aborted) return;
  var took = elapsed() - request.start;
  var label = request.kind + ' ' + request.method;
  if (!ok) {
    stats.failedRequests++;
    logEvent('failed', label + ' failed' + (status ? ' (' + status + ')' : ': no response'), shortUrl(request.url));
  } else if (took > SLOW_REQUEST_MS) {
    stats.slowRequests++;
    logEvent('slow', label + ' took ' + (took / 1000).toFixed(1) + ' s', shortUrl(request.url));
  }
}

// Notes requests the site makes (XMLHttpRequest and fetch) without changing
// what they do, so stuck or failing ones show up in the log.
function watchRequests() {
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.__tsRequest = { method: method, url: String(url) };
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var xhr = this;
      var info = xhr.__tsRequest;
      if (info) {
        var id = requestStarted('Request', info.method, absolute(info.url));
        var aborted = false;
        xhr.addEventListener('abort', function () { aborted = true; });
        xhr.addEventListener('loadend', function () {
          requestEnded(id, xhr.status, xhr.status > 0 && xhr.status < 400, aborted);
        });
      }
      return send.apply(this, arguments);
    };
  }
  if (typeof window.fetch === 'function') {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url === OWN_PROBE) return nativeFetch.apply(this, arguments);
      var method = (init && init.method) || (input && input.method) || 'GET';
      var id = requestStarted('Fetch', method, absolute(url));
      return nativeFetch.apply(this, arguments).then(function (response) {
        requestEnded(id, response.status, response.ok || response.type === 'opaque', false);
        return response;
      }, function (error) {
        requestEnded(id, 0, false, !!error && error.name === 'AbortError');
        throw error;
      });
    };
  }
}

function describe(value) {
  if (value instanceof Error) return value.message;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function watchConsole() {
  var console = window.console;
  if (!console || typeof console.error !== 'function') return;
  var original = console.error;
  console.error = function () {
    try {
      logEvent('error', 'Console error', Array.prototype.map.call(arguments, describe).join(' ').slice(0, 300));
    } catch (e) {
      // Never let logging break the site.
    }
    return original.apply(this, arguments);
  };
}

export function startPageLog(fixes) {
  if (started) return;
  started = true;
  var timing = window.performance && window.performance.timing;
  if (timing && timing.navigationStart) t0 = timing.navigationStart;
  logEvent('info', 'TizenShield started', fixes.length
    ? fixes.length + ' TV fixes added; errors before this point aren\'t recorded'
    : "TV fixes off or none needed; errors before this point aren't recorded");
  window.addEventListener('error', onError, true);
  watchRequests();
  watchConsole();
  STILL_LOADING_MS.forEach(function (ms) {
    setTimeout(function () {
      if (document.readyState === 'complete') return;
      logEvent('slow', 'Page still loading after ' + ms / 1000 + ' s', waitingSummary());
    }, Math.max(0, ms - elapsed()));
  });
}

function waitingSummary() {
  var count = Object.keys(pending).length;
  return count ? count + (count === 1 ? ' request' : ' requests') + ' still waiting for a response' : '';
}

export function pageStats() {
  return {
    errors: stats.errors,
    syntax: stats.syntax,
    missing: stats.missing.slice(),
    blockedOwn: stats.blockedOwn.slice(),
    failedDownloads: stats.failedDownloads,
    failedRequests: stats.failedRequests,
    slowRequests: stats.slowRequests
  };
}

// Page stages from navigation timing, as log entries.
function stages() {
  var timing = window.performance && window.performance.timing;
  if (!timing || !timing.navigationStart) return [];
  var out = [];
  function stage(field, kind, text) {
    if (timing[field]) out.push({ time: timing[field] - timing.navigationStart, kind: kind, text: text, detail: '' });
  }
  stage('responseStart', 'info', 'First response from the site');
  stage('domContentLoadedEventStart', 'info', 'Page content ready');
  stage('loadEventEnd', 'done', 'Page fully loaded');
  return out;
}

function slowestDownloads(limit) {
  var perf = window.performance;
  if (!perf || typeof perf.getEntriesByType !== 'function') return [];
  return perf.getEntriesByType('resource').slice().sort(function (a, b) { return b.duration - a.duration; })
    .slice(0, limit).map(function (r) {
      return { duration: r.duration, type: r.initiatorType || 'other', url: r.name };
    });
}

// Everything the Page log shows, as of now.
export function pageLogSnapshot() {
  var now = elapsed();
  var timeline = entries.concat(stages()).sort(function (a, b) { return a.time - b.time; });
  var waiting = Object.keys(pending).map(function (id) {
    var r = pending[id];
    return { kind: r.kind, method: r.method, url: r.url, waited: now - r.start };
  }).sort(function (a, b) { return b.waited - a.waited; });
  var timing = window.performance && window.performance.timing;
  return {
    now: now,
    loadedAt: timing && timing.loadEventEnd ? timing.loadEventEnd - timing.navigationStart : null,
    timeline: timeline,
    dropped: dropped,
    waiting: waiting,
    slowest: slowestDownloads(8),
    stats: pageStats()
  };
}
