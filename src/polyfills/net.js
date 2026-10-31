import { define, defineGetter } from './define.js';

// URLSearchParams (Chrome 49), URL.searchParams (51), AbortController (66).

function decode(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch (e) {
    return text;
  }
}

// application/x-www-form-urlencoded: space as +, and !'()~ escaped too.
function encode(text) {
  return encodeURIComponent(text).replace(/%20/g, '+').replace(/[!'()~]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

export function SearchParams(init) {
  this._list = [];
  this._onChange = null;
  if (init === undefined || init === null) return;
  if (init instanceof SearchParams) {
    this._list = init._list.slice();
  } else if (typeof init === 'object') {
    var pairs = typeof init.length === 'number' || typeof init[Symbol.iterator] === 'function'
      ? Array.from(init)
      : Object.keys(init).map(function (key) { return [key, init[key]]; });
    this._list = pairs.map(function (pair) { return [String(pair[0]), String(pair[1])]; });
  } else {
    this._parse(String(init));
  }
}

SearchParams.prototype = {
  constructor: SearchParams,
  _parse: function (query) {
    this._list = query.replace(/^\?/, '').split('&').filter(Boolean).map(function (part) {
      var eq = part.indexOf('=');
      return eq < 0 ? [decode(part), ''] : [decode(part.slice(0, eq)), decode(part.slice(eq + 1))];
    });
  },
  _changed: function () {
    if (this._onChange) this._onChange(this.toString());
  },
  append: function (name, value) {
    this._list.push([String(name), String(value)]);
    this._changed();
  },
  'delete': function (name) {
    name = String(name);
    this._list = this._list.filter(function (pair) { return pair[0] !== name; });
    this._changed();
  },
  get: function (name) {
    name = String(name);
    for (var i = 0; i < this._list.length; i++) if (this._list[i][0] === name) return this._list[i][1];
    return null;
  },
  getAll: function (name) {
    name = String(name);
    return this._list.filter(function (pair) { return pair[0] === name; }).map(function (pair) { return pair[1]; });
  },
  has: function (name) {
    return this.get(name) !== null;
  },
  set: function (name, value) {
    name = String(name);
    var found = false;
    this._list = this._list.filter(function (pair) {
      if (pair[0] !== name) return true;
      if (found) return false;
      found = true;
      pair[1] = String(value);
      return true;
    });
    if (!found) this._list.push([name, String(value)]);
    this._changed();
  },
  sort: function () {
    // Stable by name: keep original order for equal names.
    this._list = this._list.map(function (pair, i) { return [pair, i]; }).sort(function (a, b) {
      if (a[0][0] < b[0][0]) return -1;
      if (a[0][0] > b[0][0]) return 1;
      return a[1] - b[1];
    }).map(function (item) { return item[0]; });
    this._changed();
  },
  forEach: function (fn, thisArg) {
    var self = this;
    this._list.slice().forEach(function (pair) { fn.call(thisArg, pair[1], pair[0], self); });
  },
  keys: function () {
    return this._list.map(function (pair) { return pair[0]; })[Symbol.iterator]();
  },
  values: function () {
    return this._list.map(function (pair) { return pair[1]; })[Symbol.iterator]();
  },
  entries: function () {
    return this._list.map(function (pair) { return [pair[0], pair[1]]; })[Symbol.iterator]();
  },
  toString: function () {
    return this._list.map(function (pair) { return encode(pair[0]) + '=' + encode(pair[1]); }).join('&');
  }
};
SearchParams.prototype[Symbol.iterator] = SearchParams.prototype.entries;
Object.defineProperty(SearchParams.prototype, 'size', { get: function () { return this._list.length; } });

function abortError() {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch (e) {
    var error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
}

export function Signal() {
  this.aborted = false;
  this.reason = undefined;
  this.onabort = null;
  this._listeners = [];
}

Signal.prototype = {
  constructor: Signal,
  addEventListener: function (type, listener) {
    if (type === 'abort' && listener && this._listeners.indexOf(listener) < 0) this._listeners.push(listener);
  },
  removeEventListener: function (type, listener) {
    var i = this._listeners.indexOf(listener);
    if (type === 'abort' && i >= 0) this._listeners.splice(i, 1);
  },
  dispatchEvent: function (event) {
    var self = this;
    if (event.type !== 'abort') return true;
    if (typeof this.onabort === 'function') this.onabort.call(this, event);
    this._listeners.slice().forEach(function (listener) {
      if (typeof listener === 'function') listener.call(self, event);
      else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(event);
    });
    return true;
  },
  throwIfAborted: function () {
    if (this.aborted) throw this.reason;
  }
};

export function Controller() {
  this.signal = new Signal();
}

Controller.prototype.abort = function (reason) {
  var signal = this.signal;
  if (signal.aborted) return;
  signal.aborted = true;
  signal.reason = reason === undefined ? abortError() : reason;
  signal.dispatchEvent({ type: 'abort', target: signal });
};

Signal.abort = function (reason) {
  var controller = new Controller();
  controller.abort(reason);
  return controller.signal;
};

Signal.timeout = function (ms) {
  var controller = new Controller();
  setTimeout(function () {
    var error = abortError();
    error.name = 'TimeoutError';
    controller.abort(error);
  }, ms);
  return controller.signal;
};

// Native fetch() here can't be cancelled, but callers still get the
// rejection they expect when the signal fires.
function wrapFetch(win) {
  var nativeFetch = win.fetch;
  win.fetch = function (input, init) {
    var signal = init && init.signal;
    if (!(signal instanceof Signal)) return nativeFetch.apply(this, arguments);
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise(function (resolve, reject) {
      function onAbort() { reject(signal.reason); }
      signal.addEventListener('abort', onAbort);
      nativeFetch.call(win, input, init).then(function (response) {
        signal.removeEventListener('abort', onAbort);
        resolve(response);
      }, function (error) {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
    });
  };
}

export function installNet(win, added) {
  define(win, 'URLSearchParams', SearchParams, added);
  if (win.URL && win.URL.prototype) {
    defineGetter(win.URL.prototype, 'searchParams', function () {
      var url = this;
      var params = new win.URLSearchParams(url.search);
      if (params instanceof SearchParams) {
        params._onChange = function (query) { url.search = query ? '?' + query : ''; };
      }
      return params;
    }, added, 'URL.searchParams');
  }
  if (!('AbortController' in win)) {
    define(win, 'AbortController', Controller, added);
    define(win, 'AbortSignal', Signal, added);
    if (typeof win.fetch === 'function') wrapFetch(win);
  }
}
