import { ACCENT } from './config.js';
import { el, hostOf } from './dom.js';
import { DIRECTION, KEY, keyOf, swallow } from './keys.js';
import { move } from './spatialnav.js';
import { addHistory, getPosition, savePosition } from './storage.js';
import { toast } from './ui.js';
import { isWebUrl } from './url.js';
import { formatTime, titleFromUrl, videoKind } from './video.js';

// Full-screen player on the start page. It hands the URL to a plain <video>
// element, which on Samsung TVs is backed by the hardware decoder: that's what
// lets it play MKV/MP4 with H.264, HEVC and AC3 that desktop browsers can't.

var HIDE_CONTROLS_MS = 5000;
var SEEK_COMMIT_MS = 600; // batch rapid presses into one seek: TVs seek slowly
var SAVE_EVERY_MS = 10000;
var RESUME_MARGIN_S = 30; // no resume point in the first or last 30 s
var SPINNER_DELAY_MS = 300;
var STEP_BACK_S = 10;
var STEP_FORWARD_S = 30;
var SPACE = 32;

var ERRORS = {
  1: 'Playback was stopped before the video loaded.',
  2: "The video couldn't be downloaded. The link may have expired, or the site only lets its videos play on its own page.",
  3: "The TV couldn't decode this video.",
  4: "The TV doesn't support this video's format, or the link isn't a video."
};

// Chrome 47-safe: no grid, flex gap, custom properties, or flex on <button>.
export var PLAYER_CSS = [
  '.ts-player{position:fixed;left:0;top:0;right:0;bottom:0;z-index:10;overflow:hidden;background:#000;color:#f2f2f5}',
  '.ts-video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;background:#000}',
  '.ts-p-top,.ts-p-bottom{position:absolute;left:0;right:0;transition:opacity .3s}',
  // Scrims strong enough to keep text readable over bright scenes.
  '.ts-p-top{top:0;padding:48px 96px 140px;background:linear-gradient(rgba(0,0,0,.88),rgba(0,0,0,.55) 55%,rgba(0,0,0,0))}',
  '.ts-p-bottom{bottom:0;padding:170px 96px 44px;' +
    'background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.78) 42%,rgba(0,0,0,.95))}',
  '.ts-p-top,.ts-p-times,.ts-p-hint{text-shadow:0 2px 6px rgba(0,0,0,.85)}',
  '.ts-p-idle .ts-p-top,.ts-p-idle .ts-p-bottom{opacity:0}',
  '.ts-p-title{font-size:46px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.ts-p-meta{margin-top:12px;font-size:24px;color:#c9cbd6}',
  '.ts-p-badge{display:inline-block;margin-right:16px;padding:3px 12px;font-size:20px;font-weight:bold;' +
    'color:#16171d;background:#f2f2f5;border-radius:6px;vertical-align:2px;text-shadow:none}',
  '.ts-p-bar-wrap{padding:18px 0;outline:none}',
  '.ts-p-bar{position:relative;height:8px;border-radius:7px;background:rgba(255,255,255,.25);transition:height .15s}',
  '.ts-p-bar-wrap:focus .ts-p-bar{height:14px}',
  '.ts-p-buffered,.ts-p-played{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:7px}',
  '.ts-p-buffered{background:rgba(255,255,255,.35)}',
  '.ts-p-played{background:' + ACCENT + '}',
  '.ts-p-knob{position:absolute;left:0;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;' +
    'background:#fff;box-shadow:0 0 0 7px rgba(251,84,43,.5);opacity:0;transition:opacity .15s}',
  '.ts-p-bar-wrap:focus .ts-p-knob{opacity:1}',
  '.ts-p-live .ts-p-knob{display:none}',
  '.ts-p-times{overflow:hidden;font-size:26px;color:#e6e7ee}',
  '.ts-p-times span:last-child{float:right}',
  '.ts-p-controls{margin-top:26px;white-space:nowrap}',
  '.ts-p-btn{display:inline-block;vertical-align:middle;box-sizing:border-box;height:88px;min-width:120px;margin-right:22px;' +
    'padding:0 30px;line-height:80px;text-align:center;font-family:sans-serif;font-size:28px;font-weight:bold;' +
    'color:#f2f2f5;background:rgba(18,19,24,.82);border:4px solid rgba(255,255,255,.22);border-radius:44px;outline:none}',
  '.ts-p-btn:focus{border-color:' + ACCENT + ';background:rgba(46,48,58,.96)}',
  '.ts-p-btn-main{width:112px;min-width:0;height:112px;padding:0;line-height:104px;border-radius:56px;background:#f2f2f5}',
  '.ts-p-btn-main:focus{background:#fff;border-color:' + ACCENT + ';box-shadow:0 0 0 6px rgba(251,84,43,.45)}',
  '.ts-p-right{float:right}',
  '.ts-p-right .ts-p-btn{margin:12px 0 0 22px}',
  '.ts-p-icon{display:inline-block;vertical-align:middle;width:0;height:0;margin-left:9px;border-style:solid;' +
    'border-width:20px 0 20px 34px;border-color:transparent transparent transparent #16171d}',
  '.ts-p-playing .ts-p-icon{width:12px;height:40px;margin-left:0;border-width:0 12px;border-color:#16171d}',
  '.ts-p-hint{margin-top:24px;font-size:22px;color:#c9cbd6}',
  '.ts-p-hint>span{margin-right:48px}',
  '.ts-p-key{display:inline-block;margin-right:10px;padding:0 10px;font-size:19px;font-weight:bold;line-height:30px;' +
    'color:#fff;border:2px solid rgba(255,255,255,.6);border-radius:7px;text-shadow:none}',
  '.ts-p-spinner{display:none;position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;' +
    'box-sizing:border-box;border:9px solid rgba(255,255,255,.2);border-top-color:' + ACCENT + ';border-radius:50%;' +
    'animation:ts-spin .9s linear infinite}',
  '.ts-p-loading .ts-p-spinner{display:block}',
  '@keyframes ts-spin{to{transform:rotate(360deg)}}',
  '.ts-p-flash{position:absolute;left:50%;top:50%;width:320px;margin:-60px 0 0 -160px;padding:22px 0;text-align:center;' +
    'font-size:44px;font-weight:bold;background:rgba(0,0,0,.65);border-radius:60px;opacity:0}',
  '.ts-p-flash.ts-show{animation:ts-flash 1s ease-out}',
  '@keyframes ts-flash{0%{opacity:1}65%{opacity:1}100%{opacity:0}}',
  '.ts-p-error{display:none;position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(8,9,12,.88)}',
  '.ts-p-failed .ts-p-error{display:block}',
  '.ts-p-failed .ts-p-top,.ts-p-failed .ts-p-bottom,.ts-p-failed .ts-p-spinner{display:none}',
  '.ts-p-error-card{width:1100px;margin:210px auto 0;padding:52px 60px;background:#16171d;' +
    'border:3px solid #3a3d4a;border-top:6px solid ' + ACCENT + ';border-radius:18px}',
  '.ts-p-error h2{margin:0 0 20px;font-size:42px}',
  '.ts-p-error p{margin:0 0 16px;font-size:28px;line-height:1.4}',
  '.ts-p-error .ts-p-tip{margin-bottom:36px;font-size:24px;color:#a9abb8}',
  '.ts-p-error .ts-p-btn{background:#2b2d36}',
  '.ts-p-error .ts-p-btn:focus{background:#3b3e4c}'
].join('\n');

// params: play (URL), title, from (page the video was found on).
// nav: exit() leaves the player, home() goes to the start page.
export function showPlayer(params, nav) {
  var url = params.play;
  // History entries are titled "Video: ...", and can be replayed from Recent.
  var title = (params.title || '').replace(/^Video: /, '') || titleFromUrl(url);
  var from = isWebUrl(params.from || '') ? params.from : '';
  addHistory(url, 'Video: ' + title);

  var failed = false;
  var destroyed = false;
  var pendingSeek = null;
  var timers = { hide: 0, seek: 0, spinner: 0 };
  var lastSave = Date.now();

  function button(cls, text, onclick, label) {
    return el('button', { type: 'button', 'class': 'ts-p-btn ' + cls, text: text, 'aria-label': label || text, onclick: onclick });
  }

  function hint(key, action) {
    return el('span', {}, [el('span', { 'class': 'ts-p-key', text: key }), action]);
  }

  var video = el('video', { 'class': 'ts-video', preload: 'auto' });
  var played = el('div', { 'class': 'ts-p-played' });
  var buffered = el('div', { 'class': 'ts-p-buffered' });
  var knob = el('div', { 'class': 'ts-p-knob' });
  var bar = el('div', { 'class': 'ts-p-bar-wrap', tabindex: '0', role: 'slider', 'aria-label': 'Position' }, [
    el('div', { 'class': 'ts-p-bar' }, [buffered, played, knob])
  ]);
  var timeNow = el('span', { text: '0:00' });
  var timeTotal = el('span', { text: '--:--' });
  var playButton = button('ts-p-btn-main', '', function () { togglePlay(); }, 'Play or pause');
  playButton.appendChild(el('span', { 'class': 'ts-p-icon' }));
  var audioButton = button('', '', cycleAudio, 'Audio track');
  var audioHint = hint('Yellow', 'Audio track');
  audioButton.style.display = 'none';
  audioHint.style.display = 'none';
  var controls = el('div', { 'class': 'ts-p-controls' }, [
    button('', '-' + STEP_BACK_S + 's', function () { seekBy(-STEP_BACK_S); }, 'Back ' + STEP_BACK_S + ' seconds'),
    playButton,
    button('', '+' + STEP_FORWARD_S + 's', function () { seekBy(STEP_FORWARD_S); }, 'Forward ' + STEP_FORWARD_S + ' seconds'),
    el('div', { 'class': 'ts-p-right' }, [audioButton, button('', 'Close', close)])
  ]);
  var flashNode = el('div', { 'class': 'ts-p-flash' });
  var errorText = el('p');
  var retryButton = button('', 'Try again', retry);
  var errorBox = el('div', { 'class': 'ts-p-error' }, [
    el('div', { 'class': 'ts-p-error-card' }, [
      el('h2', { text: "This video can't play on the TV" }),
      errorText,
      el('p', {
        'class': 'ts-p-tip',
        text: 'Videos play best as MP4 or MKV files with H.264 or HEVC video and AAC or AC3 audio.'
      }),
      el('div', {}, [retryButton, button('', 'Back', close)])
    ])
  ]);
  var root = el('div', { 'class': 'ts-player ts-p-loading' }, [
    video,
    el('div', { 'class': 'ts-p-spinner' }),
    flashNode,
    el('div', { 'class': 'ts-p-top' }, [
      el('div', { 'class': 'ts-p-title', text: title }),
      el('div', { 'class': 'ts-p-meta' }, [el('span', { 'class': 'ts-p-badge', text: videoKind(url) }), 'from ' + hostOf(from || url)])
    ]),
    el('div', { 'class': 'ts-p-bottom' }, [
      bar,
      el('div', { 'class': 'ts-p-times' }, [timeNow, timeTotal]),
      controls,
      el('div', { 'class': 'ts-p-hint' }, [
        hint('OK', 'Play / pause'),
        hint('Left / Right', 'Skip -' + STEP_BACK_S + 's / +' + STEP_FORWARD_S + 's'),
        hint('Back', 'Close'),
        audioHint
      ])
    ]),
    errorBox
  ]);

  var handlers = {
    loadedmetadata: function () {
      root.classList.toggle('ts-p-live', !isFinite(video.duration));
      renderProgress(video.currentTime);
      updateAudio();
      var saved = getPosition(url);
      if (saved && isFinite(video.duration) && saved < video.duration - RESUME_MARGIN_S) {
        video.currentTime = saved;
        toast('Resuming at ' + formatTime(saved) + '.');
      }
    },
    timeupdate: function () {
      if (pendingSeek === null) renderProgress(video.currentTime);
      if (Date.now() - lastSave > SAVE_EVERY_MS) savePlace();
    },
    progress: renderBuffered,
    waiting: function () { setLoading(true); },
    seeking: function () { setLoading(true); },
    playing: function () { setLoading(false); },
    canplay: function () { setLoading(false); },
    seeked: function () { setLoading(false); },
    play: function () {
      root.classList.add('ts-p-playing');
      scheduleHide();
    },
    pause: function () {
      root.classList.remove('ts-p-playing');
      savePlace();
      showControls();
    },
    ended: function () {
      savePosition(url, 0);
      showControls();
    },
    error: function () {
      failed = true;
      setLoading(false);
      var error = video.error;
      errorText.textContent = (error && ERRORS[error.code]) || 'Something went wrong while playing this video.';
      root.classList.add('ts-p-failed');
      retryButton.focus();
    }
  };

  document.body.appendChild(root);
  Object.keys(handlers).forEach(function (type) {
    video.addEventListener(type, function () { if (!destroyed) handlers[type](); });
  });
  window.addEventListener('keydown', onKey, true);
  video.src = url;
  play();
  bar.focus();

  function play() {
    var result = video.play();
    // Chrome 47 returns nothing; newer engines return a promise that rejects
    // when autoplay is refused, in which case the user presses OK.
    if (result && result.catch) result.catch(function () { showControls(); });
  }

  function togglePlay() {
    if (video.ended) video.currentTime = 0;
    if (video.paused) play();
    else video.pause();
    showControls();
  }

  function retry() {
    failed = false;
    root.classList.remove('ts-p-failed');
    root.classList.add('ts-p-loading');
    video.src = url;
    play();
    bar.focus();
  }

  function close() {
    nav.exit();
  }

  function seekBy(delta) {
    if (!isFinite(video.duration)) {
      flash('Live');
      return;
    }
    var base = pendingSeek !== null ? pendingSeek : video.currentTime;
    pendingSeek = Math.max(0, Math.min(base + delta, video.duration - 1));
    renderProgress(pendingSeek);
    flash((delta > 0 ? '» ' : '« ') + formatTime(pendingSeek));
    clearTimeout(timers.seek);
    timers.seek = setTimeout(function () {
      // Servers without HTTP range support only allow what's downloaded.
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
      played.style.width = '100%';
      timeNow.textContent = formatTime(time);
      timeTotal.textContent = 'LIVE';
      return;
    }
    var percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
    played.style.width = percent + '%';
    knob.style.left = percent + '%';
    timeNow.textContent = formatTime(time);
    timeTotal.textContent = formatTime(duration);
  }

  function renderBuffered() {
    var ranges = video.buffered;
    if (!ranges.length || !isFinite(video.duration) || !video.duration) return;
    buffered.style.width = Math.min(100, (ranges.end(ranges.length - 1) / video.duration) * 100) + '%';
  }

  // The spinner only appears if loading takes a moment, to avoid flicker.
  function setLoading(on) {
    clearTimeout(timers.spinner);
    if (!on) root.classList.remove('ts-p-loading');
    else timers.spinner = setTimeout(function () { root.classList.add('ts-p-loading'); }, SPINNER_DELAY_MS);
  }

  function flash(text) {
    flashNode.textContent = text;
    flashNode.classList.remove('ts-show');
    void flashNode.offsetWidth; // restart the animation
    flashNode.classList.add('ts-show');
  }

  function isIdle() {
    return root.classList.contains('ts-p-idle');
  }

  function showControls() {
    root.classList.remove('ts-p-idle');
    scheduleHide();
  }

  function scheduleHide() {
    clearTimeout(timers.hide);
    if (!video.paused) timers.hide = setTimeout(hideControls, HIDE_CONTROLS_MS);
  }

  function hideControls() {
    if (video.paused || failed) return;
    root.classList.add('ts-p-idle');
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
    return track.label || track.language || 'Track ' + (index + 1);
  }

  function updateAudio() {
    var tracks = audioTracks();
    audioButton.style.display = tracks ? '' : 'none';
    audioHint.style.display = tracks ? '' : 'none';
    if (!tracks) return;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].enabled) audioButton.textContent = 'Audio: ' + trackName(tracks[i], i);
    }
  }

  function cycleAudio() {
    var tracks = audioTracks();
    if (!tracks) {
      toast('This video has only one audio track.');
      return;
    }
    var current = 0;
    for (var i = 0; i < tracks.length; i++) if (tracks[i].enabled) current = i;
    var next = (current + 1) % tracks.length;
    for (var j = 0; j < tracks.length; j++) tracks[j].enabled = j === next;
    updateAudio();
    toast('Audio: ' + trackName(tracks[next], next));
  }

  function onKey(event) {
    var key = event.keyCode === SPACE ? KEY.PLAY_PAUSE : keyOf(event);
    var dir = DIRECTION[key];
    if (failed) {
      if (key === KEY.BACK) { swallow(event); close(); }
      else if (dir) { swallow(event); move(dir, { scope: errorBox }); }
      return;
    }

    switch (key) {
      case KEY.PLAY_PAUSE: swallow(event); togglePlay(); return;
      case KEY.PLAY: swallow(event); play(); showControls(); return;
      case KEY.PAUSE: swallow(event); video.pause(); return;
      case KEY.STOP: swallow(event); close(); return;
      case KEY.FAST_FORWARD: swallow(event); seekBy(STEP_FORWARD_S); return;
      case KEY.REWIND: swallow(event); seekBy(-STEP_BACK_S); return;
      case KEY.RED: swallow(event); nav.home(); return;
      case KEY.YELLOW: swallow(event); cycleAudio(); return;
      case KEY.GREEN: case KEY.BLUE: swallow(event); showControls(); return;
      case KEY.BACK:
        swallow(event);
        // First Back hides the controls during playback; otherwise it leaves.
        if (!isIdle() && !video.paused) hideControls();
        else close();
        return;
    }

    if (isIdle()) {
      if (!dir && key !== KEY.ENTER) return;
      swallow(event);
      showControls();
      bar.focus();
      if (dir === 'left') seekBy(-STEP_BACK_S);
      else if (dir === 'right') seekBy(STEP_FORWARD_S);
      else if (key === KEY.ENTER) togglePlay();
      return;
    }

    showControls();
    var active = document.activeElement;
    if (active === bar || !root.contains(active)) {
      if (dir === 'left') { swallow(event); seekBy(-STEP_BACK_S); }
      else if (dir === 'right') { swallow(event); seekBy(STEP_FORWARD_S); }
      else if (dir === 'down') { swallow(event); playButton.focus(); }
      else if (dir === 'up') swallow(event);
      else if (key === KEY.ENTER) { swallow(event); togglePlay(); }
      return;
    }
    if (dir === 'up') { swallow(event); bar.focus(); return; }
    if (dir) { swallow(event); move(dir, { scope: controls }); }
    // OK on a button falls through to its click handler.
  }

  return {
    destroy: function () {
      if (!failed) savePlace();
      destroyed = true;
      Object.keys(timers).forEach(function (name) { clearTimeout(timers[name]); });
      window.removeEventListener('keydown', onKey, true);
      // Release the TV's hardware decoder right away; it can't run two videos.
      video.pause();
      video.removeAttribute('src');
      video.load();
      root.parentNode.removeChild(root);
    }
  };
}
