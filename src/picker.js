import { ACCENT } from './config.js';
import { el, focusStyle, hostOf } from './dom.js';
import { STYLE, Z_TOP } from './ui.js';

var R = STYLE.reset;
var BACKDROP = R + 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:' + Z_TOP + ';display:none;' +
  'background:rgba(8,9,12,0.78);';
var CARD = R + 'display:block;width:1100px;margin:120px auto 0;padding:44px 48px 36px;color:#f2f2f5;' +
  'background:#16171d;border:3px solid #3a3d4a;border-radius:18px;';
var HEADING = R + 'display:block;font-size:36px;font-weight:bold;color:#f2f2f5;';
var SUB = R + 'display:block;margin:8px 0 28px;font-size:24px;color:#a9abb8;';
var LIST = R + 'display:block;max-height:560px;overflow:hidden;';
var ITEM = R + 'display:block;width:100%;margin:0 0 14px;padding:18px 26px;text-align:left;cursor:pointer;' +
  'background:#22242c;border:4px solid #22242c;border-radius:12px;';
var ITEM_FOCUS = 'border-color:' + ACCENT + ';background:#2d303b;';
var ITEM_TITLE = R + 'display:block;font-size:30px;color:#f2f2f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
var ITEM_META = R + 'display:block;margin-top:8px;font-size:22px;color:#a9abb8;';
var BADGE = R + 'display:inline-block;margin-right:14px;padding:2px 10px;font-size:18px;font-weight:bold;' +
  'color:#16171d;background:#f2f2f5;border-radius:5px;';
var HINT = R + 'display:block;margin-top:14px;font-size:22px;color:#a9abb8;';

// "Which video?" list, shown when a page has more than one.
export function createPicker(onPick) {
  var list = el('div', { style: LIST });
  var root = el('div', { id: 'tizenshield-picker', style: BACKDROP }, [
    el('div', { style: CARD }, [
      el('div', { style: HEADING, text: 'Videos on this page' }),
      el('div', { style: SUB, text: 'Choose one to play on the TV player.' }),
      list,
      el('div', { style: HINT, text: 'Arrows move, OK plays, Back closes.' })
    ])
  ]);

  function open(videos) {
    if (!root.parentNode) document.documentElement.appendChild(root);
    list.innerHTML = '';
    videos.forEach(function (video) {
      var item = el('button', { type: 'button', onclick: function () { close(); onPick(video); } }, [
        el('span', { style: ITEM_TITLE, text: video.title }),
        el('span', { style: ITEM_META }, [el('span', { style: BADGE, text: video.kind }), hostOf(video.url)])
      ]);
      focusStyle(item, ITEM, ITEM_FOCUS);
      list.appendChild(item);
    });
    root.style.display = 'block';
    list.firstChild.focus();
  }

  function close() {
    root.style.display = 'none';
    if (root.contains(document.activeElement)) document.activeElement.blur();
  }

  return {
    root: root,
    open: open,
    close: close,
    isOpen: function () { return root.style.display === 'block'; }
  };
}
