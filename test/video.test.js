import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, formatTime, isVideoUrl, titleFromUrl, videoKind } from '../src/video.js';
import { getPosition, savePosition } from '../src/storage.js';

test('isVideoUrl matches video files by path, ignoring query and fragment', function () {
  ['https://a.b/movie.mkv', 'http://192.168.1.5/x/Clip.MP4', 'https://a.b/v.webm?token=1', 'https://cdn.b/live/index.m3u8#t'].forEach(function (url) {
    assert.equal(isVideoUrl(url), true, url);
  });
  ['https://a.b/watch?v=mp4', 'https://a.b/movie.mkv.html', 'https://a.b/', 'blob:https://a.b/123', 'file:///v.mp4', 'https://a.b/page?file=x.mp4'].forEach(function (url) {
    assert.equal(isVideoUrl(url), false, url);
  });
});

test('videoKind labels formats for the badge', function () {
  assert.equal(videoKind('https://a.b/x.mkv'), 'MKV');
  assert.equal(videoKind('https://a.b/x.m3u8?a=1'), 'HLS');
  assert.equal(videoKind('https://a.b/stream'), 'VIDEO');
});

test('titleFromUrl turns file names into readable titles', function () {
  assert.equal(titleFromUrl('https://a.b/films/Big_Buck.Bunny%20(2008).mkv?dl=1'), 'Big Buck Bunny (2008)');
  assert.equal(titleFromUrl('https://media.example.org/'), 'media.example.org');
  assert.equal(titleFromUrl('https://a.b/%E0%A4%A.mp4'), '%E0%A4%A');
});

test('cleanText collapses whitespace and shortens long labels', function () {
  assert.equal(cleanText('  Watch\n   the   trailer '), 'Watch the trailer');
  assert.equal(cleanText('x'.repeat(100), 10), 'xxxxxxx...');
  assert.equal(cleanText(null), '');
});

test('formatTime shows m:ss, h:mm:ss, and placeholders for unknown times', function () {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75.9), '1:15');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(Infinity), '--:--');
  assert.equal(formatTime(NaN), '--:--');
});

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

test('resume positions are saved per video, capped, and cleared with 0', function () {
  assert.equal(getPosition('https://a.b/1.mp4'), 0);
  savePosition('https://a.b/1.mp4', 125.7);
  assert.equal(getPosition('https://a.b/1.mp4'), 125);
  savePosition('https://a.b/1.mp4', 0);
  assert.equal(getPosition('https://a.b/1.mp4'), 0);
  for (var i = 0; i < 45; i++) savePosition('https://a.b/' + i + '.mp4', 60 + i);
  assert.equal(getPosition('https://a.b/44.mp4'), 104);
  assert.equal(getPosition('https://a.b/0.mp4'), 0, 'oldest entries drop off after 40');
});
