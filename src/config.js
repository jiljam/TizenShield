// __START_URL__ and __VERSION__ are filled in by build.mjs. START_URL is the
// websiteURL from package.json: the start page, served by TizenBrew's local
// module server. The typeof guards let unit tests import this file unbuilt.
export var START_URL = typeof __START_URL__ !== 'undefined' ? __START_URL__ : '';
export var VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

export var ACCENT = '#fb542b';

export var SEARCH_ENGINES = [
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  // Server-rendered and script-free, so it works on 2017 TV engines where
  // Brave Search's own pages may not.
  { id: 'ddg-lite', name: 'DuckDuckGo Lite', url: 'https://lite.duckduckgo.com/lite/?q=' }
];

export var DEFAULT_BOOKMARKS = [
  { url: 'https://search.brave.com/', title: 'Brave Search' },
  { url: 'https://lite.duckduckgo.com/lite/', title: 'DuckDuckGo Lite' },
  { url: 'https://en.m.wikipedia.org/', title: 'Wikipedia' }
];

export function engineById(id) {
  for (var i = 0; i < SEARCH_ENGINES.length; i++) {
    if (SEARCH_ENGINES[i].id === id) return SEARCH_ENGINES[i];
  }
  return SEARCH_ENGINES[0];
}
