import { DEFAULT_BOOKMARKS } from './config.js';

// Bookmarks, history and settings live in the start page's localStorage.
// That origin (TizenBrew's module server) is shared with other TizenBrew app
// modules, hence the prefix.
var PREFIX = 'tizenshield:';
var MAX_BOOKMARKS = 48;
var MAX_HISTORY = 30;

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

export function getSettings() {
  return Object.assign({ engine: 'brave' }, read('settings', {}));
}

export function setSetting(name, value) {
  var settings = getSettings();
  settings[name] = value;
  return write('settings', settings);
}

// Per-site switch, stored in that site's own localStorage.
export function adHidingOff() {
  try {
    return window.localStorage.getItem(PREFIX + 'adhide-off') === '1';
  } catch (e) {
    return false;
  }
}

export function setAdHidingOff(off) {
  try {
    if (off) window.localStorage.setItem(PREFIX + 'adhide-off', '1');
    else window.localStorage.removeItem(PREFIX + 'adhide-off');
  } catch (e) {
    // Storage blocked on this site: the switch just won't stick.
  }
}
