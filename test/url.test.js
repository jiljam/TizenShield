import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hopUrl, isWebUrl, looksLikeUrl, parseHash, resolveInput } from '../src/url.js';

var ENGINE = { url: 'https://search.example/?q=' };

test('looksLikeUrl tells addresses from searches', function () {
  ['example.com', 'en.m.wikipedia.org/wiki/TV', 'https://x.y', 'localhost:8096', '192.168.1.20:8096/web'].forEach(function (text) {
    assert.equal(looksLikeUrl(text), true, text);
  });
  ['brave browser', 'weather', 'what is example.com', 'file.txt is'].forEach(function (text) {
    assert.equal(looksLikeUrl(text), false, text);
  });
});

test('resolveInput adds https:// to domains and http:// to home-network hosts', function () {
  assert.equal(resolveInput('example.com', ENGINE), 'https://example.com');
  assert.equal(resolveInput('  http://example.com/a  ', ENGINE), 'http://example.com/a');
  assert.equal(resolveInput('192.168.1.20:8096', ENGINE), 'http://192.168.1.20:8096');
  assert.equal(resolveInput('localhost:3000/x', ENGINE), 'http://localhost:3000/x');
});

test('resolveInput searches everything else', function () {
  assert.equal(resolveInput('tizen tv apps', ENGINE), 'https://search.example/?q=tizen%20tv%20apps');
  assert.equal(resolveInput('c++ & rust', ENGINE), 'https://search.example/?q=c%2B%2B%20%26%20rust');
});

test('resolveInput refuses blanks and non-web schemes', function () {
  assert.equal(resolveInput('   ', ENGINE), null);
  assert.equal(resolveInput('file:///etc/passwd', ENGINE), null);
  assert.equal(resolveInput('ftp://example.com', ENGINE), null);
  // No "://", so it is searched for rather than run.
  assert.equal(resolveInput('javascript:alert(1)', ENGINE), 'https://search.example/?q=javascript%3Aalert(1)');
});

test('isWebUrl only accepts http and https', function () {
  assert.equal(isWebUrl('https://a.b'), true);
  assert.equal(isWebUrl('HTTP://a.b'), true);
  assert.equal(isWebUrl('javascript:alert(1)'), false);
  assert.equal(isWebUrl('data:text/html,hi'), false);
});

test('hopUrl and parseHash round-trip awkward values', function () {
  var params = { add: 'https://a.b/c?d=1&e=2#f', title: 'Tom & Jerry = 100%' };
  var url = hopUrl('http://127.0.0.1:8081/start.html#old', params);
  assert.equal(url.indexOf('http://127.0.0.1:8081/start.html#add='), 0);
  assert.deepEqual(parseHash(url.slice(url.indexOf('#'))), params);
});

test('parseHash skips malformed pairs', function () {
  assert.deepEqual(parseHash('#a=1&b=%E0%A4%A&c'), { a: '1', c: '' });
  assert.deepEqual(parseHash(''), {});
});
