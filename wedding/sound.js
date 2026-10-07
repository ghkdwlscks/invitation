/* 예식장과 신혼여행 게임의 배경음악. 한 번에 한 곡만 나오고, 소리 버튼을 끄면 모든 곡이 멈춘다.
   청첩장으로 돌아가 있는 동안에는 청첩장(main.js)이 suspend(true)로 멈춰 둔다. */
(() => {
  'use strict';

  const TRACKS = {
    hall: '../assets/audio/wedding-march.mp3',
    safari: '../assets/audio/circle-of-life.mp3',
    zanzibar: '../assets/audio/under-the-sea.mp3'
  };
  const players = {};
  const buttons = new Set();
  let current = null;
  // 끈 상태는 청첩장과 같은 설정으로 이 기기에 기억한다
  const MUTE_KEY = 'wedding-music-muted';
  const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; } };
  let muted = readMuted();
  let suspended = false;
  let rateTimer = 0;
  const shutter = new Audio('../assets/audio/shutter.mp3');
  shutter.preload = 'auto';
  shutter.volume = .8;

  // 재생 속도를 rate까지 부드럽게 바꾼다(음 높이는 그대로 두고 빠르기만 바뀐다)
  function rampRate(audio, rate, duration) {
    clearInterval(rateTimer);
    const start = audio.playbackRate;
    const began = performance.now();
    rateTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - began) / duration);
      audio.playbackRate = start + (rate - start) * t;
      if (t === 1) clearInterval(rateTimer);
    }, 50);
  }

  function player(name) {
    if (!players[name]) {
      const audio = new Audio(TRACKS[name]);
      audio.loop = true;
      audio.volume = .55;
      audio.preload = 'none';
      players[name] = audio;
    }
    return players[name];
  }

  function refresh() {
    for (const [name, audio] of Object.entries(players)) {
      if (name !== current || muted || suspended) audio.pause();
    }
    if (current && !muted && !suspended) {
      // 브라우저가 막으면 다음 터치 때 다시 시도한다
      player(current).play().catch(() => document.addEventListener('pointerdown', refresh, {once: true}));
    }
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(!muted));
      button.setAttribute('aria-label', muted ? '배경음악 켜기' : '배경음악 끄기');
    });
  }

  window.WEDDING_SOUND = {
    play(name) {
      if (name === current) return;
      current = name;
      refresh();
    },
    // 게임을 시작하거나 다시 시작할 때: 그 곡을 처음부터, 원래 빠르기(1.0)로 튼다
    restart(name) {
      clearInterval(rateTimer);
      const audio = player(name);
      audio.playbackRate = 1;
      audio.currentTime = 0;
      current = name;
      refresh();
    },
    // 보너스 구간: 지금 곡을 1.2배로 서서히 빠르게
    hurry() {
      if (current) rampRate(player(current), 1.2, 1200);
    },
    // 게임이 끝나면 음악을 멈추고 찰칵 소리와 함께 여행 사진을 보여 준다
    finish(withShutter = true) {
      clearInterval(rateTimer);
      current = null;
      refresh();
      if (withShutter && !muted && !suspended) {
        shutter.currentTime = 0;
        shutter.play().catch(() => {});
      }
    },
    suspend(value) {
      suspended = value;
      muted = readMuted();
      refresh();
    },
    bind(button) {
      buttons.add(button);
      button.addEventListener('click', () => {
        muted = !muted;
        try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (_) { /* 이번 방문 동안만 기억한다. */ }
        refresh();
      });
      refresh();
    }
  };
})();
