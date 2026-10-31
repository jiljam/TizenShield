/* TizenShield 0.1.0 */
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
  var VERSION = true ? "0.1.0" : "dev";
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
    IME_DONE: 65376,
    IME_CANCEL: 65385
  };
  var DESKTOP = {
    27: KEY.BACK,
    112: KEY.RED,
    113: KEY.GREEN,
    114: KEY.YELLOW,
    115: KEY.BLUE
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

  // src/launcher.js
  var REMOVE_CONFIRM_MS = 3e3;
  var REDIRECT_DELAY_MS = 700;
  var CSS = ["html,body{margin:0;background:#16171d;color:#f2f2f5;font-family:sans-serif}", "#ts-launcher{padding:56px 96px 150px}", ".ts-header{display:flex;align-items:baseline;margin-bottom:36px}", ".ts-logo{font-size:52px;font-weight:bold}", ".ts-logo span{color:" + ACCENT + "}", ".ts-version{margin-left:20px;font-size:22px;color:#8a8c99}", ".ts-search{display:flex;margin-bottom:48px}", ".ts-search input{flex:1;height:84px;padding:0 28px;font-size:34px;color:#111;background:#fff;border:4px solid #3a3d4a;border-radius:14px;outline:none}", ".ts-search input:focus{border-color:" + ACCENT + "}", ".ts-btn{margin-left:20px;padding:0 32px;height:84px;font-size:28px;color:#f2f2f5;background:#2b2d36;border:4px solid #2b2d36;border-radius:14px;outline:none}", ".ts-btn-small{height:60px;font-size:24px;padding:0 24px}", ".ts-section-head{display:flex;align-items:center;margin-bottom:20px}", ".ts-section-head h2{flex:1;margin:0;font-size:32px;font-weight:normal;color:#c9cbd6}", ".ts-tiles{margin-bottom:40px}", ".ts-tile{display:inline-block;vertical-align:top;box-sizing:border-box;width:260px;height:150px;margin:0 24px 24px 0;padding:22px;overflow:hidden;color:#f2f2f5;text-decoration:none;background:#22242c;border:4px solid #22242c;border-radius:14px;outline:none}", ".ts-tile-title{display:block;max-height:70px;overflow:hidden;font-size:28px;line-height:1.25}", ".ts-tile-host{display:block;margin-top:12px;font-size:22px;color:#8a8c99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}", ".ts-recent a{display:block;max-width:1400px;margin-bottom:12px;padding:16px 24px;font-size:26px;color:#f2f2f5;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#1d1f26;border:4px solid #1d1f26;border-radius:10px;outline:none}", ".ts-recent a span{margin-left:16px;color:#8a8c99}", ".ts-btn:focus,.ts-tile:focus,.ts-recent a:focus{border-color:" + ACCENT + ";background:#3b3e4c}", ".ts-empty{font-size:26px;color:#8a8c99}", ".ts-hints{position:fixed;left:0;right:0;bottom:0;padding:22px 96px;font-size:24px;color:#c9cbd6;background:#101116}", ".ts-hint{display:inline-block;margin-right:40px}", ".ts-dot{display:inline-block;width:22px;height:22px;margin-right:10px;border-radius:50%;vertical-align:-3px}", ".ts-message{padding:200px 96px;font-size:40px}"].join("\n");
  var HINTS = [["#e53935", "Home"], ["#43a047", "Toolbar (on websites)"], ["#fdd835", "Bookmark page / remove bookmark"], ["#1e88e5", "Remote keys to site"], [null, "Back: go back"]];
  function startLauncher() {
    var params = parseHash(window.location.hash);
    if (params.go !== void 0 && openInput(params.go, true)) return;
    if (params.add !== void 0 && isWebUrl(params.add)) {
      addBookmark(params.add, params.title);
      showMessage("Bookmarked: " + (params.title || hostOf(params.add)));
      setTimeout(function () {
        window.location.replace(params.add);
      }, REDIRECT_DELAY_MS);
      return;
    }
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    render();
    if (params.go !== void 0) toast("Can't open that address.");
  }
  function openInput(text, replace) {
    var url = resolveInput(text, engineById(getSettings().engine));
    if (!url) return false;
    addHistory(url, looksLikeUrl(text.trim()) ? "" : "Search: " + text.trim());
    if (replace) window.location.replace(url);else window.location.href = url;
    return true;
  }
  function prepareBody() {
    var boot = document.getElementById("ts-boot");
    if (boot) boot.parentNode.removeChild(boot);
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  function showMessage(text) {
    prepareBody();
    document.body.appendChild(el("div", {
      "class": "ts-message",
      text: text
    }));
  }
  function render() {
    prepareBody();
    var pendingRemove = {
      url: null,
      at: 0
    };
    var search = makeTypeable(el("input", {
      type: "text",
      spellcheck: "false",
      autocomplete: "off"
    }), function (text) {
      if (text.trim() && !openInput(text, false)) toast("Can't open that address.");
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
    document.body.appendChild(root);
    document.body.appendChild(el("div", {
      "class": "ts-hints"
    }, HINTS.map(function (hint) {
      var parts = hint[0] ? [el("span", {
        "class": "ts-dot",
        style: "background:" + hint[0]
      })] : [];
      return el("span", {
        "class": "ts-hint"
      }, parts.concat([hint[1]]));
    })));
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
          onclick: function onclick() {
            addHistory(item.url, item.title);
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
          onclick: function onclick() {
            addHistory(item.url, item.title);
          }
        }, [item.title || hostOf(item.url), el("span", {
          text: item.url
        })]));
      });
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
  }

  // src/toolbar.js
  var BAR = STYLE.reset + "position:fixed;left:0;right:0;top:0;z-index:" + Z_TOP + ";display:none;padding:24px 40px 10px;background:rgba(18,19,24,0.97);border-bottom:4px solid " + ACCENT + ";";
  var ROW = STYLE.reset + "display:block;margin-top:18px;";
  var HINT = STYLE.reset + "display:block;margin:4px 0 8px;font-size:22px;color:#a9abb8;";
  var BUTTON = STYLE.button + "margin-bottom:14px;";
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
      focusStyle(button, BUTTON, STYLE.buttonFocus);
      button.textContent = typeof spec.label === "function" ? spec.label() : spec.label;
      if (typeof spec.label === "function") dynamic.push({
        node: button,
        label: spec.label
      });
      row.appendChild(button);
    });
    root.appendChild(row);
    root.appendChild(el("div", {
      style: HINT,
      text: "Enter on the address bar to type. Arrows move, Enter selects, Back or Green closes."
    }));
    function isOpen() {
      return root.style.display === "block";
    }
    function open() {
      if (!root.parentNode) document.documentElement.appendChild(root);
      dynamic.forEach(function (d) {
        d.node.textContent = d.label();
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
  function startSite() {
    var adOff = adHidingOff();
    var passThrough = false;
    if (!adOff) startAdHiding(window.location.hostname);
    var toolbar = createToolbar({
      open: function open(text) {
        if (text.trim()) window.location.href = hopUrl(START_URL, {
          go: text
        });
      },
      buttons: [{
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
        run: goHome
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
    installFocusRing(toolbar.root);
    window.addEventListener("keydown", onKey, true);
    function onKey(event) {
      var key = keyOf(event);
      if (key === KEY.GREEN) {
        swallow(event);
        toolbar.toggle();
        return;
      }
      if (key === KEY.RED) {
        swallow(event);
        goHome();
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
      var active = document.activeElement;
      var dir = DIRECTION[key];
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
    function goHome() {
      window.location.href = START_URL;
    }
    function goBack() {
      var before = window.location.href;
      var left = false;
      window.addEventListener("pagehide", function () {
        left = true;
      });
      window.history.back();
      setTimeout(function () {
        if (!left && window.location.href === before) goHome();
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
