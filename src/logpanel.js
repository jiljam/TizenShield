import { el } from './dom.js';
import { modalButton } from './modal.js';
import { formatSeconds, pageLogSnapshot, shortUrl } from './pagelog.js';
import { STYLE, Z_TOP } from './ui.js';

// The Page log: a full-screen sheet over the website (inline styles, so
// strict site security policies can't block it). It refreshes every two
// seconds while open, so a page that never finishes loading can be watched.

var REFRESH_MS = 2000;
var SCROLL_STEP = 420;

var KINDS = {
  error: { label: 'ERROR', color: '#ff6b6b' },
  failed: { label: 'FAILED', color: '#ffa94d' },
  slow: { label: 'SLOW', color: '#ffd43b' },
  waiting: { label: 'WAITING', color: '#ffd43b' },
  info: { label: 'INFO', color: '#5c5f6e', text: '#f2f2f5' },
  done: { label: 'LOADED', color: '#69db7c' },
  download: { label: 'FILE', color: '#5c5f6e', text: '#f2f2f5' }
};

var R = STYLE.reset;
var S = {
  backdrop: R + 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:' + Z_TOP + ';display:none;background:rgba(8,9,12,.86);',
  panel: R + 'position:absolute;left:80px;right:80px;top:50px;bottom:50px;display:block;overflow:hidden;color:#f2f2f5;' +
    'background:#16171d;border:3px solid #3a3d4a;border-radius:18px;font-family:sans-serif;',
  head: R + 'position:absolute;left:0;right:0;top:0;height:190px;display:block;padding:30px 44px 0;' +
    'border-bottom:2px solid #2b2d36;font-family:sans-serif;',
  close: R + 'position:absolute;right:44px;top:28px;display:block;',
  title: R + 'display:inline-block;font-size:38px;font-weight:bold;color:#f2f2f5;font-family:sans-serif;',
  host: R + 'display:inline-block;margin-left:22px;font-size:26px;color:#a9abb8;font-family:sans-serif;',
  status: R + 'display:block;margin-top:12px;font-size:24px;color:#c9cbd6;font-family:sans-serif;',
  chips: R + 'display:block;margin-top:16px;',
  chip: R + 'display:inline-block;margin-right:12px;padding:5px 16px;font-size:20px;font-weight:bold;' +
    'border-radius:20px;color:#16171d;font-family:sans-serif;',
  body: R + 'position:absolute;left:0;right:0;top:192px;bottom:62px;display:block;overflow:hidden;padding:0 44px 24px;',
  foot: R + 'position:absolute;left:0;right:0;bottom:0;height:62px;display:block;padding:17px 44px 0;' +
    'font-size:22px;color:#a9abb8;border-top:2px solid #2b2d36;font-family:sans-serif;',
  section: R + 'display:block;margin:26px 0 6px;font-size:21px;font-weight:bold;letter-spacing:1px;color:#a9abb8;font-family:sans-serif;',
  row: R + 'position:relative;display:block;min-height:34px;padding:12px 0 12px 252px;border-bottom:1px solid #24262e;',
  time: R + 'position:absolute;left:0;top:14px;display:block;width:124px;font-size:22px;color:#8a8c99;font-family:sans-serif;',
  tag: R + 'position:absolute;left:124px;top:12px;display:block;width:108px;padding:4px 0;text-align:center;font-size:17px;' +
    'font-weight:bold;border-radius:5px;font-family:sans-serif;',
  text: R + 'display:block;font-size:24px;line-height:1.3;color:#f2f2f5;white-space:nowrap;overflow:hidden;' +
    'text-overflow:ellipsis;font-family:sans-serif;',
  detail: R + 'display:block;margin-top:4px;font-size:20px;line-height:1.3;color:#a9abb8;white-space:nowrap;' +
    'overflow:hidden;text-overflow:ellipsis;font-family:sans-serif;',
  empty: R + 'display:block;padding:14px 0;font-size:22px;color:#8a8c99;font-family:sans-serif;'
};

function seconds(ms) {
  return (ms / 1000).toFixed(1) + ' s';
}

function row(kind, time, text, detail) {
  var style = KINDS[kind];
  var tag = el('span', { style: S.tag, text: style.label });
  tag.style.background = style.color;
  tag.style.color = style.text || '#16171d';
  return el('div', { style: S.row }, [
    el('span', { style: S.time, text: time }),
    tag,
    el('span', { style: S.text, text: text }),
    detail ? el('span', { style: S.detail, text: detail }) : el('span')
  ]);
}

function chip(text, color) {
  var node = el('span', { style: S.chip, text: text });
  node.style.background = color;
  return node;
}

function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

// about() returns { version, engine, fixes } for the status line.
export function createLogPanel(about) {
  var timer = null;
  var hostText = el('span', { style: S.host });
  var status = el('div', { style: S.status });
  var chips = el('div', { style: S.chips });
  var body = el('div', { style: S.body });
  var closeButton = modalButton('Close', close);

  var root = el('div', { id: 'tizenshield-log', style: S.backdrop, role: 'dialog' }, [
    el('div', { style: S.panel }, [
      el('div', { style: S.head }, [
        el('span', { style: S.title, text: 'Page log' }),
        hostText,
        el('div', { style: S.close }, [closeButton]),
        status,
        chips
      ]),
      body,
      el('div', { style: S.foot, text: 'Up / Down: scroll   ·   Back or Green: close   ·   Updates every 2 seconds' })
    ])
  ]);

  function render() {
    var log = pageLogSnapshot();
    var info = about();
    var keepScroll = body.scrollTop;
    hostText.textContent = window.location.hostname;

    var loaded = log.loadedAt !== null
      ? 'Fully loaded in ' + seconds(log.loadedAt)
      : 'Still loading, ' + Math.round(log.now / 1000) + ' s so far';
    status.textContent = loaded + '   ·   TizenShield ' + info.version + '   ·   Chrome ' + info.engine +
      '   ·   TV fixes: ' + info.fixes;

    var counts = { error: 0, failed: 0, slow: 0 };
    log.timeline.forEach(function (entry) { if (counts[entry.kind] !== undefined) counts[entry.kind]++; });
    chips.innerHTML = '';
    if (counts.error) chips.appendChild(chip(plural(counts.error, 'error', 'errors'), KINDS.error.color));
    if (counts.failed) chips.appendChild(chip(plural(counts.failed, 'failed', 'failed'), KINDS.failed.color));
    if (log.waiting.length) chips.appendChild(chip(plural(log.waiting.length, 'request waiting', 'requests waiting'), KINDS.waiting.color));
    if (counts.slow) chips.appendChild(chip(plural(counts.slow, 'slow', 'slow'), KINDS.slow.color));
    if (!chips.firstChild) chips.appendChild(chip('No problems recorded', KINDS.done.color));

    body.innerHTML = '';
    if (log.waiting.length) {
      body.appendChild(el('div', { style: S.section, text: 'STILL WAITING FOR A RESPONSE' }));
      log.waiting.forEach(function (r) {
        body.appendChild(row('waiting', 'for ' + seconds(r.waited), r.kind + ' ' + r.method, shortUrl(r.url, 120)));
      });
    }
    body.appendChild(el('div', { style: S.section, text: 'TIMELINE' }));
    log.timeline.forEach(function (entry) {
      body.appendChild(row(entry.kind, formatSeconds(entry.time), entry.text, entry.detail));
    });
    if (log.dropped) body.appendChild(el('div', { style: S.empty, text: log.dropped + ' more events not shown' }));
    body.appendChild(el('div', { style: S.section, text: 'SLOWEST DOWNLOADS' }));
    if (!log.slowest.length) body.appendChild(el('div', { style: S.empty, text: 'None recorded yet.' }));
    log.slowest.forEach(function (d) {
      body.appendChild(row('download', seconds(d.duration), shortUrl(d.url, 120), d.type));
    });
    body.scrollTop = keepScroll;
  }

  function open() {
    if (!root.parentNode) document.documentElement.appendChild(root);
    render();
    body.scrollTop = 0;
    root.style.display = 'block';
    closeButton.focus();
    clearInterval(timer);
    timer = setInterval(render, REFRESH_MS);
  }

  function close() {
    clearInterval(timer);
    timer = null;
    root.style.display = 'none';
    if (root.contains(document.activeElement)) document.activeElement.blur();
  }

  return {
    root: root,
    open: open,
    close: close,
    isOpen: function () { return root.style.display === 'block'; },
    scroll: function (direction) { body.scrollTop += direction * SCROLL_STEP; }
  };
}
