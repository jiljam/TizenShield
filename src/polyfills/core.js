import { define } from './define.js';

// JavaScript built-ins newer than Chrome 47. The implementations are exported
// so unit tests can compare them with Node's native versions.

function toInteger(n) {
  var number = Number(n);
  if (number !== number) return 0;
  return number < 0 ? Math.ceil(number) : Math.floor(number);
}

export function entries(obj) {
  return Object.keys(obj).map(function (key) { return [key, obj[key]]; });
}

export function values(obj) {
  return Object.keys(obj).map(function (key) { return obj[key]; });
}

export function fromEntries(iterable) {
  var out = {};
  Array.from(iterable).forEach(function (pair) { out[pair[0]] = pair[1]; });
  return out;
}

export function getOwnPropertyDescriptors(obj) {
  var out = {};
  var keys = Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
  keys.forEach(function (key) { out[key] = Object.getOwnPropertyDescriptor(obj, key); });
  return out;
}

export function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(Object(obj), key);
}

export function flat(depth) {
  var level = depth === undefined ? 1 : toInteger(depth);
  var out = [];
  (function walk(list, remaining) {
    for (var i = 0; i < list.length; i++) {
      if (!(i in list)) continue;
      if (Array.isArray(list[i]) && remaining > 0) walk(list[i], remaining - 1);
      else out.push(list[i]);
    }
  })(this, level);
  return out;
}

export function flatMap(fn, thisArg) {
  return flat.call(Array.prototype.map.call(this, fn, thisArg), 1);
}

function relativeIndex(index, length) {
  var i = toInteger(index);
  if (i < 0) i += length;
  return i < 0 || i >= length ? -1 : i;
}

export function arrayAt(index) {
  var i = relativeIndex(index, this.length);
  return i < 0 ? undefined : this[i];
}

export function stringAt(index) {
  var string = String(this);
  var i = relativeIndex(index, string.length);
  return i < 0 ? undefined : string.charAt(i);
}

export function findLast(fn, thisArg) {
  for (var i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
}

export function findLastIndex(fn, thisArg) {
  for (var i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return i;
  return -1;
}

function pad(string, targetLength, padString, atStart) {
  var target = toInteger(targetLength);
  var filler = padString === undefined ? ' ' : String(padString);
  if (target <= string.length || !filler) return string;
  var needed = target - string.length;
  while (filler.length < needed) filler += filler;
  filler = filler.slice(0, needed);
  return atStart ? filler + string : string + filler;
}

export function padStart(targetLength, padString) {
  return pad(String(this), targetLength, padString, true);
}

export function padEnd(targetLength, padString) {
  return pad(String(this), targetLength, padString, false);
}

export function trimStart() {
  return String(this).replace(/^[\s﻿\xA0]+/, '');
}

export function trimEnd() {
  return String(this).replace(/[\s﻿\xA0]+$/, '');
}

export function replaceAll(search, replacement) {
  if (search instanceof RegExp) {
    if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp');
    return String(this).replace(search, replacement);
  }
  var escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(this).replace(new RegExp(escaped, 'g'), replacement);
}

export function promiseFinally(fn) {
  var P = this.constructor || Promise;
  if (typeof fn !== 'function') return this.then(fn, fn);
  return this.then(
    function (value) { return P.resolve(fn()).then(function () { return value; }); },
    function (reason) { return P.resolve(fn()).then(function () { throw reason; }); }
  );
}

export function allSettled(iterable) {
  return Promise.all(Array.from(iterable).map(function (item) {
    return Promise.resolve(item).then(
      function (value) { return { status: 'fulfilled', value: value }; },
      function (reason) { return { status: 'rejected', reason: reason }; }
    );
  }));
}

function aggregateError(errors) {
  var error = new Error('All promises were rejected');
  error.name = 'AggregateError';
  error.errors = errors;
  return error;
}

export function any(iterable) {
  return new Promise(function (resolve, reject) {
    var items = Array.from(iterable);
    var errors = [];
    var left = items.length;
    if (!left) reject(aggregateError(errors));
    items.forEach(function (item, i) {
      Promise.resolve(item).then(resolve, function (reason) {
        errors[i] = reason;
        if (--left === 0) reject(aggregateError(errors));
      });
    });
  });
}

// Enough of Reflect for libraries and Babel output. construct() can't honour
// new.target, so it's marked as a sham: Babel's class helpers check for that.
export var reflect = {
  apply: function (target, thisArg, args) { return Function.prototype.apply.call(target, thisArg, args); },
  construct: function (Target, args) {
    var Bound = Function.prototype.bind.apply(Target, [null].concat(Array.prototype.slice.call(args)));
    return new Bound();
  },
  defineProperty: function (obj, key, descriptor) {
    try {
      Object.defineProperty(obj, key, descriptor);
      return true;
    } catch (e) {
      return false;
    }
  },
  deleteProperty: function (obj, key) { return delete obj[key]; },
  get: function (obj, key) { return obj[key]; },
  getOwnPropertyDescriptor: function (obj, key) { return Object.getOwnPropertyDescriptor(obj, key); },
  getPrototypeOf: function (obj) { return Object.getPrototypeOf(obj); },
  has: function (obj, key) { return key in obj; },
  isExtensible: function (obj) { return Object.isExtensible(obj); },
  ownKeys: function (obj) { return Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj)); },
  preventExtensions: function (obj) {
    Object.preventExtensions(obj);
    return true;
  },
  set: function (obj, key, value) {
    obj[key] = value;
    return true;
  },
  setPrototypeOf: function (obj, proto) {
    Object.setPrototypeOf(obj, proto);
    return true;
  }
};
reflect.construct.sham = true;

export function randomUUID() {
  var bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var hex = Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

export function installCore(win, added) {
  var O = win.Object;
  var AP = win.Array.prototype;
  var SP = win.String.prototype;
  define(O, 'entries', entries, added, 'Object.entries');
  define(O, 'values', values, added, 'Object.values');
  define(O, 'fromEntries', fromEntries, added, 'Object.fromEntries');
  define(O, 'getOwnPropertyDescriptors', getOwnPropertyDescriptors, added, 'Object.getOwnPropertyDescriptors');
  define(O, 'hasOwn', hasOwn, added, 'Object.hasOwn');
  define(AP, 'flat', flat, added, 'Array.flat');
  define(AP, 'flatMap', flatMap, added, 'Array.flatMap');
  define(AP, 'at', arrayAt, added, 'Array.at');
  define(AP, 'findLast', findLast, added, 'Array.findLast');
  define(AP, 'findLastIndex', findLastIndex, added, 'Array.findLastIndex');
  define(AP, 'values', AP[win.Symbol.iterator], added, 'Array.values');
  define(SP, 'at', stringAt, added, 'String.at');
  define(SP, 'padStart', padStart, added, 'String.padStart');
  define(SP, 'padEnd', padEnd, added, 'String.padEnd');
  define(SP, 'trimStart', trimStart, added, 'String.trimStart');
  define(SP, 'trimEnd', trimEnd, added, 'String.trimEnd');
  define(SP, 'replaceAll', replaceAll, added, 'String.replaceAll');
  define(win.Promise.prototype, 'finally', promiseFinally, added, 'Promise.finally');
  define(win.Promise, 'allSettled', allSettled, added, 'Promise.allSettled');
  define(win.Promise, 'any', any, added, 'Promise.any');
  define(win, 'globalThis', win, added);
  define(win, 'Reflect', reflect, added);
  define(win, 'queueMicrotask', function (fn) {
    win.Promise.resolve().then(fn).catch(function (error) {
      setTimeout(function () { throw error; });
    });
  }, added);
  if (win.crypto && win.crypto.getRandomValues) define(win.crypto, 'randomUUID', randomUUID, added, 'crypto.randomUUID');
}
