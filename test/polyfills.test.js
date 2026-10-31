import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allSettled, any, arrayAt, entries, findLast, findLastIndex, flat, flatMap, fromEntries, getOwnPropertyDescriptors,
  hasOwn, padEnd, padStart, promiseFinally, reflect, replaceAll, stringAt, trimEnd, trimStart, values
} from '../src/polyfills/core.js';
import { define } from '../src/polyfills/define.js';
import { SearchParams, Controller, Signal } from '../src/polyfills/net.js';
import { intersect, parseMargin, thresholdIndex } from '../src/polyfills/observers.js';
import { keyName } from '../src/polyfills/dom.js';
import { classifyError, formatSeconds, shortUrl, siteOf } from '../src/pagelog.js';

// Each polyfill is checked against Node's native implementation.

test('define adds missing members only, non-enumerable, and reports them', function () {
  var target = { existing: 1 };
  var added = [];
  define(target, 'existing', 2, added);
  define(target, 'fresh', 3, added, 'Thing.fresh');
  assert.equal(target.existing, 1);
  assert.equal(target.fresh, 3);
  assert.deepEqual(Object.keys(target), ['existing']);
  assert.deepEqual(added, ['Thing.fresh']);
});

test('Object helpers match native', function () {
  var sym = Symbol('s');
  var obj = { a: 1, b: [2], [sym]: 3 };
  assert.deepEqual(entries(obj), Object.entries(obj));
  assert.deepEqual(values(obj), Object.values(obj));
  assert.deepEqual(fromEntries(new Map([['x', 1], ['y', 2]])), Object.fromEntries([['x', 1], ['y', 2]]));
  assert.deepEqual(getOwnPropertyDescriptors(obj), Object.getOwnPropertyDescriptors(obj));
  assert.equal(hasOwn(obj, 'a'), true);
  assert.equal(hasOwn(obj, 'toString'), false);
});

test('Array helpers match native', function () {
  var nested = [1, [2, [3, [4]]], , 5];
  [undefined, 0, 1, 2, Infinity].forEach(function (depth) {
    assert.deepEqual(flat.call(nested, depth), nested.flat(depth), 'depth ' + depth);
  });
  var double = function (x) { return [x, x * 2]; };
  assert.deepEqual(flatMap.call([1, 2], double), [1, 2].flatMap(double));
  [0, 2, -1, -3, 3, 1.7, NaN].forEach(function (i) {
    assert.equal(arrayAt.call(['a', 'b', 'c'], i), ['a', 'b', 'c'].at(i), 'at ' + i);
  });
  var even = function (x) { return x % 2 === 0; };
  assert.equal(findLast.call([1, 2, 3, 4, 5], even), 4);
  assert.equal(findLastIndex.call([1, 2, 3, 4, 5], even), 3);
  assert.equal(findLastIndex.call([1, 3], even), -1);
});

test('String helpers match native', function () {
  [['5', 3, '0'], ['abc', 10, '12345'], ['abc', 2, 'x'], ['abc', 6, '']].forEach(function (c) {
    assert.equal(padStart.call(c[0], c[1], c[2]), c[0].padStart(c[1], c[2]), 'padStart ' + c);
    assert.equal(padEnd.call(c[0], c[1], c[2]), c[0].padEnd(c[1], c[2]), 'padEnd ' + c);
  });
  assert.equal(padStart.call('7', 3), '7'.padStart(3));
  assert.equal(trimStart.call('  \n x '), '  \n x '.trimStart());
  assert.equal(trimEnd.call(' x \t﻿'), ' x \t﻿'.trimEnd());
  [0, -1, 5, -9].forEach(function (i) { assert.equal(stringAt.call('hello', i), 'hello'.at(i), 'at ' + i); });
  // Called the way a sloppy-mode polyfill sees it: on a String object.
  assert.equal(stringAt.call(new String('hey'), -1), 'y');
  [['a.b.c', '.', '-'], ['aaa', 'a', '$&$&'], ['x+y+z', '+', function (m) { return '[' + m + ']'; }], ['abc', '', '_']].forEach(function (c) {
    assert.equal(replaceAll.call(c[0], c[1], c[2]), c[0].replaceAll(c[1], c[2]), 'replaceAll ' + c[0]);
  });
  assert.equal(replaceAll.call('a1b2', /\d/g, '#'), 'a#b#');
  assert.throws(function () { replaceAll.call('a1', /\d/, '#'); }, TypeError);
});

test('Promise helpers behave like native', async function () {
  var calls = [];
  var value = await promiseFinally.call(Promise.resolve(1), function () { calls.push('ran'); });
  assert.equal(value, 1);
  await assert.rejects(promiseFinally.call(Promise.reject(new Error('x')), function () { calls.push('ran'); }), /x/);
  assert.deepEqual(calls, ['ran', 'ran']);

  var settled = [Promise.resolve(1), Promise.reject(new Error('no')), 3];
  var mine = await allSettled(settled);
  var native = await Promise.allSettled(settled);
  assert.deepEqual(mine.map(function (r) { return r.status; }), native.map(function (r) { return r.status; }));
  assert.equal(mine[2].value, 3);

  assert.equal(await any([Promise.reject(new Error('a')), Promise.resolve('b')]), 'b');
  await assert.rejects(any([Promise.reject(new Error('a'))]), function (error) {
    return error.name === 'AggregateError' && error.errors.length === 1;
  });
  await assert.rejects(any([]), { name: 'AggregateError' });
});

test('Reflect subset works and marks construct as a sham for Babel', function () {
  function Point(x) { this.x = x; }
  assert.equal(reflect.construct(Point, [3]).x, 3);
  assert.equal(reflect.apply(Math.max, null, [1, 5, 2]), 5);
  assert.deepEqual(reflect.ownKeys({ a: 1, [Symbol.for('k')]: 2 }), Reflect.ownKeys({ a: 1, [Symbol.for('k')]: 2 }));
  assert.equal(reflect.has({ a: 1 }, 'a'), true);
  assert.equal(reflect.defineProperty(Object.freeze({}), 'x', { value: 1 }), false);
  assert.equal(reflect.construct.sham, true);
});

test('URLSearchParams matches native serialization and methods', function () {
  ['a=1&b=2&a=3', '?q=hello+world&x=%26%3D', 'empty=&flag', 'k=%E2%9C%93', '', '&&a=1&&'].forEach(function (query) {
    assert.equal(new SearchParams(query).toString(), new URLSearchParams(query).toString(), query);
  });
  var init = { name: "Tom & Jerry's (show)", n: 5, sp: 'a b~*' };
  assert.equal(new SearchParams(init).toString(), new URLSearchParams(init).toString());
  assert.equal(new SearchParams([['x', '1'], ['y', '2']]).toString(), 'x=1&y=2');

  var mine = new SearchParams('b=2&a=1&b=3&c=4');
  var native = new URLSearchParams('b=2&a=1&b=3&c=4');
  [mine, native].forEach(function (p) {
    p.append('z', 'last');
    p.set('b', 'one');
    p.delete('c');
    p.sort();
  });
  assert.equal(mine.toString(), native.toString());
  assert.equal(mine.get('b'), 'one');
  assert.equal(mine.get('nope'), null);
  assert.deepEqual(mine.getAll('a'), ['1']);
  assert.equal(mine.has('z'), true);
  assert.deepEqual(Array.from(mine), Array.from(native));
  assert.deepEqual(Array.from(mine.keys()), Array.from(native.keys()));
  assert.equal(mine.size, native.size);
  var seen = [];
  mine.forEach(function (value, key) { seen.push(key + '=' + value); });
  assert.deepEqual(seen, ['a=1', 'b=one', 'z=last']);
});

test('AbortController fires listeners once and exposes the reason', function () {
  var controller = new Controller();
  var calls = [];
  controller.signal.onabort = function () { calls.push('onabort'); };
  controller.signal.addEventListener('abort', function () { calls.push('listener'); });
  assert.equal(controller.signal.aborted, false);
  controller.abort();
  controller.abort();
  assert.deepEqual(calls, ['onabort', 'listener']);
  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason.name, 'AbortError');
  assert.throws(function () { controller.signal.throwIfAborted(); }, { name: 'AbortError' });
  assert.equal(Signal.abort('why').reason, 'why');
});

test('IntersectionObserver geometry helpers', function () {
  var viewport = { top: 0, left: 0, bottom: 1080, right: 1920 };
  assert.equal(intersect({ top: 1100, left: 0, bottom: 1200, right: 100 }, viewport), null);
  var edge = intersect({ top: 1080, left: 0, bottom: 1180, right: 100 }, viewport);
  assert.equal(edge.height, 0, 'touching the edge counts as intersecting');
  assert.deepEqual(intersect({ top: 1000, left: -50, bottom: 1200, right: 50 }, viewport),
    { top: 1000, left: 0, bottom: 1080, right: 50, width: 50, height: 80, x: 0, y: 1000 });
  assert.deepEqual(parseMargin('10px 5%'), [
    { value: 10, percent: false }, { value: 5, percent: true }, { value: 10, percent: false }, { value: 5, percent: true }
  ]);
  assert.throws(function () { parseMargin('10em'); }, SyntaxError);
  assert.equal(thresholdIndex([0], 0), 1);
  assert.equal(thresholdIndex([0.25, 0.5, 1], 0.3), 1);
  assert.equal(thresholdIndex([0.25, 0.5, 1], 1), 3);
});

test('KeyboardEvent.key names remote and keyboard keys', function () {
  var cases = [
    [{ type: 'keydown', keyCode: 13 }, 'Enter'],
    [{ type: 'keydown', keyCode: 40 }, 'ArrowDown'],
    [{ type: 'keydown', keyCode: 10009 }, 'GoBack'],
    [{ type: 'keydown', keyCode: 10252 }, 'MediaPlayPause'],
    [{ type: 'keydown', keyCode: 404 }, 'ColorF1Green'],
    [{ type: 'keydown', keyCode: 65 }, 'a'],
    [{ type: 'keydown', keyCode: 65, shiftKey: true }, 'A'],
    [{ type: 'keydown', keyCode: 55 }, '7'],
    [{ type: 'keydown', keyCode: 116 }, 'F5'],
    [{ type: 'keypress', keyCode: 0, charCode: 63 }, '?'],
    [{ type: 'keydown', keyCode: 999 }, 'Unidentified']
  ];
  cases.forEach(function (c) { assert.equal(keyName(c[0]), c[1], JSON.stringify(c[0])); });
});

test('script errors are sorted into "too new to parse" and "missing feature"', function () {
  assert.deepEqual(classifyError('Uncaught SyntaxError: Unexpected token .'), { syntax: true, missing: null });
  assert.deepEqual(classifyError('Uncaught SyntaxError: Block-scoped declarations (let, const, function, class) not yet supported outside strict mode'), { syntax: true, missing: null });
  assert.deepEqual(classifyError('Uncaught ReferenceError: Proxy is not defined'), { syntax: false, missing: 'Proxy' });
  assert.deepEqual(classifyError('Uncaught TypeError: Object.entries is not a function'), { syntax: false, missing: 'Object.entries' });
  assert.deepEqual(classifyError('Script error.'), { syntax: false, missing: null });
});

test('page log formats times and shortens addresses for TV-width rows', function () {
  assert.equal(formatSeconds(0), '+0.0 s');
  assert.equal(formatSeconds(12345), '+12.3 s');
  assert.equal(formatSeconds(-5), '+0.0 s');
  assert.equal(shortUrl('https://cdn.example.com/app/main.js?v=3#x'), 'cdn.example.com/app/main.js');
  assert.equal(shortUrl('https://a.b/' + 'x'.repeat(200), 30), 'a.b/' + 'x'.repeat(23) + '...');
  assert.equal(shortUrl(undefined), '');
});

test('page log tells a site\'s own files from other sites\'', function () {
  assert.equal(siteOf('cdn.example.com:8443'), 'example.com');
  assert.equal(siteOf('www.example.com'), 'example.com');
  assert.equal(siteOf('127.0.0.1:37699'), '127.0.0.1');
  assert.notEqual(siteOf('10.0.0.1'), siteOf('192.168.0.1'));
});
