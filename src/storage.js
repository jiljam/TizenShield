import { DEFAULT_BOOKMARKS } from './config.js';

// Bookmarks, history and settings live in the start page's localStorage.
// That origin (TizenBrew's module server) is shared with other TizenBrew app
// modules, hence the prefix.
var PREFIX = 'tizenshield:';
var MAX_BOOKMARKS = 48;
var MAX_HISTORY = 30;
var MAX_POSITIONS = 40;

function read(key, fallback) {
  try {
    var raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function withoutUrl(list, url) {
  return list.filter(function (item) { return item.url !== url; });
}

export function getBookmarks() {
  return read('bookmarks', DEFAULT_BOOKMARKS.slice());
}

export function addBookmark(url, title) {
  var list = withoutUrl(getBookmarks(), url);
  list.unshift({ url: url, title: title || '' });
  return write('bookmarks', list.slice(0, MAX_BOOKMARKS));
}

export function removeBookmark(url) {
  return write('bookmarks', withoutUrl(getBookmarks(), url));
}

export function getHistory() {
  return read('history', []);
}

export function addHistory(url, title) {
  var list = withoutUrl(getHistory(), url);
  list.unshift({ url: url, title: title || '', time: Date.now() });
  return write('history', list.slice(0, MAX_HISTORY));
}

export function clearHistory() {
  return write('history', []);
}

// Where each video was stopped, so it can resume. 0 forgets the video.
export function getPosition(url) {
  var list = read('positions', []);
  for (var i = 0; i < list.length; i++) {
    if (list[i].url === url) return list[i].time;
  }
  return 0;
}

export function savePosition(url, seconds) {
  var list = withoutUrl(read('positions', []), url);
  if (seconds > 0) list.unshift({ url: url, time: Math.floor(seconds) });
  return write('positions', list.slice(0, MAX_POSITIONS));
}

export function getSettings() {
  return Object.assign({ engine: 'brave' }, read('settings', {}));
}

export function setSetting(name, value) {
  var settings = getSettings();
  settings[name] = value;
  return write('settings', settings);
}

// Per-site switches, stored in that site's own localStorage.
function siteFlag(name) {
  try {
    return window.localStorage.getItem(PREFIX + name) === '1';
  } catch (e) {
    return false;
  }
}

function setSiteFlag(name, on) {
  try {
    if (on) window.localStorage.setItem(PREFIX + name, '1');
    else window.localStorage.removeItem(PREFIX + name);
  } catch (e) {
    // Storage blocked on this site: the switch just won't stick.
  }
}

export function adHidingOff() {
  return siteFlag('adhide-off');
}

export function setAdHidingOff(off) {
  setSiteFlag('adhide-off', off);
}

export function polyfillsOff() {
  return siteFlag('polyfills-off');
}

export function setPolyfillsOff(off) {
  setSiteFlag('polyfills-off', off);
}
