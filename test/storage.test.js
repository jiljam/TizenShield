import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BOOKMARKS } from '../src/config.js';
import {
  addBookmark, addHistory, clearHistory, getBookmarks, getHistory, getSettings, removeBookmark, setSetting
} from '../src/storage.js';

function fakeStorage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

beforeEach(function () {
  globalThis.window = { localStorage: fakeStorage() };
});

test('starts with the default bookmarks', function () {
  assert.deepEqual(getBookmarks(), DEFAULT_BOOKMARKS);
});

test('addBookmark puts new bookmarks first and de-duplicates by URL', function () {
  addBookmark('https://a.example/', 'A');
  addBookmark('https://b.example/', 'B');
  addBookmark('https://a.example/', 'A again');
  var list = getBookmarks();
  assert.deepEqual(list.slice(0, 2), [
    { url: 'https://a.example/', title: 'A again' },
    { url: 'https://b.example/', title: 'B' }
  ]);
  assert.equal(list.length, DEFAULT_BOOKMARKS.length + 2);
});

test('removing every bookmark leaves an empty list, not the defaults', function () {
  DEFAULT_BOOKMARKS.forEach(function (b) { removeBookmark(b.url); });
  assert.deepEqual(getBookmarks(), []);
});

test('history is newest first, de-duplicated and capped', function () {
  for (var i = 0; i < 40; i++) addHistory('https://site' + i + '.example/', '');
  addHistory('https://site5.example/', 'again');
  var list = getHistory();
  assert.equal(list.length, 30);
  assert.equal(list[0].url, 'https://site5.example/');
  assert.equal(list.filter(function (h) { return h.url === 'https://site5.example/'; }).length, 1);
  clearHistory();
  assert.deepEqual(getHistory(), []);
});

test('settings default to Brave Search and persist changes', function () {
  assert.equal(getSettings().engine, 'brave');
  setSetting('engine', 'ddg-lite');
  assert.equal(getSettings().engine, 'ddg-lite');
});

test('broken or blocked storage falls back instead of throwing', function () {
  globalThis.window = { localStorage: { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } } };
  assert.deepEqual(getBookmarks(), DEFAULT_BOOKMARKS);
  assert.equal(addHistory('https://x.example/', ''), false);
});
