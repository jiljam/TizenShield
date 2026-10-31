var HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
var LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#]|$)/i;
var DOMAIN = /^[^\s\/?#]+\.[a-z]{2,}(:\d+)?([\/?#]|$)/i;

export function isWebUrl(url) {
  return /^https?:\/\//i.test(url);
}

export function looksLikeUrl(text) {
  if (HAS_SCHEME.test(text)) return true;
  if (/\s/.test(text)) return false;
  return LOCAL_HOST.test(text) || DOMAIN.test(text);
}

// Turns what was typed into an address bar into a URL: a web address as-is,
// anything else as a search. Returns null for blank input and for schemes we
// won't open (javascript:, file:, ...).
export function resolveInput(text, engine) {
  var value = (text || '').trim();
  if (!value) return null;
  if (!looksLikeUrl(value)) return engine.url + encodeURIComponent(value);
  if (HAS_SCHEME.test(value)) return isWebUrl(value) ? value : null;
  // Home-network devices (Jellyfin, a NAS, ...) usually only speak plain HTTP.
  return (LOCAL_HOST.test(value) ? 'http://' : 'https://') + value;
}

export function parseHash(hash) {
  var out = {};
  (hash || '').replace(/^#/, '').split('&').forEach(function (part) {
    if (!part) return;
    var eq = part.indexOf('=');
    var key = eq < 0 ? part : part.slice(0, eq);
    var value = eq < 0 ? '' : part.slice(eq + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch (e) {
      // Malformed escape sequence: skip this pair.
    }
  });
  return out;
}

// Websites can't read or write the start page's storage, so they send it
// requests in its URL fragment, e.g. start.html#go=<url> (open url and record
// it in history) or start.html#add=<url>&title=<title> (bookmark url).
export function hopUrl(startUrl, params) {
  var parts = Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  });
  return startUrl.split('#')[0] + '#' + parts.join('&');
}
