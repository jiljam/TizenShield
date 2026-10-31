import { ACCENT } from './config.js';
import { el, focusStyle, hostOf } from './dom.js';
import { MODAL, createModal } from './modal.js';
import { STYLE } from './ui.js';

var R = STYLE.reset;
var LIST = R + 'display:block;max-height:560px;overflow:hidden;';
var ITEM = R + 'display:block;width:100%;margin:0 0 14px;padding:18px 26px;text-align:left;cursor:pointer;' +
  'background:#22242c;border:4px solid #22242c;border-radius:12px;';
var ITEM_FOCUS = 'border-color:' + ACCENT + ';background:#2d303b;';
var ITEM_TITLE = R + 'display:block;font-size:30px;color:#f2f2f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
var ITEM_META = R + 'display:block;margin-top:8px;font-size:22px;color:#a9abb8;';
var BADGE = R + 'display:inline-block;margin-right:14px;padding:2px 10px;font-size:18px;font-weight:bold;' +
  'color:#16171d;background:#f2f2f5;border-radius:5px;';

// "Which video?" list, shown when a page has more than one.
export function createPicker(onPick) {
  var modal = createModal('tizenshield-picker', false);
  var list = el('div', { style: LIST });
  modal.card.appendChild(el('div', { style: MODAL.heading, text: 'Videos on this page' }));
  modal.card.appendChild(el('div', { style: MODAL.sub, text: 'Choose one to play on the TV player.' }));
  modal.card.appendChild(list);
  modal.card.appendChild(el('div', { style: MODAL.hint, text: 'Arrows move, OK plays, Back closes.' }));

  function open(videos) {
    list.innerHTML = '';
    videos.forEach(function (video) {
      var item = el('button', { type: 'button', onclick: function () { modal.close(); onPick(video); } }, [
        el('span', { style: ITEM_TITLE, text: video.title }),
        el('span', { style: ITEM_META }, [el('span', { style: BADGE, text: video.kind }), hostOf(video.url)])
      ]);
      focusStyle(item, ITEM, ITEM_FOCUS);
      list.appendChild(item);
    });
    modal.open(list.firstChild);
  }

  return {
    root: modal.root,
    open: open,
    close: modal.close,
    isOpen: modal.isOpen
  };
}
