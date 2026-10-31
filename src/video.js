import { hostOf } from './dom.js';
import { isWebUrl } from './url.js';

// File types the TV's hardware player opens straight from a URL. HLS (.m3u8)
// is played natively by Samsung's engine.
var VIDEO_FILE = /\.(mp4|m4v|mkv|webm|mov|avi|ts|m2ts|m3u8)$/i;

function pathOf(url) {
  return url.split(/[?#]/)[0];
}

export function isVideoUrl(url) {
  return isWebUrl(url) && VIDEO_FILE.test(pathOf(url));
}

// Short label for the format badge: MP4, MKV, HLS, ...
export function videoKind(url) {
  var match = /\.([a-z0-9]{2,4})$/i.exec(pathOf(url));
  if (!match) return 'VIDEO';
  var ext = match[1].toLowerCase();
  return ext === 'm3u8' ? 'HLS' : ext.toUpperCase();
}

// "Big_Buck.Bunny%20(2008).mkv" -> "Big Buck Bunny (2008)"
export function titleFromUrl(url) {
  var path = pathOf(url).replace(/^[a-z]+:\/\/[^\/]*/i, '');
  var name = path.replace(/\/+$/, '').split('/').pop() || '';
  try {
    name = decodeURIComponent(name);
  } catch (e) {
    // Keep the raw name.
  }
  name = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name || hostOf(url);
}

export function cleanText(text, max) {
  var value = (text || '').replace(/\s+/g, ' ').trim();
  var limit = max || 90;
  return value.length > limit ? value.slice(0, limit - 3) + '...' : value;
}

// 75 -> "1:15", 3725 -> "1:02:05"
export function formatTime(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0) return '--:--';
  var total = Math.floor(seconds);
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  var ss = (s < 10 ? '0' : '') + s;
  if (!h) return m + ':' + ss;
  return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
}
