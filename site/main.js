(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 사진 뷰어·예식장 창. 사진 뷰어는 휴대폰 뒤로가기로도 닫힌다. */
  const layers = [];

  function openLayer(element, { useHistory = true } = {}) {
    if (layers.some(layer => layer.element === element)) return;
    layers.push({ element, useHistory, opener: document.activeElement, scrollY: window.scrollY });
    element.hidden = false;
    document.documentElement.classList.add('has-layer');
    if (useHistory) history.pushState({ layer: layers.length }, '');
    element.focus({ preventScroll: true });
  }

  function closeTopLayer() {
    const layer = layers.pop();
    if (!layer) return;
    layer.element.hidden = true;
    if (!layers.length) document.documentElement.classList.remove('has-layer');
    // 창을 열기 전에 보던 곳으로 돌아간다
    window.scrollTo(0, layer.scrollY);
    if (layer.element === weddingOverlay) {
      weddingFrame.contentWindow?.WEDDING_SOUND?.suspend(true);
      resumeBgm();
    }
    if (layer.opener && typeof layer.opener.focus === 'function') layer.opener.focus({ preventScroll: true });
  }

  function requestCloseTopLayer() {
    const layer = layers[layers.length - 1];
    if (!layer) return;
    if (!layer.useHistory) closeTopLayer();
    else if (layer.element === weddingOverlay) {
      // 예식장 안에서 연 창(게임·결과창)의 기록까지 한 번에 돌아간다
      history.go(-1 - (weddingFrame.contentWindow?.WEDDING_BACK?.depth() || 0));
    } else history.back();
  }

  window.addEventListener('popstate', () => {
    const layer = layers[layers.length - 1];
    if (layer && layer.useHistory) closeTopLayer();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-layer]')) requestCloseTopLayer();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') requestCloseTopLayer();
  });

  /* 복사 */
  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) { /* 아래 방식으로 다시 시도한다. */ }
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { /* 실패하면 직접 복사를 안내한다. */ }
    field.remove();
    return copied;
  }

  $$('[data-copy]').forEach(button => {
    const label = button.textContent;
    let resetTimer = 0;
    button.addEventListener('click', async () => {
      const copied = await copyText(button.dataset.copy);
      button.textContent = copied ? '복사했어요' : '직접 복사해 주세요';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { button.textContent = label; }, 2200);
    });
  });

  /* 인생네컷 출력: 사진을 다 불러온 뒤에 출력을 시작한다. */
  const hero = $('.fourcut-hero');
  const fourcutImages = $$('.fourcut-print-front img');
  const imagesReady = Promise.all(fourcutImages.map(image => (image.decode ? image.decode() : Promise.resolve()).catch(() => {})));
  const timeout = new Promise(resolve => setTimeout(resolve, 2000));
  Promise.race([imagesReady, timeout]).then(() => {
    requestAnimationFrame(() => hero.classList.add('is-printing'));
  });

  /* 스크롤하면 섹션이 떠오른다. */
  const revealTargets = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    revealTargets.forEach(target => revealObserver.observe(target));
  } else {
    revealTargets.forEach(target => target.classList.add('is-visible'));
  }

  /* D-day: 한국 시간 기준 */
  const countdown = $('#countdown');
  const countdownMessage = $('#countdownMessage');
  const target = Date.parse(countdown.dataset.target);
  const units = Object.fromEntries($$('[data-unit]', countdown).map(element => [element.dataset.unit, element]));
  const koreanDay = time => Math.floor((time + 9 * 3600e3) / 86400e3);
  const pad = value => String(value).padStart(2, '0');
  let lastMessage = '';

  function setMessage(html) {
    if (html === lastMessage) return;
    countdownMessage.innerHTML = html;
    lastMessage = html;
  }

  function tick() {
    const now = Date.now();
    const remaining = target - now;
    if (remaining <= 0) {
      countdown.classList.add('is-over');
      setMessage('진찬 <span class="heart">♥</span> 가현, 저희 결혼했습니다.<br>축복해 주셔서 감사합니다.');
      return;
    }
    const seconds = Math.floor(remaining / 1000);
    units.days.textContent = Math.floor(seconds / 86400);
    units.hours.textContent = pad(Math.floor(seconds / 3600) % 24);
    units.minutes.textContent = pad(Math.floor(seconds / 60) % 60);
    units.seconds.textContent = pad(seconds % 60);
    // 문구의 일수는 위 카운트다운의 DAYS와 같은 값(남은 시간을 하루 단위로 내림)을 쓴다
    const fullDays = Math.floor(seconds / 86400);
    if (koreanDay(target) === koreanDay(now)) setMessage('오늘, 진찬 <span class="heart">♥</span> 가현이 결혼합니다');
    else if (fullDays === 0) setMessage('내일, 진찬 <span class="heart">♥</span> 가현이 결혼합니다');
    else setMessage(`진찬 <span class="heart">♥</span> 가현의 결혼식이 <b>${fullDays}</b>일 남았습니다`);
    setTimeout(tick, 1000 - (now % 1000) + 5);
  }
  tick();

  /* 갤러리와 사진 뷰어 */
  const galleryGrid = $('#galleryGrid');
  const galleryMore = $('#galleryMore');
  const galleryItems = $$('.gallery-item', galleryGrid);
  if ($('.is-extra', galleryGrid)) {
    galleryMore.hidden = false;
    galleryMore.addEventListener('click', () => {
      galleryGrid.classList.add('is-expanded');
      galleryMore.hidden = true;
    });
  }

  const viewer = $('#viewer');
  const viewerTrack = $('#viewerTrack');
  const viewerCount = $('#viewerCount');
  let viewerIndex = 0;

  function buildViewer() {
    if (viewerTrack.childElementCount) return;
    viewerTrack.innerHTML = galleryItems.map((item, index) =>
      `<div class="viewer-slide"><img data-src="${item.dataset.view}" data-full="${item.dataset.full}" alt="사진 ${index + 1}" decoding="async"></div>`).join('');
  }

  function loadAround(index) {
    [index - 1, index, index + 1].forEach(position => {
      const image = viewerTrack.children[position] && viewerTrack.children[position].firstElementChild;
      if (image && !image.src) image.src = image.dataset.src;
    });
  }

  // 보고 있는 사진은 원본을 받아 두었다가 다 받으면 원본으로 바꾼다
  function loadOriginal(index) {
    const image = viewerTrack.children[index] && viewerTrack.children[index].firstElementChild;
    if (!image || image.dataset.original) return;
    image.dataset.original = 'loading';
    const original = new Image();
    original.onload = () => {
      image.src = original.src;
      image.dataset.original = 'done';
    };
    original.onerror = () => { delete image.dataset.original; };
    original.src = image.dataset.full;
  }

  function showViewerIndex(index) {
    viewerIndex = Math.max(0, Math.min(galleryItems.length - 1, index));
    viewerCount.textContent = `${viewerIndex + 1} / ${galleryItems.length}`;
    loadAround(viewerIndex);
    loadOriginal(viewerIndex);
  }

  function scrollViewerTo(index, behavior) {
    viewerTrack.scrollTo({ left: index * viewerTrack.clientWidth, behavior });
    showViewerIndex(index);
  }

  galleryItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      buildViewer();
      openLayer(viewer);
      scrollViewerTo(index, 'instant');
    });
  });

  let scrollFrame = 0;
  viewerTrack.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const index = Math.round(viewerTrack.scrollLeft / viewerTrack.clientWidth);
      if (index !== viewerIndex) showViewerIndex(index);
    });
  }, { passive: true });

  $$('[data-viewer-step]', viewer).forEach(button => {
    button.addEventListener('click', () => scrollViewerTo(viewerIndex + Number(button.dataset.viewerStep), 'smooth'));
  });
  document.addEventListener('keydown', event => {
    if (viewer.hidden) return;
    if (event.key === 'ArrowRight') scrollViewerTo(viewerIndex + 1, 'smooth');
    if (event.key === 'ArrowLeft') scrollViewerTo(viewerIndex - 1, 'smooth');
  });

  /* 티맵: 아이폰에서는 앱을 먼저 열고, 앱이 없으면 웹으로 연다. */
  const tmapLink = $('#tmapLink');
  tmapLink.addEventListener('click', event => {
    if (!/iPhone|iPad/i.test(navigator.userAgent)) return;
    event.preventDefault();
    let appOpened = false;
    document.addEventListener('visibilitychange', () => { if (document.hidden) appOpened = true; }, { once: true });
    setTimeout(() => { if (!appOpened) window.location.href = tmapLink.href; }, 1100);
    const { name, lat, lng } = tmapLink.dataset;
    window.location.href = `tmap://route?rGoName=${encodeURIComponent(name)}&rGoX=${lng}&rGoY=${lat}`;
  });

  /* 온라인 예식장: 처음 들어갈 때 불러온다. */
  const weddingOverlay = $('#weddingOverlay');
  const weddingFrame = $('#weddingFrame');
  $$('[data-open-wedding]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      if (!weddingFrame.getAttribute('src')) weddingFrame.src = weddingFrame.dataset.src;
      // 예식장 안에서는 청첩장 음악을 멈추고 예식장 음악을 이어서 튼다
      shutter.pause();
      bgm.pause();
      weddingFrame.contentWindow?.WEDDING_SOUND?.suspend(false);
      openLayer(weddingOverlay);
    });
  });

  /* 배경음악
     - 첫 인생네컷이 출력될 때 찰칵 소리가 한 번 나고 음악이 이어서 반복된다.
     - 브라우저가 자동재생을 막으면 처음 터치할 때 시작한다. 그때 출력 연출이 이미 끝났으면 찰칵은 생략한다.
     - 끈 상태는 이 기기에 기억해 새로고침·예식장 이동 뒤에도 유지된다(예식장 음악과 같은 설정). */
  const MUTE_KEY = 'wedding-music-muted';
  const bgm = $('#bgm');
  const bgmToggle = $('#bgmToggle');
  const shutter = new Audio('assets/audio/shutter.mp3');
  shutter.preload = 'auto';
  bgm.volume = 0.6;
  shutter.volume = 0.8;
  let bgmStarted = false;
  let printing = false;
  let shutterPlayed = false;

  const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; } };
  const writeMuted = value => { try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch (_) { /* 이번 방문 동안만 기억한다. */ } };
  const inWedding = () => layers.some(layer => layer.element === weddingOverlay);

  function showBgmState() {
    const on = !readMuted();
    bgmToggle.setAttribute('aria-pressed', String(on && !bgm.paused));
    bgmToggle.setAttribute('aria-label', on ? '배경음악 끄기' : '배경음악 켜기');
  }

  function playBgm() {
    if (readMuted() || inWedding()) return;
    if (printing && !shutterPlayed) {
      // 출력 연출 중이면 찰칵 소리를 먼저 내고 끝나면 음악을 튼다
      shutterPlayed = true;
      shutter.play().then(() => {
        bgmStarted = true;
        // 찰칵이 끝나자마자 음악이 이어지도록 소리 없이 미리 열어 둔다(아이폰은 터치한 순간에만 열 수 있다)
        bgm.muted = true;
        bgm.play().then(() => { bgm.pause(); bgm.currentTime = 0; bgm.muted = false; }).catch(() => { bgm.muted = false; });
      }).catch(() => { shutterPlayed = false; });
      return;
    }
    bgm.play().then(() => { bgmStarted = true; }).catch(() => {});
  }

  function resumeBgm() {
    showBgmState();
    // 예식장에서 음악을 켜고 돌아왔다면 청첩장 음악도 이어서 튼다
    if (bgmStarted || !readMuted()) playBgm();
  }

  shutter.addEventListener('ended', () => {
    if (!readMuted() && !inWedding()) bgm.play().catch(() => {});
  });
  hero.addEventListener('animationstart', event => {
    if (event.animationName !== 'printFeed' || printing || shutterPlayed) return;
    printing = true;
    setTimeout(() => { printing = false; }, 1600);
    playBgm();
  });
  // 움직임 줄이기 설정에서는 출력 연출이 없으니 음악만 바로 시도한다
  if (reducedMotion) playBgm();
  bgm.addEventListener('play', showBgmState);
  bgm.addEventListener('pause', showBgmState);
  bgmToggle.addEventListener('click', () => {
    const turnOn = readMuted();
    writeMuted(!turnOn);
    if (turnOn) {
      shutterPlayed = true;
      bgm.play().then(() => { bgmStarted = true; }).catch(() => {});
    } else {
      shutter.pause();
      bgm.pause();
    }
    showBgmState();
  });
  document.addEventListener('pointerdown', event => {
    if (bgmStarted || event.target.closest('#bgmToggle, [data-open-wedding]')) return;
    playBgm();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { shutter.pause(); bgm.pause(); }
    else resumeBgm();
  });
  showBgmState();
})();
