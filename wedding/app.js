/* 온라인 예식장 화면. 하객 목록·착석·당첨 판정은 store.js(WEDDING_STORE)를 거친다. 내 정보는 이 브라우저에도 남긴다. */
(() => {
  'use strict';

  const STORAGE_KEY = 'wedding-hall-guest-v4';
  const DRAFT_KEY = 'wedding-hall-draft-v1';
  const GUEST_ID_KEY = 'wedding-guest-id';
  // 통로 양옆에 6석씩 16줄(192석). 옆자리는 촘촘히 붙이고, 이름표가 뒷줄 미니미에 가리지 않도록 줄 간격은 넉넉히 두었다
  const WORLD_WIDTH = 836;
  const WORLD_HEIGHT = 1376;
  const SEAT_GAP = 56;
  const ROW_GAP = 64;
  const ROWS = 16;
  const COLUMNS = 12;
  const SEAT_DISTANCE = 82;
  const TAP_SLOP = 8;
  const MOVE_SPEED = 205;
  const MAX_ZOOM = 2;
  const MINIMI = window.MINIMI;
  const STORE = window.WEDDING_STORE;
  const REFRESH_INTERVAL = 30000;

  const $ = selector => document.querySelector(selector);
  const world = $('#venue-world');
  const venue = $('#venue');
  const layer = $('#seat-layer');
  const playerElement = $('#player');
  const bubble = $('#speech-bubble');
  const joystick = $('#joystick');
  const thumb = $('#joystick-thumb');
  const sitButton = $('#sit-button');
  const status = $('#status-pill');
  const coupleBubble = $('#couple-message');
  const resultDialog = $('#result-dialog');
  const prizeForm = $('#prize-form');
  const entryDialog = $('#entry-card');
  const guestbookBoard = $('#guestbook-board');
  const guestbookFeed = $('#guestbook-feed');
  const seats = [];
  const occupied = new Map();
  const keys = new Set();
  // 두 분 전용 주소(wedding/?game): 하객 등록·착석 없이 신혼여행 게임만 한다. 이 기기의 하객 기록은 쓰지 않고, 점수는 하객 순위에 올리지 않는다
  const COUPLE = new URLSearchParams(location.search).has('game');
  const COUPLE_PLAYER = {name: '신랑신부', guestId: 'couple', unranked: true};
  let guest = COUPLE ? null : readGuest();
  let avatarDraft = MINIMI.normalize();
  let position = {x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 55};
  let stick = {x: 0, y: 0};
  let activePointer = null;
  let nearestSeat = null;
  let lastTime = 0;
  let cameraX = 0;
  let cameraY = 0;
  let zoom = 1;
  let pointerGesture = null;
  let pinch = null;
  const touches = new Map();
  let walkTarget = null;
  let walkSpeed = 0;
  let cameraFollow = true;
  let guestsLoaded = false;
  let claiming = false;
  let editingContact = false;
  let toastTimer;
  let focusBeforeDialog;
  let launchGameAfterResult = false;

  const chair = '<svg class="chair" viewBox="0 0 48 52" shape-rendering="crispEdges" aria-hidden="true">'
    + '<rect class="chair-leg" x="9" y="39" width="5" height="11"/><rect class="chair-leg" x="34" y="39" width="5" height="11"/>'
    + '<path class="chair-outline" d="M13 2h22v2h4v3h3v27h-3v3H9v-3H6V7h3V4h4Z"/>'
    + '<path class="chair-back" d="M13 4h22v2h4v3h1v23h-3v3H11v-3H8V9h1V6h4Z"/>'
    + '<path class="chair-seam" d="M14 11h20v2H14Zm-3 2h2v15h-2Zm24 0h2v15h-2Z"/>'
    + '<path class="chair-cushion" d="M7 35h34v2h3v6h-3v3H7v-3H4v-6h3Z"/>'
    + '<path class="chair-highlight" d="M9 38h30v2H9Zm2 3h26v1H11Z"/></svg>';

  function renderHairChoices() {
    const container = $('#hair-options');
    container.replaceChildren();
    for (const group of ['short', 'long']) {
      const section = document.createElement('div');
      section.className = 'hair-group';
      const title = document.createElement('span');
      title.className = 'hair-group-title';
      title.textContent = group === 'short' ? '남자 머리' : '여자 머리';
      const choices = document.createElement('div');
      choices.className = 'hair-group-choices';
      for (const hair of MINIMI.hairs.filter(item => item.group === group)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hair-choice';
        button.dataset.hair = hair.id;
        button.setAttribute('aria-pressed', String(avatarDraft.hair === hair.id));
        button.innerHTML = `${MINIMI.render({...avatarDraft, hair: hair.id, accessory: 'none'})}<span></span>`;
        button.querySelector('span').textContent = hair.label;
        choices.append(button);
      }
      section.append(title, choices);
      container.append(section);
    }
  }

  function renderPalette(container, items, selected, kind) {
    const target = $(container);
    target.replaceChildren();
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-choice';
      button.dataset.colorKind = kind;
      button.dataset.colorId = item.id;
      button.setAttribute('aria-label', item.label);
      button.setAttribute('aria-pressed', String(selected === item.id));
      button.style.setProperty('--swatch', item.hex);
      button.innerHTML = '<i aria-hidden="true"></i><span></span>';
      button.querySelector('span').textContent = item.label;
      target.append(button);
    }
  }

  function renderAccessories() {
    const group = MINIMI.groupOf(avatarDraft.hair);
    $('#accessory-title').textContent = group === 'short' ? '남자 스타일 액세서리' : '여자 스타일 액세서리';
    const container = $('#accessory-options');
    container.replaceChildren();
    for (const item of MINIMI.accessories[group]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'accessory-choice';
      button.dataset.accessory = item.id;
      button.setAttribute('aria-pressed', String(avatarDraft.accessory === item.id));
      // 지금 꾸미는 미니미가 그 액세서리를 한 모습을 잘라서 보여준다
      const icon = item.view
        ? MINIMI.render({...avatarDraft, accessory: item.id}).replace(/viewBox="[^"]*"/, `viewBox="${item.view}"`)
        : '−';
      button.innerHTML = `<i aria-hidden="true">${icon}</i><span></span>`;
      button.querySelector('span').textContent = item.label;
      container.append(button);
    }
  }

  function updateCustomizer() {
    renderHairChoices();
    renderPalette('#hair-colors', MINIMI.colors.hair, avatarDraft.hairColor, 'hairColor');
    renderPalette('#skin-colors', MINIMI.skins, avatarDraft.skin, 'skin');
    renderPalette('#top-colors', MINIMI.colors.top, avatarDraft.top, 'top');
    for (const button of $('#bottom-type-options').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.bottomType === avatarDraft.bottomType));
    }
    renderPalette('#bottom-colors', MINIMI.colors[avatarDraft.bottomType], avatarDraft[avatarDraft.bottomType], avatarDraft.bottomType);
    renderAccessories();
    $('#avatar-preview').innerHTML = MINIMI.render(avatarDraft);
    const hair = MINIMI.hairs.find(item => item.id === avatarDraft.hair).label;
    const top = MINIMI.colors.top.find(item => item.id === avatarDraft.top).label;
    const bottom = MINIMI.colors[avatarDraft.bottomType].find(item => item.id === avatarDraft[avatarDraft.bottomType]).label;
    $('#style-summary').textContent = `${hair} · ${top} 상의 · ${bottom} ${avatarDraft.bottomType === 'pants' ? '바지' : '치마'}`;
    saveDraft();
  }

  function randomAvatar(group) {
    const random = items => items[Math.floor(Math.random() * items.length)].id;
    return MINIMI.normalize({
      hair: random(MINIMI.hairs.filter(item => item.group === group)),
      hairColor: random(MINIMI.colors.hair),
      skin: random(MINIMI.skins),
      top: random(MINIMI.colors.top),
      bottomType: group === 'short' ? 'pants' : Math.random() < .5 ? 'pants' : 'skirt',
      pants: random(MINIMI.colors.pants),
      skirt: random(MINIMI.colors.skirt),
      accessory: random(MINIMI.accessories[group].filter(item => item.id !== 'none'))
    });
  }

  function setupCustomizer() {
    $('#guest-form').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.type === 'submit') return;
      if (button.dataset.randomStyle) {
        avatarDraft = randomAvatar(button.dataset.randomStyle);
        updateCustomizer();
        return;
      }
      if (button.dataset.hair) avatarDraft.hair = button.dataset.hair;
      if (button.dataset.colorKind) avatarDraft[button.dataset.colorKind] = button.dataset.colorId;
      if (button.dataset.bottomType) avatarDraft.bottomType = button.dataset.bottomType;
      if (button.dataset.accessory) avatarDraft.accessory = button.dataset.accessory;
      avatarDraft = MINIMI.normalize(avatarDraft);
      updateCustomizer();
    });
    const draft = guest ? null : readDraft();
    if (draft) {
      $('#guest-name').value = String(draft.name || '').slice(0, 12);
      $('#guest-message').value = String(draft.message || '').slice(0, 120);
      avatarDraft = MINIMI.normalize(draft.avatar || {});
    } else if (!guest) {
      avatarDraft = randomAvatar(Math.random() < .5 ? 'short' : 'long');
    }
    for (const field of ['#guest-name', '#guest-message']) {
      $(field).addEventListener('input', saveDraft);
      // 휴대폰 키보드가 올라와도 쓰고 있는 칸이 가려지지 않게 한다
      $(field).addEventListener('focus', () => setTimeout(() => $(field).scrollIntoView({block: 'center'}), 350));
    }
    window.addEventListener('resize', () => {
      const field = document.activeElement;
      if (field && /^(INPUT|TEXTAREA)$/.test(field.tagName)) field.scrollIntoView({block: 'center'});
    });
    const countMessage = () => { $('#message-count').textContent = `${$('#guest-message').value.length} / 120자`; };
    $('#guest-message').addEventListener('input', countMessage);
    countMessage();
    updateCustomizer();
  }

  // 이 기기의 하객 번호: 연타·재시도를 같은 사람의 요청으로 알아보는 데 쓴다
  function deviceGuestId() {
    try {
      const saved = localStorage.getItem(GUEST_ID_KEY);
      if (saved) return saved;
    } catch (_) { /* 저장소를 못 쓰면 이번 방문 동안만 쓴다. */ }
    const id = window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem(GUEST_ID_KEY, id); } catch (_) { /* 위와 같다. */ }
    return id;
  }

  function readGuest() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (value && typeof value.name === 'string' && typeof value.message === 'string' && value.avatar && typeof value.avatar === 'object') {
        value.avatar = MINIMI.normalize(value.avatar);
        value.guestId = value.guestId || deviceGuestId();
        return value;
      }
    } catch (_) { /* 사생활 보호 모드 등에서는 저장소를 못 쓸 수 있다. */ }
    return null;
  }

  // 입장 전 작성 중인 이름·축하글·미니미: 새로고침해도 이어서 쓸 수 있게 남긴다
  function saveDraft() {
    if (guest) return;
    const draft = {name: $('#guest-name').value, message: $('#guest-message').value, avatar: avatarDraft};
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) { /* 저장하지 못해도 작성은 계속된다. */ }
  }

  function readDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft && typeof draft === 'object') return draft;
    } catch (_) { /* 저장소를 못 쓰면 빈 칸에서 시작한다. */ }
    return null;
  }

  function saveGuest() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guest)); } catch (_) { /* 저장하지 못해도 화면은 그대로 동작한다. */ }
  }

  function makeSeats() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const id = `${String.fromCharCode(65 + row)}${col + 1}`;
        const x = col < COLUMNS / 2 ? 52 + col * SEAT_GAP : WORLD_WIDTH - 52 - (COLUMNS - 1 - col) * SEAT_GAP;
        const y = 360 + row * ROW_GAP;
        const element = document.createElement('div');
        element.className = 'seat';
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.dataset.seat = id;
        layer.append(element);
        seats.push({id, x, y, element});
      }
    }
    if (guest?.seat && seats.some(seat => seat.id === guest.seat)) {
      occupied.set(guest.seat, guest);
    } else if (guest?.seat) {
      guest.seat = null;
      saveGuest();
    }
    seats.forEach(renderSeat);
  }

  function renderSeat(seat) {
    const owner = occupied.get(seat.id);
    seat.element.classList.toggle('occupied', Boolean(owner));
    seat.element.classList.toggle('mine', guest?.seat === seat.id);
    seat.element.classList.remove('nearby');
    if (owner) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'guest-on-seat';
      button.setAttribute('aria-label', `${owner.name}님의 방명록 보기`);
      button.innerHTML = `${chair}${MINIMI.render(owner.avatar)}<span class="guest-name"></span>`;
      button.querySelector('.guest-name').textContent = owner.name;
      button.addEventListener('click', event => {
        event.stopPropagation();
        showBubble(seat, owner);
      });
      seat.element.replaceChildren(button);
    } else {
      seat.element.innerHTML = chair;
    }
  }

  // 머리글 TODAY: 오늘(한국 시간) 자리에 앉은 하객 수, TOTAL: 지금까지 앉은 하객 수. 기능 확인용 이름은 세지 않는다
  const seatedAt = new Map();
  const koreanDay = time => new Date(Number(time) + 9 * 3600000).toISOString().slice(0, 10);
  function renderCounts() {
    const today = koreanDay(Date.now());
    let todayCount = 0;
    let total = 0;
    for (const [seat, owner] of occupied) {
      if (!STORE.isRealName(owner.name)) continue;
      total++;
      if (seatedAt.has(seat) && koreanDay(seatedAt.get(seat)) === today) todayCount++;
    }
    $('#today-count').textContent = String(todayCount).padStart(2, '0');
    $('#total-count').textContent = String(total).padStart(3, '0');
  }

  function applyGuests(list) {
    const changed = [];
    for (const item of list) {
      if (item?.seat && item.at) seatedAt.set(item.seat, Number(item.at));
      if (!item || !item.seat || item.seat === guest?.seat) continue;
      const current = occupied.get(item.seat);
      if (current && current.name === item.name && current.message === item.message) continue;
      occupied.set(item.seat, {name: String(item.name), message: String(item.message), avatar: MINIMI.normalize(item.avatar)});
      changed.push(item.seat);
    }
    changed.forEach(id => {
      const seat = seats.find(item => item.id === id);
      if (seat) renderSeat(seat);
    });
    if (walkTarget && occupied.has(walkTarget.id)) stopWalking();
    if (changed.length && guest?.seat) renderGuestbookBoard();
    renderCounts();
  }

  async function refreshGuests() {
    try {
      applyGuests(await STORE.loadGuests());
      guestsLoaded = true;
    } catch (_) {
      if (!guestsLoaded) toast('하객 자리를 불러오지 못했어요. 잠시 후 다시 시도할게요.');
    }
  }

  function renderGuestbookBoard() {
    guestbookFeed.replaceChildren();
    for (const seat of seats) {
      const owner = occupied.get(seat.id);
      if (!owner) continue;
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'guestbook-entry';
      entry.dataset.seat = seat.id;
      if (seat.id === guest?.seat) entry.classList.add('is-mine');
      entry.setAttribute('aria-label', `${owner.name}님의 축하 메시지와 자리 보기`);
      entry.innerHTML = `<span class="guestbook-entry-avatar" aria-hidden="true">${MINIMI.render(owner.avatar)}</span>`
        + '<span class="guestbook-entry-copy"><strong></strong><span></span></span>';
      entry.querySelector('strong').textContent = owner.name;
      entry.querySelector('.guestbook-entry-copy span').textContent = owner.message;
      entry.addEventListener('click', () => {
        centerCameraOn(seat);
        showBubble(seat, owner, true);
        $('#garden-card').scrollIntoView({behavior: 'smooth', block: 'start'});
      });
      guestbookFeed.append(entry);
    }
  }

  function showBubble(seat, owner, forceOpen = false) {
    const openSame = !forceOpen && !bubble.hidden && bubble.dataset.seat === seat.id;
    bubble.hidden = openSame;
    if (openSame) return;
    bubble.dataset.seat = seat.id;
    $('#bubble-name').textContent = owner.name;
    $('#bubble-message').textContent = owner.message;
    bubble.style.left = `${Math.max(112, Math.min(WORLD_WIDTH - 112, seat.x))}px`;
    bubble.style.top = `${seat.y - 47}px`;
    if (guest?.seat) {
      guestbookFeed.querySelectorAll('.is-active').forEach(entry => entry.classList.remove('is-active'));
      const entry = guestbookFeed.querySelector(`[data-seat="${seat.id}"]`);
      if (entry) {
        entry.classList.add('is-active');
        guestbookFeed.scrollTo({top: entry.offsetTop - 12, behavior: 'smooth'});
      }
    }
  }

  function setPlayerAvatar() {
    playerElement.innerHTML = MINIMI.render(guest.avatar);
    playerElement.hidden = Boolean(guest.seat);
  }

  function enterVenue() {
    // 식장에 들어서면 결혼행진곡이 나온다
    window.WEDDING_SOUND.play('hall');
    if (entryDialog.open) entryDialog.close();
    document.body.classList.remove('is-entering');
    $('#venue-shade').hidden = true;
    $('#game-hud').hidden = false;
    venue.classList.add('is-active');
    venue.classList.toggle('is-seated', Boolean(guest.seat));
    $('#game-controls').hidden = Boolean(guest.seat);
    $('#seated-controls').hidden = !guest.seat;
    $('#hall-tabs').hidden = !guest.seat;
    document.body.classList.toggle('has-hall-tabs', Boolean(guest.seat));
    guestbookBoard.hidden = !guest.seat;
    status.hidden = Boolean(guest.seat);
    renderPrize();
    setPlayerAvatar();
    if (guest.seat) {
      seats.forEach(item => item.element.classList.remove('nearby', 'is-target'));
      nearestSeat = null;
      const seat = seats.find(item => item.id === guest.seat);
      position = {x: seat.x, y: seat.y};
      centerCameraOn(seat);
      renderGuestbookBoard();
    }
    updateScene();
  }

  // 두 분 전용 주소: 예식장은 바라보기만 하고, 오른쪽 탭은 청첩장으로·신혼여행 게임만 남긴 채 게임 창을 연다
  function openCoupleHall() {
    $('#venue-shade').hidden = true;
    playerElement.hidden = true;
    $('#restyle-button').hidden = true;
    $('#guestbook-tab').hidden = true;
    $('#hall-tabs').hidden = false;
    document.body.classList.add('has-hall-tabs');
    setCamera(venue.clientWidth / 2 - WORLD_WIDTH / 2, -60);
    // 게임(minigames.js)은 이 파일 다음에 불러오므로 다 불러온 뒤에 연다
    document.addEventListener('DOMContentLoaded', () => window.HONEYMOON_GAME.open(COUPLE_PLAYER), {once: true});
  }

  function placePlayer() {
    playerElement.style.left = `${position.x}px`;
    playerElement.style.top = `${position.y}px`;
  }

  function updateScene() {
    placePlayer();
    if (!guest?.seat && cameraFollow) {
      centerCameraOn(position);
    } else {
      setCamera(cameraX, cameraY);
    }
  }

  function followCamera(elapsed) {
    if (guest?.seat || !cameraFollow) return;
    const ease = 1 - Math.exp(-elapsed * 10);
    const targetX = venue.clientWidth / 2 - position.x * zoom;
    const targetY = venue.clientHeight * .43 - position.y * zoom;
    setCamera(cameraX + (targetX - cameraX) * ease, cameraY + (targetY - cameraY) * ease);
  }

  function walkTo(seat) {
    walkTarget = seat;
    walkSpeed = Math.max(MOVE_SPEED * 1.6, Math.hypot(seat.x - position.x, seat.y - position.y) / 1.1);
    cameraFollow = true;
    bubble.hidden = true;
    seats.forEach(item => item.element.classList.toggle('is-target', item === seat));
  }

  function stopWalking() {
    walkTarget?.element.classList.remove('is-target');
    walkTarget = null;
  }

  // 가장 작게 하면 예식장 전체가 화면에 꽉 찬다(바깥 빈 곳은 보이지 않게)
  function clampZoom(value) {
    const smallest = Math.min(1, Math.max(venue.clientWidth / WORLD_WIDTH, venue.clientHeight / WORLD_HEIGHT));
    return Math.min(MAX_ZOOM, Math.max(smallest, value));
  }

  function setCamera(x, y) {
    zoom = clampZoom(zoom);
    cameraX = Math.min(0, Math.max(venue.clientWidth - WORLD_WIDTH * zoom, x));
    cameraY = Math.min(0, Math.max(venue.clientHeight - WORLD_HEIGHT * zoom, y));
    world.style.transform = `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`;
    const bubbleHalfWidth = 100 * zoom;
    const margin = 8;
    const center = WORLD_WIDTH / 2 * zoom + cameraX;
    const clampedCenter = Math.max(bubbleHalfWidth + margin, Math.min(venue.clientWidth - bubbleHalfWidth - margin, center));
    coupleBubble.style.setProperty('--bubble-shift', `${(clampedCenter - center) / zoom}px`);
  }

  function centerCameraOn(seat) {
    setCamera(venue.clientWidth / 2 - seat.x * zoom, venue.clientHeight * .43 - seat.y * zoom);
  }

  // 화면 위 한 점(예식장 칸 기준)이 가리키는 곳은 그대로 둔 채 크게·작게
  function zoomAround(nextZoom, screenX, screenY) {
    const worldX = (screenX - cameraX) / zoom;
    const worldY = (screenY - cameraY) / zoom;
    zoom = clampZoom(nextZoom);
    setCamera(screenX - worldX * zoom, screenY - worldY * zoom);
    sharpenAfterZoom();
  }

  // 크기를 바꾼 뒤 잠깐 멈추면 그 크기로 다시 그려 확대해도 흐릿하지 않게
  let sharpenTimer;
  function sharpenAfterZoom() {
    clearTimeout(sharpenTimer);
    sharpenTimer = setTimeout(() => {
      world.style.willChange = 'auto';
      requestAnimationFrame(() => { world.style.willChange = ''; });
    }, 150);
  }

  function venueOffset() {
    const box = venue.getBoundingClientRect();
    return {x: box.left + venue.clientLeft, y: box.top + venue.clientTop};
  }

  // 두 손가락: 처음 벌린 거리와 두 손가락 가운데가 가리키는 곳을 기억해 두고 손가락을 따라 크게·작게·이동
  function startPinch() {
    const [first, second] = [...touches.values()];
    const offset = venueOffset();
    const middleX = (first.x + second.x) / 2 - offset.x;
    const middleY = (first.y + second.y) / 2 - offset.y;
    pinch = {distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)), zoom, worldX: (middleX - cameraX) / zoom, worldY: (middleY - cameraY) / zoom};
    pointerGesture = null;
    cameraFollow = false;
    bubble.hidden = true;
  }

  function movePinch() {
    const [first, second] = [...touches.values()];
    const offset = venueOffset();
    zoom = clampZoom(pinch.zoom * Math.hypot(first.x - second.x, first.y - second.y) / pinch.distance);
    setCamera((first.x + second.x) / 2 - offset.x - pinch.worldX * zoom, (first.y + second.y) / 2 - offset.y - pinch.worldY * zoom);
    sharpenAfterZoom();
  }

  function endTouch(id) {
    if (!touches.delete(id) || !pinch || touches.size >= 2) return;
    pinch = null;
    // 남은 한 손가락으로는 이어서 화면을 민다(그 손가락을 떼도 자리 누르기로 치지 않는다)
    for (const [rest, point] of touches) pointerGesture = {id: rest, startX: point.x, startY: point.y, x: point.x, y: point.y, moved: true, seatElement: null};
  }

  function setStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function updateNearest() {
    // 아직 입장 전이거나 이미 앉은 하객에게는 빈자리 선택 표시를 하지 않는다
    if (!guest || guest.seat) {
      nearestSeat?.element.classList.remove('nearby');
      nearestSeat = null;
      return;
    }
    let closest = null;
    let distance = SEAT_DISTANCE;
    if (!walkTarget) {
      for (const seat of seats) {
        if (occupied.has(seat.id)) continue;
        const gap = Math.hypot(position.x - seat.x, position.y - seat.y);
        if (gap < distance) { closest = seat; distance = gap; }
      }
    }
    if (!guestsLoaded) setStatus('하객 자리를 불러오는 중이에요');
    else if (walkTarget) setStatus('빈자리로 가는 중이에요');
    else setStatus(closest ? '이 빈자리에 앉을 수 있어요' : '빈자리를 누른 뒤 도착하면 앉기 버튼을 눌러 주세요.');
    if (closest?.id === nearestSeat?.id) return;
    nearestSeat?.element.classList.remove('nearby');
    nearestSeat = closest;
    if (closest) closest.element.classList.add('nearby');
    sitButton.disabled = !closest || claiming;
    $('#sit-label').textContent = closest ? '이 자리에 앉기' : '착석하기';
  }

  function movementVector() {
    const x = stick.x + Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
    const y = stick.y + Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
    const length = Math.hypot(x, y);
    return length > 1 ? {x: x / length, y: y / length} : {x, y};
  }

  function frame(time) {
    const elapsed = Math.min((time - (lastTime || time)) / 1000, .05);
    lastTime = time;
    if (guest && !guest.seat && !claiming && !resultDialog.open) {
      const move = movementVector();
      if (move.x || move.y) {
        stopWalking();
        cameraFollow = true;
        position.x = Math.max(30, Math.min(WORLD_WIDTH - 30, position.x + move.x * MOVE_SPEED * elapsed));
        position.y = Math.max(300, Math.min(WORLD_HEIGHT - 35, position.y + move.y * MOVE_SPEED * elapsed));
        bubble.hidden = true;
        placePlayer();
      } else if (walkTarget) {
        const dx = walkTarget.x - position.x;
        const dy = walkTarget.y - position.y;
        const gap = Math.hypot(dx, dy);
        const step = walkSpeed * elapsed;
        if (gap <= step) {
          position = {x: walkTarget.x, y: walkTarget.y};
          stopWalking();
        } else {
          position.x += dx / gap * step;
          position.y += dy / gap * step;
        }
        placePlayer();
      }
      followCamera(elapsed);
      updateNearest();
    }
    requestAnimationFrame(frame);
  }

  function updateStick(event) {
    const box = joystick.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    const distance = Math.hypot(x, y);
    const scale = distance > 38 ? 38 / distance : 1;
    stick = {x: x * scale / 38, y: y * scale / 38};
    thumb.style.transform = `translate(${stick.x * 38}px, ${stick.y * 38}px)`;
  }

  function resetStick() {
    activePointer = null;
    stick = {x: 0, y: 0};
    thumb.style.transform = 'translate(0, 0)';
  }

  function openDialog(dialog) {
    focusBeforeDialog = document.activeElement;
    resetStick();
    dialog.showModal();
    document.body.classList.add('modal-open');
    window.WEDDING_BACK.push(dialog.id, () => dialog.close());
  }

  function showResult() {
    const won = Boolean(guest.won);
    resultDialog.dataset.result = won ? 'win' : 'thanks';
    $('#result-eyebrow').textContent = won ? 'A LITTLE SURPRISE FOR YOU' : 'WITH ALL OUR LOVE';
    $('#result-art').textContent = won ? '★' : '♥';
    $('#result-seat').textContent = `${guest.name}님의 자리`;
    $('#result-title').textContent = won ? '오늘의 행운이 찾아왔어요!' : '함께해 주셔서 고마워요';
    $('#result-description').textContent = won
      ? '축하해요! 오늘의 작은 선물 주인공이 되셨어요.\n번호를 남겨 주시면 커피 쿠폰을 보내 드릴게요.'
      : '따뜻한 축하의 마음을 남겨주셔서 고마워요.\n오늘 이 자리를 함께 빛내주셨네요.';
    $('#result-stamp').textContent = won ? 'COFFEE FOR YOU' : 'THANK YOU, ALWAYS';
    renderPrize();
    $('#confetti').replaceChildren();
    openDialog(resultDialog);
    if (won && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 22; i++) {
        const piece = document.createElement('i');
        piece.style.setProperty('--x', `${Math.random() * 100}%`);
        piece.style.setProperty('--delay', `${Math.random() * .5}s`);
        piece.style.setProperty('--color', ['#f2a8b7', '#f4d28f', '#a8cde5'][i % 3]);
        $('#confetti').append(piece);
      }
    }
  }

  // 당첨 하객: 번호를 남기기 전에는 번호 칸과 예식장 위 안내를, 남긴 뒤에는 가린 번호를 보여 준다
  function renderPrize() {
    const won = Boolean(guest.won);
    prizeForm.hidden = !won || (Boolean(guest.contact) && !editingContact);
    $('#prize-done').hidden = !won || !guest.contact || editingContact;
    $('#prize-saved').textContent = guest.contact ? `${guest.contact} 번호로 커피 쿠폰을 보내 드릴게요.` : '';
    $('#prize-reminder').hidden = !won || !guest.seat || Boolean(guest.contact);
    $('#prize-error').hidden = true;
  }

  // 휴대폰 번호만 받고 010-1234-5678 꼴로 맞춘다. 아니면 빈 문자열(server/apps-script.gs와 같은 규칙)
  function phoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return /^(010\d{8}|01[16789]\d{7,8})$/.test(digits) ? digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3') : '';
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3000);
  }

  // 착석한 뒤 옷 갈아입기: 입장할 때의 꾸미기 화면을 이름·축하글 칸 없이 다시 연다
  let restyling = false;
  function openRestyle() {
    restyling = true;
    avatarDraft = MINIMI.normalize(guest.avatar);
    updateCustomizer();
    entryDialog.classList.add('is-restyle');
    // 숨겨 둔 이름·축하글 칸이 비어 있어도 제출되게 입력 확인을 끈다
    $('#guest-form').noValidate = true;
    $('#entry-title').textContent = '옷 갈아입기';
    $('#entry-submit-label').textContent = '이 옷으로 갈아입기';
    openDialog(entryDialog);
    entryDialog.scrollTop = 0;
  }

  async function saveRestyle() {
    guest.avatar = MINIMI.normalize(avatarDraft);
    saveGuest();
    const seat = seats.find(item => item.id === guest.seat);
    if (seat) {
      occupied.set(seat.id, guest);
      renderSeat(seat);
    }
    renderGuestbookBoard();
    window.WEDDING_BACK.back();
    try {
      const result = await STORE.updateAvatar({guestId: guest.guestId, avatar: guest.avatar});
      if (result?.ok === false) throw new Error(result.reason);
      toast('새 옷으로 갈아입었어요!');
    } catch (_) {
      toast('다른 하객 화면에는 아직 저장하지 못했어요. 잠시 후 다시 갈아입어 주세요.');
    }
  }

  entryDialog.addEventListener('close', () => {
    if (!restyling) return;
    restyling = false;
    entryDialog.classList.remove('is-restyle');
    $('#guest-form').noValidate = false;
    $('#entry-title').textContent = '미니미 꾸미고 입장하기';
    $('#entry-submit-label').textContent = '축하 남기고 입장하기';
    document.body.classList.remove('modal-open');
  });
  $('#restyle-button').addEventListener('click', openRestyle);
  $('#restyle-close').addEventListener('click', () => window.WEDDING_BACK.back());

  $('#guest-form').addEventListener('submit', event => {
    event.preventDefault();
    if (restyling) { saveRestyle(); return; }
    const name = $('#guest-name').value.trim();
    const message = $('#guest-message').value.trim();
    if (guest) return; // 입장 버튼 연타
    if (!name || !message) { toast('이름과 축하의 말을 남겨주세요.'); return; }
    guest = {guestId: deviceGuestId(), name, message, avatar: MINIMI.normalize(avatarDraft), seat: null};
    saveGuest();
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* 무시 */ }
    enterVenue();
    $('#garden-card').scrollIntoView({behavior: 'smooth', block: 'start'});
  });

  joystick.addEventListener('pointerdown', event => {
    if (!guest || guest.seat) return;
    activePointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateStick(event);
  });
  joystick.addEventListener('pointermove', event => { if (event.pointerId === activePointer) updateStick(event); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick.addEventListener(name, event => { if (event.pointerId === activePointer) resetStick(); });
  }
  venue.addEventListener('pointerdown', event => {
    if (!guest || resultDialog.open || event.target.closest('button, .game-controls, .seated-controls')) return;
    touches.set(event.pointerId, {x: event.clientX, y: event.clientY});
    venue.setPointerCapture(event.pointerId);
    if (touches.size === 2) { startPinch(); return; }
    if (touches.size > 2) return;
    pointerGesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      seatElement: event.target.closest('.seat')
    };
  });
  venue.addEventListener('pointermove', event => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pinch) { movePinch(); return; }
    if (!pointerGesture || event.pointerId !== pointerGesture.id) return;
    if (!pointerGesture.moved && Math.hypot(event.clientX - pointerGesture.startX, event.clientY - pointerGesture.startY) < TAP_SLOP) return;
    pointerGesture.moved = true;
    cameraFollow = false;
    setCamera(cameraX + event.clientX - pointerGesture.x, cameraY + event.clientY - pointerGesture.y);
    pointerGesture.x = event.clientX;
    pointerGesture.y = event.clientY;
    bubble.hidden = true;
  });
  venue.addEventListener('pointerup', event => {
    endTouch(event.pointerId);
    if (!pointerGesture || event.pointerId !== pointerGesture.id) return;
    const {moved, seatElement} = pointerGesture;
    pointerGesture = null;
    if (moved || !seatElement || guest.seat || claiming) return;
    const seat = seats.find(item => item.element === seatElement);
    if (seat && !occupied.has(seat.id)) walkTo(seat);
  });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    venue.addEventListener(name, event => {
      endTouch(event.pointerId);
      if (pointerGesture?.id === event.pointerId) pointerGesture = null;
    });
  }
  // 노트북 터치패드에서 두 손가락 벌리기·오므리기(Ctrl+휠로 들어온다), Ctrl+마우스 휠
  venue.addEventListener('wheel', event => {
    if (!guest || !event.ctrlKey) return;
    event.preventDefault();
    cameraFollow = false;
    const offset = venueOffset();
    zoomAround(zoom * Math.exp(-event.deltaY * .003), event.clientX - offset.x, event.clientY - offset.y);
  }, {passive: false});
  // 아이폰 사파리가 예식장 안에서 두 손가락을 화면 전체 확대로 가져가지 않게
  venue.addEventListener('gesturestart', event => { if (guest) event.preventDefault(); });
  window.addEventListener('keydown', event => {
    if (!guest || guest.seat || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) { keys.add(event.key); event.preventDefault(); }
  });
  window.addEventListener('keyup', event => keys.delete(event.key));
  window.addEventListener('blur', () => { keys.clear(); resetStick(); });
  window.addEventListener('resize', updateScene);

  sitButton.addEventListener('click', async () => {
    if (!guest || guest.seat || !nearestSeat || claiming) return;
    const seat = nearestSeat;
    stopWalking();
    claiming = true;
    sitButton.disabled = true;
    bubble.hidden = true;
    $('#seat-checking').hidden = false;
    let result;
    try {
      result = await STORE.claimSeat({guestId: guest.guestId, seat: seat.id, name: guest.name, message: guest.message, avatar: guest.avatar});
    } catch (_) {
      result = null;
    }
    $('#seat-checking').hidden = true;
    claiming = false;
    if (!result) {
      sitButton.disabled = false;
      toast('연결이 잠시 불안정해요. 다시 눌러 주세요.');
      return;
    }
    if (!result.ok) {
      if (result.guest) applyGuests([result.guest]);
      updateNearest();
      toast('방금 다른 하객이 앉은 자리예요. 다른 자리를 골라 주세요.');
      return;
    }
    // 앞서 보낸 요청으로 이미 앉았다면 그 자리로 맞춘다
    const mySeat = seats.find(item => item.id === (result.seat || seat.id)) || seat;
    guest.seat = mySeat.id;
    guest.won = Boolean(result.won);
    occupied.set(mySeat.id, guest);
    if (!result.already) seatedAt.set(mySeat.id, Date.now());
    renderCounts();
    saveGuest();
    renderSeat(mySeat);
    enterVenue();
    showResult();
  });

  world.addEventListener('click', event => { if (!event.target.closest('.guest-on-seat')) bubble.hidden = true; });
  const greetings = [
    '저희의 결혼에 참석해주셔서 감사합니다 ♡',
    '함께해 주셔서 오늘이 더 반짝여요!',
    '남겨주신 마음, 오래도록 간직할게요.'
  ];
  let greetingIndex = 0;
  $('#couple-greeting').addEventListener('click', event => {
    event.stopPropagation();
    greetingIndex = (greetingIndex + 1) % greetings.length;
    coupleBubble.textContent = greetings[greetingIndex];
  });
  $('#home-button').addEventListener('click', () => {
    const seat = seats.find(item => item.id === guest?.seat);
    if (seat) centerCameraOn(seat);
  });
  $('#honeymoon-button').addEventListener('click', () => window.HONEYMOON_GAME.open(COUPLE ? COUPLE_PLAYER : guest));
  // 오른쪽 탭: 청첩장으로 돌아가기, 방명록으로 내려가기
  $('#invitation-tab').addEventListener('click', () => {
    const close = window.parent !== window && window.parent.document.querySelector('[data-close-layer]');
    if (close) close.click();
    else location.href = '../';
  });
  $('#guestbook-tab').addEventListener('click', () => guestbookBoard.scrollIntoView({behavior: 'smooth', block: 'start'}));
  prizeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('#prize-submit');
    const error = $('#prize-error');
    if (submit.disabled) return;
    const phone = phoneNumber($('#prize-phone').value);
    error.hidden = Boolean(phone);
    if (!phone) { error.textContent = '휴대폰 번호를 다시 확인해 주세요.'; return; }
    submit.disabled = true;
    try {
      await STORE.saveContact({guestId: guest.guestId, phone});
      // 이 기기에는 가운데를 가린 번호만 남긴다
      guest.contact = phone.replace(/-\d+-/, '-****-');
      editingContact = false;
      $('#prize-phone').value = '';
      saveGuest();
      renderPrize();
    } catch (_) {
      error.textContent = '연결이 잠시 불안정해요. 다시 눌러 주세요.';
      error.hidden = false;
    }
    submit.disabled = false;
  });
  $('#prize-edit').addEventListener('click', () => {
    editingContact = true;
    renderPrize();
    $('#prize-phone').focus();
  });
  $('#prize-reminder').addEventListener('click', showResult);
  $('#mini-game-button').addEventListener('click', () => {
    launchGameAfterResult = true;
    window.WEDDING_BACK.back();
  });
  entryDialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (restyling) window.WEDDING_BACK.back();
  });
  for (const dialog of [resultDialog]) {
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => window.WEDDING_BACK.back()));
    dialog.addEventListener('click', event => { if (event.target === dialog) window.WEDDING_BACK.back(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); window.WEDDING_BACK.back(); });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      focusBeforeDialog?.focus({preventScroll: true});
    });
  }
  resultDialog.addEventListener('close', () => {
    editingContact = false;
    if (!launchGameAfterResult) return;
    launchGameAfterResult = false;
    window.HONEYMOON_GAME.open(guest);
  });

  setupCustomizer();
  $('#groom-character').innerHTML = MINIMI.render({skin: 'warm'}, 'groom');
  $('#bride-character').innerHTML = MINIMI.render({skin: 'light'}, 'bride');
  makeSeats();
  refreshGuests().then(() => updateNearest());
  setInterval(refreshGuests, REFRESH_INTERVAL);
  document.querySelectorAll('[data-sound-toggle]').forEach(button => window.WEDDING_SOUND.bind(button));
  if (COUPLE) openCoupleHall();
  else if (guest) enterVenue();
  else {
    playerElement.hidden = true;
    document.body.classList.add('is-entering');
    setCamera(venue.clientWidth / 2 - WORLD_WIDTH / 2, -60);
    entryDialog.showModal();
    entryDialog.scrollTop = 0;
    $('#entry-title').focus({preventScroll: true});
  }
  requestAnimationFrame(frame);
})();
