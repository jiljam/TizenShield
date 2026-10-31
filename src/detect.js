import { toArray } from './dom.js';
import { isWebUrl } from './url.js';
import { cleanText, isVideoUrl, titleFromUrl, videoKind } from './video.js';

// Videos on the current page that the TV player can open: links to video
// files and <video> elements playing a plain web address. Videos fed through
// Media Source (blob: addresses, e.g. YouTube) can't be handed over.
export function findVideos() {
  var found = [];
  var byUrl = {};

  // A video can be found twice (a <video> and a link to the same file); keep
  // the first position but the best title: a link's text beats the page title.
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
    byUrl[url] = { url: url, title: label || titleFromUrl(url), kind: videoKind(url), weak: !label || !!fromPageTitle };
    found.push(byUrl[url]);
  }

  // Opening a video file directly shows the browser's own viewer page.
  if (isVideoUrl(window.location.href)) add(window.location.href, '');

  toArray(document.querySelectorAll('video')).forEach(function (video) {
    var candidates = [video.currentSrc, video.src].concat(
      toArray(video.querySelectorAll('source')).map(function (source) { return source.src; })
    );
    var label = video.getAttribute('title') || video.getAttribute('aria-label');
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && isWebUrl(candidates[i])) {
        add(candidates[i], label || document.title, !label);
        return;
      }
    }
  });

  toArray(document.querySelectorAll('a[href]')).forEach(function (link) {
    if (isVideoUrl(link.href)) add(link.href, link.textContent || link.getAttribute('title'));
  });
  return found.map(function (item) { return { url: item.url, title: item.title, kind: item.kind }; });
}

// The video link that was clicked (or activated with OK), if any.
export function videoLinkFor(target) {
  var link = target && target.closest ? target.closest('a[href]') : null;
  if (!link || !isVideoUrl(link.href)) return null;
  return { url: link.href, title: cleanText(link.textContent) || titleFromUrl(link.href), kind: videoKind(link.href) };
}
