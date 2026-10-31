/* TizenShield 0.2.0 */
(function () {
  // src/filters.js
  var GENERIC = ["ins.adsbygoogle", ".adsbygoogle", '[id^="google_ads_iframe"]', '[id^="div-gpt-ad"]', '[id^="gpt-ad-"]', "[data-google-query-id]", 'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]', 'iframe[src*="amazon-adsystem.com"]', 'a[href*="doubleclick.net/"]', 'a[href*="googleadservices.com/"]', "amp-ad", 'amp-embed[type="taboola"]', "amp-sticky-ad", "[data-ad-slot]", "[data-ad-unit]", "[data-adunit]", "[data-ad-placement]", '[aria-label="Advertisement"]', '[aria-label="Sponsored"]', ".ad-slot", ".ad-container", ".ad-wrapper", ".ad-banner", ".ad-unit", ".ad-placeholder", ".ad-leaderboard", ".leaderboard-ad", ".sidebar-ad", ".sticky-ad", ".adBanner", ".adContainer", ".advertisement", ".trc_related_container", '[id^="taboola-"]', ".OUTBRAIN", ".ob-widget", '[id^="outbrain_widget"]', '[id^="mgid_"]', ".zergnet-widget"];
  var SITE = {};

  // src/dom.js
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (name) {
        var value = props[name];
        if (name === "text") node.textContent = value;else if (name === "style") node.style.cssText = value;else if (name.indexOf("on") === 0) node.addEventListener(name.slice(2), value);else node.setAttribute(name, value);
      });
    }
    (children || []).forEach(function (child) {
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }
  function toArray(list) {
    return Array.prototype.slice.call(list);
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);else fn();
  }
  function focusStyle(node, base, focused) {
    node.style.cssText = base;
    node.addEventListener("focus", function () {
      node.style.cssText = base + focused;
    });
    node.addEventListener("blur", function () {
      node.style.cssText = base;
    });
    return node;
  }
  function hostOf(url) {
    var match = /^[a-z]+:\/\/([^\/?#]+)/i.exec(url);
    return match ? match[1].replace(/^www\./, "") : url;
  }

  // src/adhide.js
  var STYLE_ID = "tizenshield-adhide";
  var PROBE_ID = "tizenshield-probe";
  var SWEEP_DELAY = 250;
  function selectorsFor(host) {
    var list = GENERIC.slice();
    Object.keys(SITE).forEach(function (domain) {
      var suffix = "." + domain;
      if (host === domain || host.slice(-suffix.length) === suffix) list = list.concat(SITE[domain]);
    });
    return list.filter(function (selector) {
      try {
        document.querySelector(selector);
        return true;
      } catch (e) {
        return false;
      }
    });
  }
  function startAdHiding(host) {
    var selectors = selectorsFor(host);
    if (!selectors.length || document.getElementById(STYLE_ID)) return;
    var root = document.head || document.documentElement;
    var style = el("style", {
      id: STYLE_ID
    });
    style.textContent = selectors.join(",\n") + ",#" + PROBE_ID + "{display:none!important}";
    root.appendChild(style);
    var probe = el("div", {
      id: PROBE_ID
    });
    document.documentElement.appendChild(probe);
    var applied = window.getComputedStyle(probe).display === "none";
    document.documentElement.removeChild(probe);
    if (!applied) hideWithScript(selectors.join(","));
  }
  function hideWithScript(selector) {
    var pending = false;
    function sweep() {
      pending = false;
      toArray(document.querySelectorAll(selector)).forEach(function (node) {
        node.style.setProperty("display", "none", "important");
      });
    }
    sweep();
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(sweep, SWEEP_DELAY);
    }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // src/config.js
  var START_URL = true ? "http://127.0.0.1:8081/module/gh%2Fjiljam%2FTizenShield/dist/start.html" : "";
  var VERSION = true ? "0.2.0" : "dev";
  var ACCENT = "#fb542b";
  var SEARCH_ENGINES = [{
    id: "brave",
    name: "Brave Search",
    url: "https://search.brave.com/search?q="
  },
  // Server-rendered and script-free, so it works on 2017 TV engines where
  // Brave Search's own pages may not.
  {
    id: "ddg-lite",
    name: "DuckDuckGo Lite",
    url: "https://lite.duckduckgo.com/lite/?q="
  }];
  var DEFAULT_BOOKMARKS = [{
    url: "https://search.brave.com/",
    title: "Brave Search"
  }, {
    url: "https://lite.duckduckgo.com/lite/",
    title: "DuckDuckGo Lite"
  }, {
    url: "https://en.m.wikipedia.org/",
    title: "Wikipedia"
  }];
  function engineById(id) {
    for (var i = 0; i < SEARCH_ENGINES.length; i++) {
      if (SEARCH_ENGINES[i].id === id) return SEARCH_ENGINES[i];
    }
    return SEARCH_ENGINES[0];
  }

  // src/keys.js
  var KEY = {
    ENTER: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    BACK: 10009,
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    PLAY: 415,
    PAUSE: 19,
    PLAY_PAUSE: 10252,
    STOP: 413,
    FAST_FORWARD: 417,
    REWIND: 412,
    IME_DONE: 65376,
    IME_CANCEL: 65385
  };
  var DESKTOP = {
    27: KEY.BACK,
    112: KEY.RED,
    113: KEY.GREEN,
    114: KEY.YELLOW,
    115: KEY.BLUE,
    179: KEY.PLAY_PAUSE,
    178: KEY.STOP
  };
  var DIRECTION = {};
  DIRECTION[KEY.LEFT] = "left";
  DIRECTION[KEY.UP] = "up";
  DIRECTION[KEY.RIGHT] = "right";
  DIRECTION[KEY.DOWN] = "down";
  function keyOf(event) {
    var code = event.keyCode || event.which;
    return DESKTOP[code] || code;
  }
  function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }
  var TEXT_TYPES = /^(text|search|url|email|password|tel|number)$/i;
  function isEditing(node) {
    if (!node) return false;
    if (node.isContentEditable) return true;
    var tag = node.tagName;
    if (tag === "TEXTAREA") return !node.readOnly;
    if (tag === "INPUT") return TEXT_TYPES.test(node.type || "text") && !node.readOnly;
    return false;
  }

  // src/spatialnav.js
  var FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex],[contenteditable="true"]';
  var EDGE_MARGIN = 80;
  var SCROLL_FRACTION = 0.6;
  function viewport() {
    return {
      top: 0,
      left: 0,
      bottom: window.innerHeight,
      right: window.innerWidth
    };
  }
  function onScreen(r, vp) {
    return r.bottom > vp.top && r.top < vp.bottom && r.right > vp.left && r.left < vp.right;
  }
  function isShown(node) {
    var style = window.getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none";
  }
  function edgeRect(dir, vp) {
    if (dir === "down") return {
      top: vp.top,
      bottom: vp.top,
      left: vp.left,
      right: vp.right
    };
    if (dir === "up") return {
      top: vp.bottom,
      bottom: vp.bottom,
      left: vp.left,
      right: vp.right
    };
    if (dir === "right") return {
      top: vp.top,
      bottom: vp.bottom,
      left: vp.left,
      right: vp.left
    };
    return {
      top: vp.top,
      bottom: vp.bottom,
      left: vp.right,
      right: vp.right
    };
  }
  function gap(a1, a2, b1, b2) {
    return Math.max(0, b1 - a2, a1 - b2);
  }
  function measure(from, r, dir) {
    var along, across;
    var fromMidY = (from.top + from.bottom) / 2;
    var fromMidX = (from.left + from.right) / 2;
    if (dir === "down" || dir === "up") {
      var midY = (r.top + r.bottom) / 2;
      if (dir === "down" ? midY <= fromMidY || r.bottom <= from.bottom : midY >= fromMidY || r.top >= from.top) return null;
      along = dir === "down" ? Math.max(0, r.top - from.bottom) : Math.max(0, from.top - r.bottom);
      across = gap(from.left, from.right, r.left, r.right);
    } else {
      var midX = (r.left + r.right) / 2;
      if (dir === "right" ? midX <= fromMidX || r.right <= from.right : midX >= fromMidX || r.left >= from.left) return null;
      along = dir === "right" ? Math.max(0, r.left - from.right) : Math.max(0, from.left - r.right);
      across = gap(from.top, from.bottom, r.top, r.bottom);
    }
    return {
      along: along,
      score: along + across * 3
    };
  }
  function focusables(scope, exclude) {
    return toArray(scope.querySelectorAll(FOCUSABLE)).filter(function (node) {
      if (node.disabled || node.getAttribute("tabindex") === "-1") return false;
      return !(exclude && exclude.contains(node));
    });
  }
  function reveal(node) {
    var r = node.getBoundingClientRect();
    var height = window.innerHeight;
    if (r.height > height - 2 * EDGE_MARGIN) return;
    if (r.top < EDGE_MARGIN) window.scrollBy(0, r.top - EDGE_MARGIN);else if (r.bottom > height - EDGE_MARGIN) window.scrollBy(0, r.bottom - height + EDGE_MARGIN);
  }
  function scrollPage(dir, vp) {
    var dy = Math.round(vp.bottom * SCROLL_FRACTION);
    var dx = Math.round(vp.right * SCROLL_FRACTION);
    if (dir === "down") window.scrollBy(0, dy);else if (dir === "up") window.scrollBy(0, -dy);else if (dir === "right") window.scrollBy(dx, 0);else window.scrollBy(-dx, 0);
  }
  function move(dir, options) {
    var vp = viewport();
    var candidates = focusables(options.scope, options.exclude);
    var current = document.activeElement;
    var from = null;
    if (current && candidates.indexOf(current) >= 0) {
      var rect = current.getBoundingClientRect();
      if (onScreen(rect, vp)) from = rect;
    }
    if (!from) {
      current = null;
      from = edgeRect(dir, vp);
    }
    var best = null;
    var bestScore = Infinity;
    var bestAlong = 0;
    candidates.forEach(function (node) {
      if (node === current) return;
      var r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var m = measure(from, r, dir);
      if (!m || m.score >= bestScore || !isShown(node)) return;
      best = node;
      bestScore = m.score;
      bestAlong = m.along;
    });
    var reach = dir === "up" || dir === "down" ? vp.bottom * 0.75 : vp.right;
    if (best && (!options.scroll || bestAlong <= reach)) {
      best.focus();
      reveal(best);
      return true;
    }
    if (options.scroll) {
      scrollPage(dir, vp);
      return true;
    }
    return false;
  }

  // src/storage.js
  var PREFIX = "tizenshield:";
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
    return list.filter(function (item) {
      return item.url !== url;
    });
  }
  function getBookmarks() {
    return read("bookmarks", DEFAULT_BOOKMARKS.slice());
  }
  function addBookmark(url, title) {
    var list = withoutUrl(getBookmarks(), url);
    list.unshift({
      url: url,
      title: title || ""
    });
    return write("bookmarks", list.slice(0, MAX_BOOKMARKS));
  }
  function removeBookmark(url) {
    return write("bookmarks", withoutUrl(getBookmarks(), url));
  }
  function getHistory() {
    return read("history", []);
  }
  function addHistory(url, title) {
    var list = withoutUrl(getHistory(), url);
    list.unshift({
      url: url,
      title: title || "",
      time: Date.now()
    });
    return write("history", list.slice(0, MAX_HISTORY));
  }
  function clearHistory() {
    return write("history", []);
  }
  function getPosition(url) {
    var list = read("positions", []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].url === url) return list[i].time;
    }
    return 0;
  }
  function savePosition(url, seconds) {
    var list = withoutUrl(read("positions", []), url);
    if (seconds > 0) list.unshift({
      url: url,
      time: Math.floor(seconds)
    });
    return write("positions", list.slice(0, MAX_POSITIONS));
  }
  function getSettings() {
    return Object.assign({
      engine: "brave"
    }, read("settings", {}));
  }
  function setSetting(name, value) {
    var settings = getSettings();
    settings[name] = value;
    return write("settings", settings);
  }
  function adHidingOff() {
    try {
      return window.localStorage.getItem(PREFIX + "adhide-off") === "1";
    } catch (e) {
      return false;
    }
  }
  function setAdHidingOff(off) {
    try {
      if (off) window.localStorage.setItem(PREFIX + "adhide-off", "1");else window.localStorage.removeItem(PREFIX + "adhide-off");
    } catch (e) {}
  }

  // src/ui.js
  var RESET = "all:initial;box-sizing:border-box;font-family:sans-serif;";
  var Z_TOP = 2147483647;
  var STYLE = {
    reset: RESET,
    toast: RESET + "position:fixed;left:15%;right:15%;bottom:64px;z-index:" + Z_TOP + ";display:none;padding:20px 36px;text-align:center;font-size:30px;line-height:1.3;color:#f2f2f5;background:rgba(18,19,24,0.95);border:3px solid " + ACCENT + ";border-radius:12px;",
    input: RESET + "display:block;width:100%;height:72px;padding:0 24px;font-size:30px;color:#111;background:#fff;border:4px solid #555;border-radius:10px;",
    inputFocus: "border-color:" + ACCENT + ";",
    button: RESET + "display:inline-block;margin:0 14px 0 0;padding:14px 26px;font-size:26px;color:#f2f2f5;background:#2b2d36;border:4px solid #2b2d36;border-radius:10px;cursor:pointer;",
    buttonFocus: "border-color:" + ACCENT + ";background:#3b3e4c;"
  };
  var toastNode = null;
  var toastTimer = null;
  function toast(message, ms) {
    if (!toastNode) toastNode = el("div", {
      style: STYLE.toast,
      role: "status"
    });
    if (!toastNode.parentNode) document.documentElement.appendChild(toastNode);
    toastNode.textContent = message;
    toastNode.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastNode.style.display = "none";
    }, ms || 2600);
  }
  function makeTypeable(input, onSubmit) {
    input.readOnly = true;
    input.setAttribute("data-tizenshield-field", "");
    input.addEventListener("blur", function () {
      input.readOnly = true;
    });
    input.addEventListener("keydown", function (event) {
      var key = keyOf(event);
      if (input.readOnly) {
        if (key !== KEY.ENTER) return;
        swallow(event);
        input.blur();
        input.readOnly = false;
        input.focus();
        try {
          input.setSelectionRange(0, input.value.length);
        } catch (e) {}
        return;
      }
      if (key === KEY.ENTER || key === KEY.IME_DONE) {
        swallow(event);
        input.readOnly = true;
        onSubmit(input.value);
      } else if (key === KEY.BACK || key === KEY.IME_CANCEL) {
        swallow(event);
        input.readOnly = true;
      }
    });
    return input;
  }
  function installFocusRing(exclude) {
    var saved = null;
    function restore() {
      if (!saved) return;
      var s = saved.node.style;
      s.removeProperty("outline");
      s.removeProperty("outline-offset");
      if (saved.outline) s.setProperty("outline", saved.outline, saved.outlinePriority);
      if (saved.offset) s.setProperty("outline-offset", saved.offset, saved.offsetPriority);
      saved = null;
    }
    document.addEventListener("focusin", function (event) {
      var node = event.target;
      if (!node || !node.style || node === document.body || exclude.contains(node)) return;
      restore();
      var s = node.style;
      saved = {
        node: node,
        outline: s.getPropertyValue("outline"),
        outlinePriority: s.getPropertyPriority("outline"),
        offset: s.getPropertyValue("outline-offset"),
        offsetPriority: s.getPropertyPriority("outline-offset")
      };
      s.setProperty("outline", "4px solid " + ACCENT, "important");
      s.setProperty("outline-offset", "2px", "important");
    }, true);
    document.addEventListener("focusout", function (event) {
      if (saved && saved.node === event.target) restore();
    }, true);
  }

  // src/url.js
  var HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
  var LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#]|$)/i;
  var DOMAIN = /^[^\s\/?#]+\.[a-z]{2,}(:\d+)?([\/?#]|$)/i;
  function isWebUrl(url) {
    return /^https?:\/\//i.test(url);
  }
  function looksLikeUrl(text) {
    if (HAS_SCHEME.test(text)) return true;
    if (/\s/.test(text)) return false;
    return LOCAL_HOST.test(text) || DOMAIN.test(text);
  }
  function resolveInput(text, engine) {
    var value = (text || "").trim();
    if (!value) return null;
    if (!looksLikeUrl(value)) return engine.url + encodeURIComponent(value);
    if (HAS_SCHEME.test(value)) return isWebUrl(value) ? value : null;
    return (LOCAL_HOST.test(value) ? "http://" : "https://") + value;
  }
  function parseHash(hash) {
    var out = {};
    (hash || "").replace(/^#/, "").split("&").forEach(function (part) {
      if (!part) return;
      var eq = part.indexOf("=");
      var key = eq < 0 ? part : part.slice(0, eq);
      var value = eq < 0 ? "" : part.slice(eq + 1);
      try {
        out[decodeURIComponent(key)] = decodeURIComponent(value);
      } catch (e) {}
    });
    return out;
  }
  function hopUrl(startUrl, params) {
    var parts = Object.keys(params).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    });
    return startUrl.split("#")[0] + "#" + parts.join("&");
  }

  // src/video.js
  var VIDEO_FILE = /\.(mp4|m4v|mkv|webm|mov|avi|ts|m2ts|m3u8)$/i;
  function pathOf(url) {
    return url.split(/[?#]/)[0];
  }
  function isVideoUrl(url) {
    return isWebUrl(url) && VIDEO_FILE.test(pathOf(url));
  }
  function videoKind(url) {
    var match = /\.([a-z0-9]{2,4})$/i.exec(pathOf(url));
    if (!match) return "VIDEO";
    var ext = match[1].toLowerCase();
    return ext === "m3u8" ? "HLS" : ext.toUpperCase();
  }
  function titleFromUrl(url) {
    var path = pathOf(url).replace(/^[a-z]+:\/\/[^\/]*/i, "");
    var name = path.replace(/\/+$/, "").split("/").pop() || "";
    try {
      name = decodeURIComponent(name);
    } catch (e) {}
    name = name.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
    return name || hostOf(url);
  }
  function cleanText(text, max) {
    var value = (text || "").replace(/\s+/g, " ").trim();
    var limit = max || 90;
    return value.length > limit ? value.slice(0, limit - 3) + "..." : value;
  }
  function formatTime(seconds) {
    if (typeof seconds !== "number" || !isFinite(seconds) || seconds < 0) return "--:--";
    var total = Math.floor(seconds);
    var h = Math.floor(total / 3600);
    var m = Math.floor(total % 3600 / 60);
    var s = total % 60;
    var ss = (s < 10 ? "0" : "") + s;
    if (!h) return m + ":" + ss;
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + ss;
  }

  // src/player.js
  var HIDE_CONTROLS_MS = 5e3;
  var SEEK_COMMIT_MS = 600;
  var SAVE_EVERY_MS = 1e4;
  var RESUME_MARGIN_S = 30;
  var SPINNER_DELAY_MS = 300;
  var STEP_BACK_S = 10;
  var STEP_FORWARD_S = 30;
  var SPACE = 32;
  var ERRORS = {
    1: "Playback was stopped before the video loaded.",
    2: "The video couldn't be downloaded. The link may have expired, or the site only lets its videos play on its own page.",
    3: "The TV couldn't decode this video.",
    4: "The TV doesn't support this video's format, or the link isn't a video."
  };
  var PLAYER_CSS = [".ts-player{position:fixed;left:0;top:0;right:0;bottom:0;z-index:10;overflow:hidden;background:#000;color:#f2f2f5}", ".ts-video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;background:#000}", ".ts-p-top,.ts-p-bottom{position:absolute;left:0;right:0;transition:opacity .3s}",
  // Scrims strong enough to keep text readable over bright scenes.
  ".ts-p-top{top:0;padding:48px 96px 140px;background:linear-gradient(rgba(0,0,0,.88),rgba(0,0,0,.55) 55%,rgba(0,0,0,0))}", ".ts-p-bottom{bottom:0;padding:170px 96px 44px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.78) 42%,rgba(0,0,0,.95))}", ".ts-p-top,.ts-p-times,.ts-p-hint{text-shadow:0 2px 6px rgba(0,0,0,.85)}", ".ts-p-idle .ts-p-top,.ts-p-idle .ts-p-bottom{opacity:0}", ".ts-p-title{font-size:46px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}", ".ts-p-meta{margin-top:12px;font-size:24px;color:#c9cbd6}", ".ts-p-badge{display:inline-block;margin-right:16px;padding:3px 12px;font-size:20px;font-weight:bold;color:#16171d;background:#f2f2f5;border-radius:6px;vertical-align:2px;text-shadow:none}", ".ts-p-bar-wrap{padding:18px 0;outline:none}", ".ts-p-bar{position:relative;height:8px;border-radius:7px;background:rgba(255,255,255,.25);transition:height .15s}", ".ts-p-bar-wrap:focus .ts-p-bar{height:14px}", ".ts-p-buffered,.ts-p-played{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:7px}", ".ts-p-buffered{background:rgba(255,255,255,.35)}", ".ts-p-played{background:" + ACCENT + "}", ".ts-p-knob{position:absolute;left:0;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;box-shadow:0 0 0 7px rgba(251,84,43,.5);opacity:0;transition:opacity .15s}", ".ts-p-bar-wrap:focus .ts-p-knob{opacity:1}", ".ts-p-live .ts-p-knob{display:none}", ".ts-p-times{overflow:hidden;font-size:26px;color:#e6e7ee}", ".ts-p-times span:last-child{float:right}", ".ts-p-controls{margin-top:26px;white-space:nowrap}", ".ts-p-btn{display:inline-block;vertical-align:middle;box-sizing:border-box;height:88px;min-width:120px;margin-right:22px;padding:0 30px;line-height:80px;text-align:center;font-family:sans-serif;font-size:28px;font-weight:bold;color:#f2f2f5;background:rgba(18,19,24,.82);border:4px solid rgba(255,255,255,.22);border-radius:44px;outline:none}", ".ts-p-btn:focus{border-color:" + ACCENT + ";background:rgba(46,48,58,.96)}", ".ts-p-btn-main{width:112px;min-width:0;height:112px;padding:0;line-height:104px;border-radius:56px;background:#f2f2f5}", ".ts-p-btn-main:focus{background:#fff;border-color:" + ACCENT + ";box-shadow:0 0 0 6px rgba(251,84,43,.45)}", ".ts-p-right{float:right}", ".ts-p-right .ts-p-btn{margin:12px 0 0 22px}", ".ts-p-icon{display:inline-block;vertical-align:middle;width:0;height:0;margin-left:9px;border-style:solid;border-width:20px 0 20px 34px;border-color:transparent transparent transparent #16171d}", ".ts-p-playing .ts-p-icon{width:12px;height:40px;margin-left:0;border-width:0 12px;border-color:#16171d}", ".ts-p-hint{margin-top:24px;font-size:22px;color:#c9cbd6}", ".ts-p-hint>span{margin-right:48px}", ".ts-p-key{display:inline-block;margin-right:10px;padding:0 10px;font-size:19px;font-weight:bold;line-height:30px;color:#fff;border:2px solid rgba(255,255,255,.6);border-radius:7px;text-shadow:none}", ".ts-p-spinner{display:none;position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;box-sizing:border-box;border:9px solid rgba(255,255,255,.2);border-top-color:" + ACCENT + ";border-radius:50%;animation:ts-spin .9s linear infinite}", ".ts-p-loading .ts-p-spinner{display:block}", "@keyframes ts-spin{to{transform:rotate(360deg)}}", ".ts-p-flash{position:absolute;left:50%;top:50%;width:320px;margin:-60px 0 0 -160px;padding:22px 0;text-align:center;font-size:44px;font-weight:bold;background:rgba(0,0,0,.65);border-radius:60px;opacity:0}", ".ts-p-flash.ts-show{animation:ts-flash 1s ease-out}", "@keyframes ts-flash{0%{opacity:1}65%{opacity:1}100%{opacity:0}}", ".ts-p-error{display:none;position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(8,9,12,.88)}", ".ts-p-failed .ts-p-error{display:block}", ".ts-p-failed .ts-p-top,.ts-p-failed .ts-p-bottom,.ts-p-failed .ts-p-spinner{display:none}", ".ts-p-error-card{width:1100px;margin:210px auto 0;padding:52px 60px;background:#16171d;border:3px solid #3a3d4a;border-top:6px solid " + ACCENT + ";border-radius:18px}", ".ts-p-error h2{margin:0 0 20px;font-size:42px}", ".ts-p-error p{margin:0 0 16px;font-size:28px;line-height:1.4}", ".ts-p-error .ts-p-tip{margin-bottom:36px;font-size:24px;color:#a9abb8}", ".ts-p-error .ts-p-btn{background:#2b2d36}", ".ts-p-error .ts-p-btn:focus{background:#3b3e4c}"].join("\n");
  function showPlayer(params, nav) {
    var url = params.play;
    var title = (params.title || "").replace(/^Video: /, "") || titleFromUrl(url);
    var from = isWebUrl(params.from || "") ? params.from : "";
    addHistory(url, "Video: " + title);
    var failed = false;
    var destroyed = false;
    var pendingSeek = null;
    var timers = {
      hide: 0,
      seek: 0,
      spinner: 0
    };
    var lastSave = Date.now();
    function button(cls, text, onclick, label) {
      return el("button", {
        type: "button",
        "class": "ts-p-btn " + cls,
        text: text,
        "aria-label": label || text,
        onclick: onclick
      });
    }
    function hint(key, action) {
      return el("span", {}, [el("span", {
        "class": "ts-p-key",
        text: key
      }), action]);
    }
    var video = el("video", {
      "class": "ts-video",
      preload: "auto"
    });
    var played = el("div", {
      "class": "ts-p-played"
    });
    var buffered = el("div", {
      "class": "ts-p-buffered"
    });
    var knob = el("div", {
      "class": "ts-p-knob"
    });
    var bar = el("div", {
      "class": "ts-p-bar-wrap",
      tabindex: "0",
      role: "slider",
      "aria-label": "Position"
    }, [el("div", {
      "class": "ts-p-bar"
    }, [buffered, played, knob])]);
    var timeNow = el("span", {
      text: "0:00"
    });
    var timeTotal = el("span", {
      text: "--:--"
    });
    var playButton = button("ts-p-btn-main", "", function () {
      togglePlay();
    }, "Play or pause");
    playButton.appendChild(el("span", {
      "class": "ts-p-icon"
    }));
    var audioButton = button("", "", cycleAudio, "Audio track");
    var audioHint = hint("Yellow", "Audio track");
    audioButton.style.display = "none";
    audioHint.style.display = "none";
    var controls = el("div", {
      "class": "ts-p-controls"
    }, [button("", "-" + STEP_BACK_S + "s", function () {
      seekBy(-STEP_BACK_S);
    }, "Back " + STEP_BACK_S + " seconds"), playButton, button("", "+" + STEP_FORWARD_S + "s", function () {
      seekBy(STEP_FORWARD_S);
    }, "Forward " + STEP_FORWARD_S + " seconds"), el("div", {
      "class": "ts-p-right"
    }, [audioButton, button("", "Close", close)])]);
    var flashNode = el("div", {
      "class": "ts-p-flash"
    });
    var errorText = el("p");
    var retryButton = button("", "Try again", retry);
    var errorBox = el("div", {
      "class": "ts-p-error"
    }, [el("div", {
      "class": "ts-p-error-card"
    }, [el("h2", {
      text: "This video can't play on the TV"
    }), errorText, el("p", {
      "class": "ts-p-tip",
      text: "Videos play best as MP4 or MKV files with H.264 or HEVC video and AAC or AC3 audio."
    }), el("div", {}, [retryButton, button("", "Back", close)])])]);
    var root = el("div", {
      "class": "ts-player ts-p-loading"
    }, [video, el("div", {
      "class": "ts-p-spinner"
    }), flashNode, el("div", {
      "class": "ts-p-top"
    }, [el("div", {
      "class": "ts-p-title",
      text: title
    }), el("div", {
      "class": "ts-p-meta"
    }, [el("span", {
      "class": "ts-p-badge",
      text: videoKind(url)
    }), "from " + hostOf(from || url)])]), el("div", {
      "class": "ts-p-bottom"
    }, [bar, el("div", {
      "class": "ts-p-times"
    }, [timeNow, timeTotal]), controls, el("div", {
      "class": "ts-p-hint"
    }, [hint("OK", "Play / pause"), hint("Left / Right", "Skip -" + STEP_BACK_S + "s / +" + STEP_FORWARD_S + "s"), hint("Back", "Close"), audioHint])]), errorBox]);
    var handlers = {
      loadedmetadata: function loadedmetadata() {
        root.classList.toggle("ts-p-live", !isFinite(video.duration));
        renderProgress(video.currentTime);
        updateAudio();
        var saved = getPosition(url);
        if (saved && isFinite(video.duration) && saved < video.duration - RESUME_MARGIN_S) {
          video.currentTime = saved;
          toast("Resuming at " + formatTime(saved) + ".");
        }
      },
      timeupdate: function timeupdate() {
        if (pendingSeek === null) renderProgress(video.currentTime);
        if (Date.now() - lastSave > SAVE_EVERY_MS) savePlace();
      },
      progress: renderBuffered,
      waiting: function waiting() {
        setLoading(true);
      },
      seeking: function seeking() {
        setLoading(true);
      },
      playing: function playing() {
        setLoading(false);
      },
      canplay: function canplay() {
        setLoading(false);
      },
      seeked: function seeked() {
        setLoading(false);
      },
      play: function play() {
        root.classList.add("ts-p-playing");
        scheduleHide();
      },
      pause: function pause() {
        root.classList.remove("ts-p-playing");
        savePlace();
        showControls();
      },
      ended: function ended() {
        savePosition(url, 0);
        showControls();
      },
      error: function error() {
        failed = true;
        setLoading(false);
        var error = video.error;
        errorText.textContent = error && ERRORS[error.code] || "Something went wrong while playing this video.";
        root.classList.add("ts-p-failed");
        retryButton.focus();
      }
    };
    document.body.appendChild(root);
    Object.keys(handlers).forEach(function (type) {
      video.addEventListener(type, function () {
        if (!destroyed) handlers[type]();
      });
    });
    window.addEventListener("keydown", onKey, true);
    video.src = url;
    play();
    bar.focus();
    function play() {
      var result = video.play();
      if (result && result["catch"]) result["catch"](function () {
        showControls();
      });
    }
    function togglePlay() {
      if (video.ended) video.currentTime = 0;
      if (video.paused) play();else video.pause();
      showControls();
    }
    function retry() {
      failed = false;
      root.classList.remove("ts-p-failed");
      root.classList.add("ts-p-loading");
      video.src = url;
      play();
      bar.focus();
    }
    function close() {
      nav.exit();
    }
    function seekBy(delta) {
      if (!isFinite(video.duration)) {
        flash("Live");
        return;
      }
      var base = pendingSeek !== null ? pendingSeek : video.currentTime;
      pendingSeek = Math.max(0, Math.min(base + delta, video.duration - 1));
      renderProgress(pendingSeek);
      flash((delta > 0 ? "\xBB " : "\xAB ") + formatTime(pendingSeek));
      clearTimeout(timers.seek);
      timers.seek = setTimeout(function () {
        if (!canSeekTo(pendingSeek)) toast("This video's server doesn't allow skipping ahead.");
        video.currentTime = pendingSeek;
        pendingSeek = null;
      }, SEEK_COMMIT_MS);
      showControls();
    }
    function canSeekTo(time) {
      var ranges = video.seekable;
      for (var i = 0; i < ranges.length; i++) {
        if (time >= ranges.start(i) && time <= ranges.end(i)) return true;
      }
      return false;
    }
    function renderProgress(time) {
      var duration = video.duration;
      if (!isFinite(duration)) {
        played.style.width = "100%";
        timeNow.textContent = formatTime(time);
        timeTotal.textContent = "LIVE";
        return;
      }
      var percent = duration > 0 ? Math.min(100, time / duration * 100) : 0;
      played.style.width = percent + "%";
      knob.style.left = percent + "%";
      timeNow.textContent = formatTime(time);
      timeTotal.textContent = formatTime(duration);
    }
    function renderBuffered() {
      var ranges = video.buffered;
      if (!ranges.length || !isFinite(video.duration) || !video.duration) return;
      buffered.style.width = Math.min(100, ranges.end(ranges.length - 1) / video.duration * 100) + "%";
    }
    function setLoading(on) {
      clearTimeout(timers.spinner);
      if (!on) root.classList.remove("ts-p-loading");else timers.spinner = setTimeout(function () {
        root.classList.add("ts-p-loading");
      }, SPINNER_DELAY_MS);
    }
    function flash(text) {
      flashNode.textContent = text;
      flashNode.classList.remove("ts-show");
      void flashNode.offsetWidth;
      flashNode.classList.add("ts-show");
    }
    function isIdle() {
      return root.classList.contains("ts-p-idle");
    }
    function showControls() {
      root.classList.remove("ts-p-idle");
      scheduleHide();
    }
    function scheduleHide() {
      clearTimeout(timers.hide);
      if (!video.paused) timers.hide = setTimeout(hideControls, HIDE_CONTROLS_MS);
    }
    function hideControls() {
      if (video.paused || failed) return;
      root.classList.add("ts-p-idle");
      bar.focus();
    }
    function savePlace() {
      lastSave = Date.now();
      var time = video.currentTime;
      var duration = video.duration;
      if (!isFinite(duration) || !duration) return;
      var useful = time > RESUME_MARGIN_S && time < duration - RESUME_MARGIN_S;
      savePosition(url, useful ? time : 0);
    }
    function audioTracks() {
      var tracks = video.audioTracks;
      return tracks && tracks.length > 1 ? tracks : null;
    }
    function trackName(track, index) {
      return track.label || track.language || "Track " + (index + 1);
    }
    function updateAudio() {
      var tracks = audioTracks();
      audioButton.style.display = tracks ? "" : "none";
      audioHint.style.display = tracks ? "" : "none";
      if (!tracks) return;
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].enabled) audioButton.textContent = "Audio: " + trackName(tracks[i], i);
      }
    }
    function cycleAudio() {
      var tracks = audioTracks();
      if (!tracks) {
        toast("This video has only one audio track.");
        return;
      }
      var current = 0;
      for (var i = 0; i < tracks.length; i++) if (tracks[i].enabled) current = i;
      var next = (current + 1) % tracks.length;
      for (var j = 0; j < tracks.length; j++) tracks[j].enabled = j === next;
      updateAudio();
      toast("Audio: " + trackName(tracks[next], next));
    }
    function onKey(event) {
      var key = event.keyCode === SPACE ? KEY.PLAY_PAUSE : keyOf(event);
      var dir = DIRECTION[key];
      if (failed) {
        if (key === KEY.BACK) {
          swallow(event);
          close();
        } else if (dir) {
          swallow(event);
          move(dir, {
            scope: errorBox
          });
        }
        return;
      }
      switch (key) {
        case KEY.PLAY_PAUSE:
          swallow(event);
          togglePlay();
          return;
        case KEY.PLAY:
          swallow(event);
          play();
          showControls();
          return;
        case KEY.PAUSE:
          swallow(event);
          video.pause();
          return;
        case KEY.STOP:
          swallow(event);
          close();
          return;
        case KEY.FAST_FORWARD:
          swallow(event);
          seekBy(STEP_FORWARD_S);
          return;
        case KEY.REWIND:
          swallow(event);
          seekBy(-STEP_BACK_S);
          return;
        case KEY.RED:
          swallow(event);
          nav.home();
          return;
        case KEY.YELLOW:
          swallow(event);
          cycleAudio();
          return;
        case KEY.GREEN:
        case KEY.BLUE:
          swallow(event);
          showControls();
          return;
        case KEY.BACK:
          swallow(event);
          if (!isIdle() && !video.paused) hideControls();else close();
          return;
      }
      if (isIdle()) {
        if (!dir && key !== KEY.ENTER) return;
        swallow(event);
        showControls();
        bar.focus();
        if (dir === "left") seekBy(-STEP_BACK_S);else if (dir === "right") seekBy(STEP_FORWARD_S);else if (key === KEY.ENTER) togglePlay();
        return;
      }
      showControls();
      var active = document.activeElement;
      if (active === bar || !root.contains(active)) {
        if (dir === "left") {
          swallow(event);
          seekBy(-STEP_BACK_S);
        } else if (dir === "right") {
          swallow(event);
          seekBy(STEP_FORWARD_S);
        } else if (dir === "down") {
          swallow(event);
          playButton.focus();
        } else if (dir === "up") swallow(event);else if (key === KEY.ENTER) {
          swallow(event);
          togglePlay();
        }
        return;
      }
      if (dir === "up") {
        swallow(event);
        bar.focus();
        return;
      }
      if (dir) {
        swallow(event);
        move(dir, {
          scope: controls
        });
      }
    }
    return {
      destroy: function destroy() {
        if (!failed) savePlace();
        destroyed = true;
        Object.keys(timers).forEach(function (name) {
          clearTimeout(timers[name]);
        });
        window.removeEventListener("keydown", onKey, true);
        video.pause();
        video.removeAttribute("src");
        video.load();
        root.parentNode.removeChild(root);
      }
    };
  }

  // src/launcher.js
  var REMOVE_CONFIRM_MS = 3e3;
  var REDIRECT_DELAY_MS = 700;
  var CSS = ["html,body{margin:0;background:#16171d;color:#f2f2f5;font-family:sans-serif}", "#ts-launcher{padding:56px 96px 150px}", ".ts-header{display:flex;align-items:baseline;margin-bottom:36px}", ".ts-logo{font-size:52px;font-weight:bold}", ".ts-logo span{color:" + ACCENT + "}", ".ts-version{margin-left:20px;font-size:22px;color:#8a8c99}", ".ts-search{display:flex;margin-bottom:48px}", ".ts-search input{flex:1;height:84px;padding:0 28px;font-size:34px;color:#111;background:#fff;border:4px solid #3a3d4a;border-radius:14px;outline:none}", ".ts-search input:focus{border-color:" + ACCENT + "}", ".ts-btn{margin-left:20px;padding:0 32px;height:84px;font-size:28px;color:#f2f2f5;background:#2b2d36;border:4px solid #2b2d36;border-radius:14px;outline:none}", ".ts-btn-small{height:60px;font-size:24px;padding:0 24px}", ".ts-section-head{display:flex;align-items:center;margin-bottom:20px}", ".ts-section-head h2{flex:1;margin:0;font-size:32px;font-weight:normal;color:#c9cbd6}", ".ts-tiles{margin-bottom:40px}", ".ts-tile{display:inline-block;vertical-align:top;box-sizing:border-box;width:260px;height:150px;margin:0 24px 24px 0;padding:22px;overflow:hidden;color:#f2f2f5;text-decoration:none;background:#22242c;border:4px solid #22242c;border-radius:14px;outline:none}", ".ts-tile-title{display:block;max-height:70px;overflow:hidden;font-size:28px;line-height:1.25}", ".ts-tile-host{display:block;margin-top:12px;font-size:22px;color:#8a8c99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}", ".ts-recent a{display:block;max-width:1400px;margin-bottom:12px;padding:16px 24px;font-size:26px;color:#f2f2f5;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#1d1f26;border:4px solid #1d1f26;border-radius:10px;outline:none}", ".ts-recent a span{margin-left:16px;color:#8a8c99}", ".ts-btn:focus,.ts-tile:focus,.ts-recent a:focus{border-color:" + ACCENT + ";background:#3b3e4c}", ".ts-empty{font-size:26px;color:#8a8c99}", ".ts-hints{position:fixed;left:0;right:0;bottom:0;padding:22px 96px;font-size:24px;color:#c9cbd6;background:#101116}", ".ts-hint{display:inline-block;margin-right:40px}", ".ts-dot{display:inline-block;width:22px;height:22px;margin-right:10px;border-radius:50%;vertical-align:-3px}", ".ts-message{padding:200px 96px;font-size:40px}"].join("\n");
  var HINTS = [["#e53935", "Home"], ["#43a047", "Toolbar (on websites)"], ["#fdd835", "Bookmark page / remove bookmark"], ["#1e88e5", "Remote keys to site"], [null, "Back: go back"]];
  var currentView = null;
  function startLauncher() {
    var params = parseHash(window.location.hash);
    var refused = false;
    if (params.go !== void 0) {
      var url = resolveInput(params.go, engineById(getSettings().engine));
      if (url && !isVideoUrl(url)) {
        addHistory(url, historyTitle(params.go));
        window.location.replace(url);
        return;
      }
      if (url) window.history.replaceState(null, "", playUrl(url, ""));else refused = true;
    }
    if (params.add !== void 0 && isWebUrl(params.add)) {
      addBookmark(params.add, params.title);
      prepareBody();
      document.body.appendChild(el("div", {
        "class": "ts-message",
        text: "Bookmarked: " + (params.title || hostOf(params.add))
      }));
      setTimeout(function () {
        window.location.replace(params.add);
      }, REDIRECT_DELAY_MS);
      return;
    }
    prepareBody();
    route();
    window.addEventListener("hashchange", route);
    if (refused) toast("Can't open that address.");
  }
  function route() {
    if (currentView) currentView.destroy();
    var params = parseHash(window.location.hash);
    if (params.play !== void 0 && isWebUrl(params.play)) {
      currentView = showPlayer(params, {
        exit: function exit() {
          window.history.back();
        },
        home: goHome
      });
    } else {
      if (window.location.hash) clearHash();
      currentView = showHome();
    }
  }
  function clearHash() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  function goHome() {
    clearHash();
    route();
  }
  function playUrl(url, title) {
    return hopUrl(window.location.href, {
      play: url,
      title: title || ""
    });
  }
  function historyTitle(text) {
    return looksLikeUrl(text.trim()) ? "" : "Search: " + text.trim();
  }
  function openUrl(url, title) {
    if (isVideoUrl(url)) {
      window.location.href = playUrl(url, title);
      return;
    }
    addHistory(url, title);
    window.location.href = url;
  }
  var bodyPrepared = false;
  function prepareBody() {
    if (bodyPrepared) return;
    bodyPrepared = true;
    var boot = document.getElementById("ts-boot");
    if (boot) boot.parentNode.removeChild(boot);
    var style = el("style");
    style.textContent = CSS + "\n" + PLAYER_CSS;
    document.head.appendChild(style);
  }
  function showHome() {
    var pendingRemove = {
      url: null,
      at: 0
    };
    var search = makeTypeable(el("input", {
      type: "text",
      spellcheck: "false",
      autocomplete: "off"
    }), function (text) {
      if (!text.trim()) return;
      var url = resolveInput(text, engineById(getSettings().engine));
      if (url) openUrl(url, historyTitle(text));else toast("Can't open that address.");
    });
    var engineButton = el("button", {
      type: "button",
      "class": "ts-btn",
      onclick: cycleEngine
    });
    var tiles = el("div", {
      "class": "ts-tiles"
    });
    var recent = el("div", {
      "class": "ts-recent"
    });
    var clearButton = el("button", {
      type: "button",
      "class": "ts-btn ts-btn-small",
      text: "Clear history",
      onclick: function onclick() {
        clearHistory();
        renderRecent();
        search.focus();
      }
    });
    var root = el("div", {
      id: "ts-launcher"
    }, [el("div", {
      "class": "ts-header"
    }, [el("div", {
      "class": "ts-logo"
    }, ["Tizen", el("span", {
      text: "Shield"
    })]), el("div", {
      "class": "ts-version",
      text: "v" + VERSION
    })]), el("div", {
      "class": "ts-search"
    }, [search, engineButton]), el("div", {
      "class": "ts-section-head"
    }, [el("h2", {
      text: "Bookmarks"
    })]), tiles, el("div", {
      "class": "ts-section-head"
    }, [el("h2", {
      text: "Recent"
    }), clearButton]), recent]);
    var hints = el("div", {
      "class": "ts-hints"
    }, HINTS.map(function (hint) {
      var parts = hint[0] ? [el("span", {
        "class": "ts-dot",
        style: "background:" + hint[0]
      })] : [];
      return el("span", {
        "class": "ts-hint"
      }, parts.concat([hint[1]]));
    }));
    document.body.appendChild(root);
    document.body.appendChild(hints);
    showEngine();
    renderTiles();
    renderRecent();
    search.focus();
    window.addEventListener("keydown", onKey, true);
    function showEngine() {
      var engine = engineById(getSettings().engine);
      engineButton.textContent = engine.name;
      search.setAttribute("placeholder", "Press Enter to search " + engine.name + " or type an address");
    }
    function cycleEngine() {
      var index = SEARCH_ENGINES.indexOf(engineById(getSettings().engine));
      setSetting("engine", SEARCH_ENGINES[(index + 1) % SEARCH_ENGINES.length].id);
      showEngine();
    }
    function renderTiles() {
      tiles.innerHTML = "";
      var list = getBookmarks();
      if (!list.length) {
        tiles.appendChild(el("p", {
          "class": "ts-empty",
          text: "No bookmarks yet. On any website, press Yellow to add one."
        }));
      }
      list.forEach(function (item) {
        var title = item.title || hostOf(item.url);
        tiles.appendChild(el("a", {
          "class": "ts-tile",
          href: item.url,
          "data-url": item.url,
          "data-title": title,
          onclick: function onclick(event) {
            openLink(event, item);
          }
        }, [el("span", {
          "class": "ts-tile-title",
          text: title
        }), el("span", {
          "class": "ts-tile-host",
          text: hostOf(item.url)
        })]));
      });
    }
    function renderRecent() {
      recent.innerHTML = "";
      var list = getHistory();
      clearButton.style.display = list.length ? "" : "none";
      if (!list.length) recent.appendChild(el("p", {
        "class": "ts-empty",
        text: "Nothing yet."
      }));
      list.slice(0, 10).forEach(function (item) {
        recent.appendChild(el("a", {
          href: item.url,
          onclick: function onclick(event) {
            openLink(event, item);
          }
        }, [item.title || hostOf(item.url), el("span", {
          text: item.url
        })]));
      });
    }
    function openLink(event, item) {
      event.preventDefault();
      openUrl(item.url, item.title);
    }
    function removeFocusedBookmark() {
      var active = document.activeElement;
      if (!active || !active.hasAttribute("data-url")) {
        toast("Highlight a bookmark, then press Yellow to remove it.");
        return;
      }
      var url = active.getAttribute("data-url");
      if (pendingRemove.url !== url || Date.now() - pendingRemove.at > REMOVE_CONFIRM_MS) {
        pendingRemove = {
          url: url,
          at: Date.now()
        };
        toast('Press Yellow again to remove "' + active.getAttribute("data-title") + '".');
        return;
      }
      var index = Array.prototype.indexOf.call(tiles.children, active);
      removeBookmark(url);
      pendingRemove = {
        url: null,
        at: 0
      };
      renderTiles();
      var next = tiles.querySelectorAll(".ts-tile");
      (next[Math.min(index, next.length - 1)] || search).focus();
      toast("Bookmark removed.");
    }
    function onKey(event) {
      var key = keyOf(event);
      if (key === KEY.RED || key === KEY.GREEN) {
        swallow(event);
        window.scrollTo(0, 0);
        search.focus();
        return;
      }
      if (key === KEY.YELLOW) {
        swallow(event);
        removeFocusedBookmark();
        return;
      }
      if (key === KEY.BLUE) {
        swallow(event);
        toast("Blue sends remote keys to a website. Open a site first.");
        return;
      }
      var dir = DIRECTION[key];
      if (isEditing(document.activeElement) && dir !== "up" && dir !== "down") return;
      if (key === KEY.BACK) {
        swallow(event);
        window.history.back();
        return;
      }
      if (dir) {
        swallow(event);
        move(dir, {
          scope: root,
          scroll: true
        });
      }
    }
    return {
      destroy: function destroy() {
        window.removeEventListener("keydown", onKey, true);
        document.body.removeChild(root);
        document.body.removeChild(hints);
      }
    };
  }

  // src/detect.js
  function findVideos() {
    var found = [];
    var byUrl = {};
    function add(url, title, fromPageTitle) {
      if (!isWebUrl(url)) return;
      var label = cleanText(title);
      var existing = byUrl[url];
      if (existing) {
        if (existing.weak && label && !fromPageTitle) {
          existing.title = label;
          existing.weak = false;
        }
        return;
      }
      byUrl[url] = {
        url: url,
        title: label || titleFromUrl(url),
        kind: videoKind(url),
        weak: !label || !!fromPageTitle
      };
      found.push(byUrl[url]);
    }
    if (isVideoUrl(window.location.href)) add(window.location.href, "");
    toArray(document.querySelectorAll("video")).forEach(function (video) {
      var candidates = [video.currentSrc, video.src].concat(toArray(video.querySelectorAll("source")).map(function (source) {
        return source.src;
      }));
      var label = video.getAttribute("title") || video.getAttribute("aria-label");
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] && isWebUrl(candidates[i])) {
          add(candidates[i], label || document.title, !label);
          return;
        }
      }
    });
    toArray(document.querySelectorAll("a[href]")).forEach(function (link) {
      if (isVideoUrl(link.href)) add(link.href, link.textContent || link.getAttribute("title"));
    });
    return found.map(function (item) {
      return {
        url: item.url,
        title: item.title,
        kind: item.kind
      };
    });
  }
  function videoLinkFor(target) {
    var link = target && target.closest ? target.closest("a[href]") : null;
    if (!link || !isVideoUrl(link.href)) return null;
    return {
      url: link.href,
      title: cleanText(link.textContent) || titleFromUrl(link.href),
      kind: videoKind(link.href)
    };
  }

  // src/picker.js
  var R = STYLE.reset;
  var BACKDROP = R + "position:fixed;left:0;top:0;right:0;bottom:0;z-index:" + Z_TOP + ";display:none;background:rgba(8,9,12,0.78);";
  var CARD = R + "display:block;width:1100px;margin:120px auto 0;padding:44px 48px 36px;color:#f2f2f5;background:#16171d;border:3px solid #3a3d4a;border-radius:18px;";
  var HEADING = R + "display:block;font-size:36px;font-weight:bold;color:#f2f2f5;";
  var SUB = R + "display:block;margin:8px 0 28px;font-size:24px;color:#a9abb8;";
  var LIST = R + "display:block;max-height:560px;overflow:hidden;";
  var ITEM = R + "display:block;width:100%;margin:0 0 14px;padding:18px 26px;text-align:left;cursor:pointer;background:#22242c;border:4px solid #22242c;border-radius:12px;";
  var ITEM_FOCUS = "border-color:" + ACCENT + ";background:#2d303b;";
  var ITEM_TITLE = R + "display:block;font-size:30px;color:#f2f2f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  var ITEM_META = R + "display:block;margin-top:8px;font-size:22px;color:#a9abb8;";
  var BADGE = R + "display:inline-block;margin-right:14px;padding:2px 10px;font-size:18px;font-weight:bold;color:#16171d;background:#f2f2f5;border-radius:5px;";
  var HINT = R + "display:block;margin-top:14px;font-size:22px;color:#a9abb8;";
  function createPicker(onPick) {
    var list = el("div", {
      style: LIST
    });
    var root = el("div", {
      id: "tizenshield-picker",
      style: BACKDROP
    }, [el("div", {
      style: CARD
    }, [el("div", {
      style: HEADING,
      text: "Videos on this page"
    }), el("div", {
      style: SUB,
      text: "Choose one to play on the TV player."
    }), list, el("div", {
      style: HINT,
      text: "Arrows move, OK plays, Back closes."
    })])]);
    function open(videos) {
      if (!root.parentNode) document.documentElement.appendChild(root);
      list.innerHTML = "";
      videos.forEach(function (video) {
        var item = el("button", {
          type: "button",
          onclick: function onclick() {
            close();
            onPick(video);
          }
        }, [el("span", {
          style: ITEM_TITLE,
          text: video.title
        }), el("span", {
          style: ITEM_META
        }, [el("span", {
          style: BADGE,
          text: video.kind
        }), hostOf(video.url)])]);
        focusStyle(item, ITEM, ITEM_FOCUS);
        list.appendChild(item);
      });
      root.style.display = "block";
      list.firstChild.focus();
    }
    function close() {
      root.style.display = "none";
      if (root.contains(document.activeElement)) document.activeElement.blur();
    }
    return {
      root: root,
      open: open,
      close: close,
      isOpen: function isOpen() {
        return root.style.display === "block";
      }
    };
  }

  // src/toolbar.js
  var BAR = STYLE.reset + "position:fixed;left:0;right:0;top:0;z-index:" + Z_TOP + ";display:none;padding:24px 40px 10px;background:rgba(18,19,24,0.97);border-bottom:4px solid " + ACCENT + ";";
  var ROW = STYLE.reset + "display:block;margin-top:18px;";
  var HINT2 = STYLE.reset + "display:block;margin:4px 0 8px;font-size:22px;color:#a9abb8;";
  var BUTTON = STYLE.button + "margin-bottom:14px;";
  var PRIMARY = BUTTON + "background:" + ACCENT + ";border-color:" + ACCENT + ";color:#fff;font-weight:bold;";
  var PRIMARY_FOCUS = "border-color:#fff;";
  function createToolbar(actions) {
    var previousFocus = null;
    var root = el("div", {
      id: "tizenshield-toolbar",
      style: BAR
    });
    var address = el("input", {
      type: "text",
      spellcheck: "false",
      autocomplete: "off",
      "aria-label": "Address or search"
    });
    focusStyle(address, STYLE.input, STYLE.inputFocus);
    makeTypeable(address, function (text) {
      actions.open(text);
    });
    root.appendChild(address);
    var row = el("div", {
      style: ROW
    });
    var dynamic = [];
    actions.buttons.forEach(function (spec) {
      var button = el("button", {
        type: "button",
        onclick: spec.run
      });
      if (spec.primary) focusStyle(button, PRIMARY, PRIMARY_FOCUS);else focusStyle(button, BUTTON, STYLE.buttonFocus);
      if (typeof spec.label === "function" || spec.visible) dynamic.push({
        node: button,
        spec: spec
      });else button.textContent = spec.label;
      row.appendChild(button);
    });
    root.appendChild(row);
    root.appendChild(el("div", {
      style: HINT2,
      text: "Enter on the address bar to type. Arrows move, Enter selects, Back or Green closes."
    }));
    function isOpen() {
      return root.style.display === "block";
    }
    function open() {
      if (!root.parentNode) document.documentElement.appendChild(root);
      if (actions.onOpen) actions.onOpen();
      dynamic.forEach(function (d) {
        var label = d.spec.label;
        d.node.textContent = typeof label === "function" ? label() : label;
        d.node.style.display = !d.spec.visible || d.spec.visible() ? "inline-block" : "none";
      });
      address.value = window.location.href;
      previousFocus = document.activeElement;
      root.style.display = "block";
      address.focus();
    }
    function close() {
      root.style.display = "none";
      if (root.contains(document.activeElement)) document.activeElement.blur();
      if (previousFocus && previousFocus !== document.body && document.documentElement.contains(previousFocus)) {
        previousFocus.focus();
      }
      previousFocus = null;
    }
    return {
      root: root,
      isOpen: isOpen,
      open: open,
      close: close,
      toggle: function toggle() {
        if (isOpen()) close();else open();
      }
    };
  }

  // src/site.js
  var LOCAL_PROBE_URL = "http://127.0.0.1:8081/";
  var VIDEO_HINT_DELAY_MS = 1500;
  function startSite() {
    var adOff = adHidingOff();
    var passThrough = false;
    var videos = [];
    if (!adOff) startAdHiding(window.location.hostname);
    var picker = createPicker(playVideo);
    var toolbar = createToolbar({
      open: function open(text) {
        if (text.trim()) window.location.href = hopUrl(START_URL, {
          go: text
        });
      },
      onOpen: function onOpen() {
        videos = findVideos();
      },
      buttons: [{
        label: function label() {
          return videos.length > 1 ? "Play on TV player (" + videos.length + ")" : "Play on TV player";
        },
        visible: function visible() {
          return videos.length > 0;
        },
        primary: true,
        run: playFromPage
      }, {
        label: "Back",
        run: goBack
      }, {
        label: "Forward",
        run: function run() {
          window.history.forward();
        }
      }, {
        label: "Reload",
        run: function run() {
          window.location.reload();
        }
      }, {
        label: "Home",
        run: goHome2
      }, {
        label: "Bookmark",
        run: bookmark
      }, {
        label: function label() {
          return adOff ? "Ad hiding: off" : "Ad hiding: on";
        },
        run: toggleAdHiding
      }, {
        label: function label() {
          return passThrough ? "Remote: to site" : "Remote: browse";
        },
        run: togglePassThrough
      }, {
        label: "Info",
        run: diagnostics
      }]
    });
    document.documentElement.appendChild(toolbar.root);
    installFocusRing({
      contains: function contains(node) {
        return toolbar.root.contains(node) || picker.root.contains(node);
      }
    });
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("click", function (event) {
      var video = videoLinkFor(event.target);
      if (!video) return;
      event.preventDefault();
      playVideo(video);
    }, true);
    setTimeout(function () {
      if (findVideos().length) toast("Video found. Press Play on the remote to watch it on the TV player.", 5e3);
    }, VIDEO_HINT_DELAY_MS);
    function onKey(event) {
      var key = keyOf(event);
      if (key === KEY.GREEN) {
        swallow(event);
        picker.close();
        toolbar.toggle();
        return;
      }
      if (key === KEY.RED) {
        swallow(event);
        goHome2();
        return;
      }
      if (key === KEY.YELLOW) {
        swallow(event);
        bookmark();
        return;
      }
      if (key === KEY.BLUE) {
        swallow(event);
        togglePassThrough();
        return;
      }
      if ((key === KEY.PLAY || key === KEY.PLAY_PAUSE) && !passThrough) {
        videos = findVideos();
        if (videos.length) {
          swallow(event);
          playFromPage();
        }
        return;
      }
      var active = document.activeElement;
      var dir = DIRECTION[key];
      if (picker.isOpen()) {
        if (key === KEY.BACK) {
          swallow(event);
          picker.close();
          return;
        }
        if (dir) {
          swallow(event);
          move(dir, {
            scope: picker.root
          });
        }
        return;
      }
      if (toolbar.isOpen()) {
        if (isEditing(active)) return;
        if (key === KEY.BACK) {
          swallow(event);
          toolbar.close();
          return;
        }
        if (dir) {
          swallow(event);
          move(dir, {
            scope: toolbar.root
          });
        }
        return;
      }
      if (passThrough) return;
      if (isEditing(active)) {
        if (key === KEY.BACK) {
          swallow(event);
          active.blur();
          return;
        }
        if (dir !== "up" && dir !== "down") return;
      }
      if (key === KEY.BACK) {
        swallow(event);
        goBack();
        return;
      }
      if (dir) {
        swallow(event);
        move(dir, {
          scope: document,
          exclude: toolbar.root,
          scroll: true
        });
      }
    }
    function goHome2() {
      window.location.href = START_URL;
    }
    function playFromPage() {
      if (!videos.length) {
        toast("No video files found on this page.");
        return;
      }
      if (toolbar.isOpen()) toolbar.close();
      if (videos.length === 1) playVideo(videos[0]);else picker.open(videos);
    }
    function playVideo(video) {
      toast("Opening the TV player...");
      window.location.href = hopUrl(START_URL, {
        play: video.url,
        title: video.title,
        from: window.location.href
      });
    }
    function goBack() {
      var before = window.location.href;
      var left = false;
      window.addEventListener("pagehide", function () {
        left = true;
      });
      window.history.back();
      setTimeout(function () {
        if (!left && window.location.href === before) goHome2();
      }, 800);
    }
    function bookmark() {
      toast("Saving bookmark...");
      window.location.replace(hopUrl(START_URL, {
        add: window.location.href,
        title: document.title || ""
      }));
    }
    function toggleAdHiding() {
      setAdHidingOff(!adOff);
      window.location.reload();
    }
    function togglePassThrough() {
      passThrough = !passThrough;
      if (toolbar.isOpen()) toolbar.close();
      toast(passThrough ? "Arrow keys and Back now go to the site. Press Blue to switch back." : "Arrow keys move between links again.");
    }
    function diagnostics() {
      var match = /Chrome\/(\d+)/.exec(navigator.userAgent);
      var summary = "TizenShield " + VERSION + " | Chrome " + (match ? match[1] : "?");
      if (typeof window.fetch !== "function") {
        toast(summary + " | no fetch()", 8e3);
        return;
      }
      toast(summary + " | testing local link...", 8e3);
      window.fetch(LOCAL_PROBE_URL, {
        mode: "no-cors"
      }).then(function () {
        toast(summary + " | local link: OK", 8e3);
      }, function () {
        toast(summary + " | local link: blocked", 8e3);
      });
    }
  }

  // src/main.js
  var TIZENBREW_SERVER = "127.0.0.1:8081";
  (function () {
    if (window.__tizenShield) return;
    window.__tizenShield = true;
    var loc = window.location;
    if (loc.protocol !== "http:" && loc.protocol !== "https:") return;
    onReady(function () {
      var isStartPage = document.documentElement.getAttribute("data-tizenshield") === "start";
      if (!isStartPage && loc.host === TIZENBREW_SERVER) return;
      if (window.top !== window) {
        if (!isStartPage) startAdHiding(loc.hostname);
        return;
      }
      if (isStartPage) startLauncher();else startSite();
    });
  })();
})();
