/* 신혼여행 미니게임 규칙. 그림은 game-art.js(HONEYMOON_ART), 순위는 store.js(WEDDING_STORE)를 거친다.
   내 최고 기록은 이 브라우저에 남긴다. 화면은 320×200 픽셀(도트)이다. */
(() => {
  'use strict';

  const ART = window.HONEYMOON_ART;
  const STORAGE_KEY = 'honeymoon-game-runs-v1';
  const PER_STAGE = 6;
  const COMPLETE_BONUS = 100;
  const START_DELAY = 1.9;
  const STAGE_PAUSE = 1.4;

  const canvas = document.querySelector('#game-canvas');
  const ctx = canvas.getContext('2d');
  const dialog = document.querySelector('#honeymoon-dialog');
  const picker = document.querySelector('#game-picker');
  const play = document.querySelector('#game-play');
  const actionButton = document.querySelector('#game-action');
  const scoreLabel = document.querySelector('#game-score');
  const levelLabel = document.querySelector('#game-level');
  const bestLabel = document.querySelector('#game-best');
  const ranking = document.querySelector('#game-ranking');
  const instruction = document.querySelector('#game-instruction');
  const result = document.querySelector('#game-result');
  const tickets = [...dialog.querySelectorAll('[data-ticket-game]')];
  const BACK = window.WEDDING_BACK;

  const GAMES = {
    safari: {
      title: '탄자니아 사파리 점프',
      country: '탄자니아',
      stages: 3,
      places: ['은두투 출산 평원', '은두투 포식자 구역', '응고롱고로 분화구'],
      bonus: '대이동 질주',
      hints: ['누·얼룩말·가젤을 넘어요', '2단 점프 해금! 사자·치타·하이에나, 하늘의 독수리를 조심해요', '버팔로·하마·코끼리·사자를 넘어요 · 마지막엔 검은코뿔소!'],
      bonusHint: '부딪힐 때까지 끝없이 달려요. 오래 버틸수록 점수가 올라가요!',
      // 조작 안내는 두 줄의 길이가 비슷하도록 나눠 보여 준다
      instruction: ['화면이나 버튼을 누르면 점프해요. 두 번째 구간부터는', '공중에서 한 번 더 눌러 2단 점프! 키보드: 스페이스바·↑'],
      countLabel: '넘은 동물'
    },
    zanzibar: {
      title: '잔지바르 돌고래 수영',
      country: '잔지바르',
      stages: 4,
      places: ['에메랄드 해변', '산호 정원', '깊은 물길', '노을 바다'],
      bonus: '밤바다',
      hints: ['산호초 사이로 헤엄쳐요', '가시 복어를 피해요', '복어가 위아래로 움직여요', '가오리가 빠르게 지나가요'],
      bonusHint: '부딪힐 때까지 끝없이 헤엄쳐요. 점점 빨라지고 틈도 좁아져요!',
      instruction: ['누를 때마다 위로 헤엄쳐요. 산호초와 가시 복어를 피하고', '조개를 모아요. 돌고래는 두 사람을 따라와요. 키보드: 스페이스바·↑'],
      countLabel: '지난 산호초'
    }
  };

  const SAFARI = {
    groundTop: ART.GROUND - ART.COUPLE.height,
    jump: 420,
    doubleJump: 350,
    gravity: 980,
    pools: [
      ['wildebeest', 'zebra', 'gazelle', 'wildebeest', 'zebra'],
      ['lion', 'cheetah', 'hyena', 'eagle', 'lion'],
      ['buffalo', 'hippo', 'elephant', 'lion', 'puddle', 'buffalo']
    ],
    signature: [null, 'cheetah', 'buffalo'],
    bonusPool: ['wildebeest', 'zebra', 'gazelle', 'lion', 'cheetah', 'hyena', 'eagle', 'buffalo', 'hippo', 'elephant'],
    // 동물 사이 시간(초)과 무리 지어 오는 확률: 1~3구간, 보너스
    gaps: [[.95, 1.3], [.82, 1.12], [.72, 1], [.68, .92]],
    patterns: [
      {pair: 0, double: 0, swoop: 0},
      {pair: .22, double: .1, swoop: .15},
      {pair: .22, double: .25, swoop: .15},
      {pair: .22, double: .3, swoop: .2}
    ],
    names: {wildebeest: '누', zebra: '얼룩말', gazelle: '가젤', lion: '사자', cheetah: '치타', hyena: '하이에나', buffalo: '버팔로', hippo: '하마', elephant: '코끼리', rhino: '검은코뿔소'}
  };
  const SEA = {
    lift: 100,
    gravity: 250,
    terminal: 115,
    reefWidth: 28,
    openings: [82, 74, 68, 62],
    drift: [30, 36, 42, 48, 54],
    gaps: [[165, 195], [155, 185], [148, 176], [140, 168], [132, 158]],
    pufferChance: [0, .45, .55, .65, .7]
  };

  const state = {
    name: '하객', guestId: '', mode: null, phase: 'menu', time: 0, distance: 0, speed: 0,
    score: 0, cleared: 0, shells: 0, bonus: 0, completed: false,
    stage: 1, previousStage: 0, blendStart: 0, quietUntil: 0, spawnIn: 0, pendingSignature: null,
    obstacles: [], seed: 1,
    top: SAFARI.groundTop, vy: 0, onGround: true, jumpsUsed: 0, bufferUntil: -1,
    swimTop: 92, dolphinTop: 95,
    animation: 0, lastFrame: 0, overAt: 0, announceTimer: 0, bumpTimer: 0
  };
  const runs = readRuns();
  const rankingEntries = {safari: [], zanzibar: []};
  let rankingRequest = 0;

  function readRuns() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') {
        const valid = item => item && typeof item.name === 'string' && Number.isInteger(item.score) && item.score >= 0;
        return Object.fromEntries(['safari', 'zanzibar'].map(mode => [mode,
          Array.isArray(saved[mode]) ? saved[mode].filter(valid).slice(-30) : []
        ]));
      }
    } catch (_) { /* 저장소를 못 써도 게임은 할 수 있다. */ }
    return {safari: [], zanzibar: []};
  }

  function saveRuns() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)); } catch (_) { /* 기록을 못 남겨도 게임은 계속된다. */ }
  }

  const game = () => GAMES[state.mode];

  function showInstruction() {
    instruction.replaceChildren(...game().instruction.map(line => {
      const span = document.createElement('span');
      span.className = 'instruction-line';
      span.textContent = line;
      return span;
    }));
  }
  const random = (min, max) => min + Math.random() * (max - min);
  const pick = items => items[Math.floor(Math.random() * items.length)];
  const stageCount = () => game().stages;
  const placeName = () => state.stage > stageCount() ? game().bonus : game().places[state.stage - 1];
  // 받침 유무에 따라 '와/과'
  const withParticle = word => word + ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? '과' : '와');

  /* ---------- 알림: 게임 화면을 가리지 않도록 점수줄과 아래 설명 자리에 띄운다 ---------- */
  function bumpScore(text) {
    scoreLabel.dataset.bump = text;
    scoreLabel.classList.remove('is-bump');
    void scoreLabel.offsetWidth;
    scoreLabel.classList.add('is-bump');
    clearTimeout(state.bumpTimer);
    state.bumpTimer = setTimeout(() => scoreLabel.classList.remove('is-bump'), 1000);
  }

  function announce(kicker, text, celebrate = false) {
    const strong = document.createElement('b');
    strong.textContent = kicker;
    instruction.replaceChildren(strong, document.createTextNode(` ${text}`));
    instruction.classList.add('is-announce');
    instruction.classList.toggle('is-celebrate', celebrate);
    levelLabel.classList.remove('is-new');
    void levelLabel.offsetWidth;
    levelLabel.classList.add('is-new');
    clearTimeout(state.announceTimer);
    state.announceTimer = setTimeout(restoreInstruction, celebrate ? 4000 : 3200);
  }

  function restoreInstruction() {
    clearTimeout(state.announceTimer);
    instruction.classList.remove('is-announce', 'is-celebrate');
    if (state.mode) showInstruction();
  }

  function hideOverlays() {
    clearTimeout(state.bumpTimer);
    scoreLabel.classList.remove('is-bump');
    restoreInstruction();
  }

  /* ---------- 점수와 구간 ---------- */
  function updatePoints() {
    const next = Math.floor(state.time * 10) + state.cleared * 20 + state.shells * 7 + state.bonus;
    if (next !== state.score) {
      state.score = next;
      refreshScore();
    }
  }

  function setStage(stage) {
    if (stage === state.stage) return;
    state.previousStage = state.stage;
    state.blendStart = state.time;
    state.stage = stage;
    state.quietUntil = state.time + STAGE_PAUSE;
    state.pendingSignature = state.mode === 'safari' && stage <= stageCount() ? SAFARI.signature[stage - 1] : null;
    refreshScore();
  }

  function advance() {
    state.cleared += 1;
    const total = PER_STAGE * stageCount();
    if (!state.completed && state.cleared >= total) {
      state.completed = true;
      state.bonus += COMPLETE_BONUS;
      setStage(stageCount() + 1);
      announce(`신혼여행 완주! +${COMPLETE_BONUS}`, `보너스 · ${game().bonus} — ${game().bonusHint}`, true);
      window.WEDDING_SOUND.hurry();
      bumpScore(`+${COMPLETE_BONUS}`);
    } else if (!state.completed) {
      const stage = Math.min(stageCount(), 1 + Math.floor(state.cleared / PER_STAGE));
      if (stage !== state.stage) {
        setStage(stage);
        announce(`${stage}/${stageCount()} ${game().places[stage - 1]}`, game().hints[stage - 1]);
      }
    }
    updatePoints();
  }

  function refreshScore() {
    if (!state.mode) return;
    scoreLabel.textContent = `${state.score}점`;
    levelLabel.textContent = state.stage > stageCount() ? `보너스 · ${game().bonus}` : `${state.stage} · ${placeName()}`;
    const mine = item => (item.guestId ? item.guestId === state.guestId : item.name === state.name);
    const best = Math.max(0, ...runs[state.mode].filter(mine).map(item => item.score));
    bestLabel.textContent = `내 최고 ${best}점`;
  }

  /* ---------- 사파리 ---------- */
  // 다음 동물까지의 간격(픽셀). 시간으로 정해 두고 지금 속도를 곱한다: 보너스에서 오래 버틸수록 짧아진다
  function safariGap() {
    const level = Math.min(state.stage, 4);
    const extra = Math.max(0, state.cleared - PER_STAGE * stageCount());
    const squeeze = Math.max(.8, 1 - extra * .006);
    const [min, max] = SAFARI.gaps[level - 1];
    return random(min * squeeze, max * squeeze) * state.speed;
  }

  function spawnSafari() {
    const bonus = state.stage > stageCount();
    const total = PER_STAGE * stageCount();
    const waiting = state.obstacles.filter(item => !item.passed).length;
    const room = bonus ? Infinity : total - state.cleared - waiting;
    if (room <= 0) return;
    const x = ART.W + 8;
    const last = !bonus && state.stage === stageCount();
    if (last && room === 1) {
      // 응고롱고로 구간의 마지막은 희귀한 검은코뿔소
      announce('희귀 동물 등장!', '검은코뿔소가 나타났어요. 크게 뛰어넘어요!');
      state.obstacles.push(safariObstacle('rhino', x));
      state.spawnIn = safariGap() + 40;
      return;
    }
    const level = Math.min(state.stage, 4);
    const pool = bonus ? SAFARI.bonusPool : SAFARI.pools[state.stage - 1];
    // 여러 마리가 함께 오는 무리에는 혼자 빨리 달리는 치타와 몸집이 큰 코끼리를 넣지 않는다
    const ground = () => pick(pool.filter(type => !['eagle', 'cheetah', 'elephant'].includes(type)));
    const chance = SAFARI.patterns[level - 1];
    const roll = Math.random();
    let pattern = 'single';
    if (!state.pendingSignature && room - (last ? 1 : 0) >= 2) {
      if (roll < chance.pair) pattern = 'pair';
      else if (roll < chance.pair + chance.double) pattern = 'double';
      else if (roll < chance.pair + chance.double + chance.swoop) pattern = 'swoop';
    }
    let length = 0;
    if (pattern === 'pair') {
      // 붙어서 오는 두 마리: 한 번에 길게 뛰어 넘는다
      const first = safariObstacle(ground(), x);
      const second = safariObstacle(ground(), x + first.w + 12);
      state.obstacles.push(first, second);
      length = first.w + 12 + second.w;
    } else if (pattern === 'double') {
      // 잇달아 오는 두 마리: 내려오자마자 다시 뛰거나 2단 점프로 넘는다
      const first = safariObstacle(ground(), x);
      const second = safariObstacle(ground(), x + first.w + random(.42, .55) * state.speed);
      state.obstacles.push(first, second);
      length = second.x - x + second.w;
    } else if (pattern === 'swoop') {
      // 낮게 나는 독수리가 지나간 뒤에 바로 동물이 온다: 독수리 밑에서는 뛰면 안 된다
      const eagle = {...safariObstacle('eagle', x), y: SAFARI.groundTop - 20, flying: true};
      const animal = safariObstacle(ground(), x + eagle.w + random(.35, .45) * state.speed);
      state.obstacles.push(eagle, animal);
      length = animal.x - x + animal.w;
    } else {
      const type = state.pendingSignature || pick(pool);
      if (type === 'eagle') {
        state.obstacles.push({...safariObstacle('eagle', x + 70), y: SAFARI.groundTop - 20, flying: true});
        length = 150;
      } else {
        state.obstacles.push(safariObstacle(type, x));
      }
    }
    state.pendingSignature = null;
    state.spawnIn = safariGap() + length;
  }

  function safariObstacle(type, x) {
    const size = ART.SAFARI_SIZES[type];
    return {type, x, w: size.w, h: size.h, passed: false};
  }

  function pressSafari() {
    if (state.onGround) {
      state.vy = -SAFARI.jump;
      state.onGround = false;
      state.jumpsUsed = 1;
    } else if (state.stage >= 2 && state.jumpsUsed === 1) {
      state.vy = -SAFARI.doubleJump;
      state.jumpsUsed = 2;
    } else {
      state.bufferUntil = state.time + .14;
    }
  }

  function updateSafari(dt) {
    state.vy += SAFARI.gravity * dt;
    state.top += state.vy * dt;
    if (state.top >= SAFARI.groundTop) {
      state.top = SAFARI.groundTop;
      state.vy = 0;
      state.onGround = true;
      state.jumpsUsed = 0;
      if (state.bufferUntil >= state.time) {
        state.bufferUntil = -1;
        pressSafari();
      }
    }
    if (state.time >= state.quietUntil) {
      state.spawnIn -= state.speed * dt;
      if (state.spawnIn <= 0) spawnSafari();
    }
    // 판정 상자는 그림보다 조금 작게 잡는다
    const left = ART.COUPLE.hitLeft;
    const right = ART.COUPLE.hitRight;
    const top = state.top + ART.COUPLE.hitTop;
    const bottom = state.top + ART.COUPLE.height - 2;
    for (const item of state.obstacles) {
      const move = item.type === 'cheetah' ? state.speed + 70 : item.flying ? state.speed + 30 : state.speed;
      item.x -= move * dt;
      if (!item.passed && item.x + item.w < left) {
        item.passed = true;
        advance();
      }
      if (item.x + 4 > right || item.x + item.w - 4 < left) continue;
      if (item.type === 'puddle') {
        if (state.onGround && item.x + 10 < right - 4 && item.x + item.w - 10 > left + 4) return finishRun('물웅덩이에 빠졌어요');
      } else if (item.flying) {
        if (top < item.y + 13 && bottom > item.y + 5) return finishRun('독수리와 부딪혔어요');
      } else if (bottom > ART.GROUND - item.h + 4) {
        return finishRun(`${withParticle(SAFARI.names[item.type] || '동물')} 부딪혔어요`);
      }
    }
    state.obstacles = state.obstacles.filter(item => item.x + item.w > -60);
  }

  /* ---------- 잔지바르 ---------- */
  function spawnSea() {
    const stageNo = Math.min(state.stage, 5);
    const opening = stageNo <= stageCount() ? SEA.openings[stageNo - 1]
      : Math.max(50, SEA.openings[3] - Math.floor((state.cleared - PER_STAGE * stageCount()) / 2));
    const previous = [...state.obstacles].reverse().find(item => item.type === 'reef');
    const center = previous ? previous.gap : 100;
    const drift = SEA.drift[stageNo - 1];
    const gap = Math.max(30 + opening / 2, Math.min(180 - opening / 2, center + random(-drift, drift)));
    const reef = {type: 'reef', x: ART.W + 8, w: SEA.reefWidth, gap, opening, seed: state.seed++, passed: false,
      shell: Math.random() < .6 ? {taken: false} : null, puffer: null};
    if (Math.random() < SEA.pufferChance[stageNo - 1]) {
      const side = Math.random() < .5 ? -1 : 1;
      const base = gap + side * (opening / 4) - 11;
      const amplitude = stageNo >= 3 ? Math.max(3, opening / 4 - 10) : 2;
      reef.puffer = {base, y: base, amplitude, phase: Math.random() * Math.PI * 2};
      reef.shell = null;
    }
    state.obstacles.push(reef);
    const [min, max] = SEA.gaps[stageNo - 1];
    state.spawnIn = random(min, max);
    if (stageNo >= 4 && Math.random() < .45) {
      const {w, h} = ART.RAY_SIZE;
      state.obstacles.push({type: 'ray', x: ART.W + 8 + state.spawnIn - w - 30, y: random(36, 160), w, h, passed: true});
    }
  }

  function pressSea() {
    state.vy = Math.min(state.vy, 0) - SEA.lift * (state.vy < 0 ? .45 : 1);
    state.vy = Math.max(state.vy, -SEA.lift * 1.25);
  }

  function updateSea(dt) {
    state.vy = Math.min(SEA.terminal, state.vy + SEA.gravity * dt);
    state.swimTop += state.vy * dt;
    if (state.swimTop < 22) { state.swimTop = 22; state.vy = Math.max(0, state.vy); }
    if (state.swimTop > 170) { state.swimTop = 170; state.vy = 0; }
    state.dolphinTop += (state.swimTop + 3 - state.dolphinTop) * Math.min(1, dt * 5);
    if (state.time >= state.quietUntil) {
      state.spawnIn -= state.speed * dt;
      if (state.spawnIn <= 0) spawnSea();
    }
    const left = ART.SWIMMERS.hitLeft;
    const right = ART.SWIMMERS.hitRight;
    const top = state.swimTop + ART.SWIMMERS.hitTop;
    const bottom = state.swimTop + ART.SWIMMERS.hitBottom;
    for (const item of state.obstacles) {
      item.x -= (item.type === 'ray' ? state.speed + 24 : state.speed) * dt;
      if (item.type === 'ray') {
        if (item.x + 10 < right && item.x + item.w - 18 > left && top < item.y + 11 && bottom > item.y + 7) return finishRun('가오리와 부딪혔어요');
        continue;
      }
      if (item.puffer) item.puffer.y = item.puffer.base + Math.sin(state.time * 1.8 + item.puffer.phase) * item.puffer.amplitude;
      if (item.shell && !item.shell.taken) {
        const shellX = item.x - 20;
        if (shellX < right && shellX + 12 > left && Math.abs(state.swimTop + 9 - item.gap) < 14) {
          item.shell.taken = true;
          state.shells += 1;
          updatePoints();
          bumpScore('+7');
        }
      }
      if (!item.passed && item.x + item.w < left) {
        item.passed = true;
        advance();
      }
      if (item.x + 3 > right || item.x + item.w - 3 < left) continue;
      if (top < item.gap - item.opening / 2 + 2 || bottom > item.gap + item.opening / 2 - 2) return finishRun('산호초에 닿았어요');
      if (item.puffer) {
        const px = item.x + item.w / 2 - ART.PUFFER_SIZE.w / 2;
        if (px + 4 < right && px + ART.PUFFER_SIZE.w - 4 > left && top < item.puffer.y + 18 && bottom > item.puffer.y + 4) return finishRun('가시 복어에 찔렸어요');
      }
    }
    state.obstacles = state.obstacles.filter(item => item.x + item.w > -12);
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!state.mode) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const blend = state.previousStage ? Math.min(1, (state.time - state.blendStart) / 1.5) : 1;
    const scene = {
      time: state.time, distance: state.distance, stage: Math.min(state.stage, 5),
      previousStage: blend < 1 ? Math.min(state.previousStage, 5) : 0, blend,
      obstacles: state.obstacles
    };
    if (state.mode === 'safari') ART.drawSafari(ctx, {...scene, coupleTop: state.top, airborne: !state.onGround});
    else ART.drawZanzibar(ctx, {...scene, swimTop: state.swimTop, dolphinTop: state.dolphinTop});
  }

  function tick(time) {
    if (state.phase !== 'playing' || !dialog.open) return;
    const dt = Math.min((time - (state.lastFrame || time)) / 1000, .034);
    state.lastFrame = time;
    state.time += dt;
    // 속도는 서서히 빨라진다
    // 보너스 구간에서는 넘을 때마다 계속 빨라진다
    const extra = Math.max(0, state.cleared - PER_STAGE * stageCount());
    state.speed = state.mode === 'safari'
      ? Math.min(420, Math.min(280, 185 + state.cleared * 4.5) + extra * 5)
      : Math.min(280, Math.min(200, 118 + state.cleared * 3.4) + extra * 3);
    state.distance += state.speed * dt;
    if (state.mode === 'safari') updateSafari(dt);
    else updateSea(dt);
    if (state.phase === 'playing') updatePoints();
    render();
    if (state.phase === 'playing') state.animation = requestAnimationFrame(tick);
  }

  /* ---------- 진행 ---------- */
  function resetRun() {
    Object.assign(state, {
      time: 0, distance: 0, speed: 0, score: 0, cleared: 0, shells: 0, bonus: 0, completed: false,
      stage: 1, previousStage: 0, blendStart: 0, quietUntil: START_DELAY, spawnIn: 0, pendingSignature: null,
      obstacles: [], top: SAFARI.groundTop, vy: 0, onGround: true, jumpsUsed: 0, bufferUntil: -1,
      swimTop: 92, dolphinTop: 95, lastFrame: 0
    });
  }

  // 결과 사진이 떠 있으면 뒤로가기 기록과 함께 먼저 닫고 나서 할 일을 한다
  function afterResultClosed(then) {
    if (BACK.top() === 'result') { BACK.back(then); return true; }
    return false;
  }

  function showPicker() {
    if (afterResultClosed(showPicker)) return;
    if (state.phase === 'playing') finishRun('여행지를 둘러보러 돌아왔어요', true);
    window.WEDDING_SOUND.play('hall');
    cancelAnimationFrame(state.animation);
    hideOverlays();
    result.hidden = true;
    state.phase = 'menu';
    state.mode = null;
    tickets.forEach(ticket => ticket.setAttribute('aria-pressed', 'false'));
    dialog.classList.remove('is-game-view');
    picker.hidden = false;
    play.hidden = true;
    dialog.scrollTop = 0;
  }

  // 달리는 도중에는 여행지를 바꾸지 않는다: 진행 중인 기록이 갑자기 사라지지 않게
  function blockedWhilePlaying() {
    if (state.phase !== 'playing') return false;
    announce('여행 중이에요', '이번 여행이 끝난 뒤에 여행지를 바꿀 수 있어요');
    return true;
  }

  function switchMode(mode) {
    if (state.mode === mode && state.phase !== 'menu') return;
    if (blockedWhilePlaying()) return;
    selectMode(mode);
  }

  function selectMode(mode) {
    if (afterResultClosed(() => selectMode(mode))) return;
    // 게임을 고르기만 했을 때는 예식장 음악이 이어진다
    window.WEDDING_SOUND.play('hall');
    cancelAnimationFrame(state.animation);
    hideOverlays();
    state.mode = mode;
    tickets.forEach(ticket => ticket.setAttribute('aria-pressed', String(ticket.dataset.ticketGame === mode)));
    state.phase = 'ready';
    state.overAt = 0;
    resetRun();
    picker.hidden = true;
    play.hidden = false;
    // 게임 화면에서는 위쪽 소개를 줄여 게임판을 크게 보여준다
    dialog.classList.add('is-game-view');
    result.hidden = true;
    document.querySelector('#game-title').textContent = game().title;
    showInstruction();
    canvas.setAttribute('aria-label', game().title);
    actionButton.textContent = '여행 시작하기 ▶';
    refreshScore();
    renderRankings();
    refreshRankings();
    render();
    dialog.scrollTop = 0;
  }

  function startRun() {
    if (!state.mode || performance.now() - state.overAt < 650) return;
    if (afterResultClosed(startRun)) return;
    resetRun();
    state.phase = 'playing';
    window.WEDDING_SOUND.restart(state.mode);
    // 게임판과 조작 버튼이 한 화면에 들어오게 맞추고, 하는 동안에는 창이 스크롤되지 않게 한다
    dialog.classList.add('is-running');
    dialog.scrollTo({top: Math.max(0, play.offsetTop - tickets[0].parentElement.offsetHeight), behavior: 'instant'});
    result.hidden = true;
    hideOverlays();
    announce(`1/${stageCount()} ${game().places[0]}`, game().hints[0]);
    actionButton.textContent = state.mode === 'safari' ? '점프!' : '위로 헤엄치기!';
    refreshScore();
    renderRankings();
    cancelAnimationFrame(state.animation);
    state.animation = requestAnimationFrame(tick);
  }

  function press() {
    if (state.phase !== 'playing') return;
    if (state.mode === 'safari') pressSafari();
    else pressSea();
  }

  // quiet: 창을 닫거나 여행지 목록으로 돌아가며 끝낼 때는 찰칵 소리를 내지 않는다
  function finishRun(reason = '', quiet = false) {
    if (state.phase !== 'playing') return;
    state.phase = 'over';
    dialog.classList.remove('is-running');
    state.overAt = performance.now();
    cancelAnimationFrame(state.animation);
    hideOverlays();
    render();
    window.WEDDING_SOUND.finish(!quiet);
    const mode = state.mode;
    const run = {guestId: state.guestId, name: state.name, score: state.score};
    runs[mode].push(run);
    runs[mode] = runs[mode].slice(-30);
    saveRuns();
    showResult(reason);
    actionButton.textContent = '다시 도전하기 ↻';
    refreshScore();
    recordRun(mode, run);
  }

  function showResult(reason) {
    const info = game();
    const $ = id => result.querySelector(`#${id}`);
    try { $('film-photo').src = canvas.toDataURL('image/png'); } catch (_) { /* 사진 없이도 결과는 보인다. */ }
    const now = new Date();
    const two = value => String(value).padStart(2, '0');
    $('film-date').textContent = `'${String(now.getFullYear()).slice(2)} ${two(now.getMonth() + 1)} ${two(now.getDate())}`;
    $('film-from').textContent = `From. ${info.country} · ${placeName()}`;
    $('result-film-title').textContent = state.completed ? '신혼여행 완주!' : `${placeName()}까지 함께 왔어요`;
    $('film-reason').textContent = reason;
    $('film-score').textContent = `${state.score}점`;
    $('film-count-label').textContent = info.countLabel;
    $('film-count').textContent = state.mode === 'zanzibar' ? `${state.cleared}개 · 조개 ${state.shells}` : `${state.cleared}마리`;
    $('film-rank').textContent = '확인 중…';
    $('film-stamp').hidden = !state.completed;
    result.hidden = false;
    BACK.push('result', () => { result.hidden = true; });
    result.classList.remove('is-shot');
    void result.offsetWidth;
    result.classList.add('is-shot');
  }

  /* ---------- 순위 ---------- */
  function rankingsForMode() {
    return rankingEntries[state.mode] || [];
  }

  async function refreshRankings() {
    const mode = state.mode;
    const request = ++rankingRequest;
    if (!rankingsForMode().length) ranking.innerHTML = '<li class="is-loading"><span>순위를 불러오는 중…</span></li>';
    try {
      const list = await window.WEDDING_STORE.loadRanking(mode);
      if (request !== rankingRequest || mode !== state.mode) return;
      rankingEntries[mode] = list;
      renderRankings();
    } catch (_) {
      if (request === rankingRequest && !rankingsForMode().length) ranking.innerHTML = '<li class="is-loading"><span>순위를 불러오지 못했어요</span></li>';
    }
  }

  function renderRankings() {
    ranking.replaceChildren();
    const entries = rankingsForMode();
    if (!entries.length) {
      ranking.innerHTML = '<li class="is-empty"><span>첫 번째 여행 기록을 남겨 주세요</span></li>';
      return;
    }
    // 1~5위 자리는 늘 보여 주고, 내 기록이 그 밖이면 맨 아래에 덧붙인다
    const rows = Array.from({length: 5}, (_, index) => entries[index] || {empty: true, index});
    const currentIndex = entries.findIndex(item => item.id && item.id === state.guestId);
    if (currentIndex >= 5) rows.push(entries[currentIndex]);
    rows.forEach(item => {
      const index = item.empty ? item.index : entries.indexOf(item);
      const row = document.createElement('li');
      if (item.empty) row.className = 'is-vacant';
      else if (item.id && item.id === state.guestId) row.className = 'is-current';
      const person = document.createElement('span');
      person.textContent = item.empty ? `${index + 1}위  -` : `${index + 1}위  ${item.name}`;
      const score = document.createElement('span');
      score.textContent = item.empty ? '' : `${item.score}점`;
      row.append(person, score);
      ranking.append(row);
    });
  }

  async function recordRun(mode, run) {
    const rankLabel = result.querySelector('#film-rank');
    try {
      await window.WEDDING_STORE.saveScore(mode, run);
      if (state.mode !== mode || state.phase !== 'over') return;
      // 순위에는 하객마다 가장 높은 점수 하나만 오른다
      const id = run.guestId;
      await refreshRankings();
      const rank = rankingsForMode().findIndex(item => item.id === id) + 1;
      if (state.mode === mode && state.phase === 'over') rankLabel.textContent = rank ? `${rank}위` : '-';
    } catch (_) {
      if (state.mode === mode && state.phase === 'over') rankLabel.textContent = '잠시 후 반영';
    }
  }

  /* ---------- 입력 ---------- */
  for (const button of document.querySelectorAll('.game-choice')) {
    const preview = button.querySelector('canvas');
    const previewCtx = preview.getContext('2d');
    ART.drawPreview(previewCtx, button.dataset.game);
    button.addEventListener('click', () => switchMode(button.dataset.game));
  }
  tickets.forEach(ticket => ticket.addEventListener('click', () => switchMode(ticket.dataset.ticketGame)));
  actionButton.addEventListener('pointerdown', event => {
    if (state.phase !== 'playing') return;
    event.preventDefault();
    press();
  });
  actionButton.addEventListener('click', event => {
    if (state.phase !== 'playing') startRun();
    else if (event.detail === 0) press(); // 키보드로 누른 버튼
  });
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (state.phase === 'playing') press();
    else if (state.phase === 'ready') startRun();
  });
  document.querySelector('#back-to-games').addEventListener('click', () => { if (!blockedWhilePlaying()) showPicker(); });
  result.querySelector('#film-retry').addEventListener('click', () => { state.overAt = 0; startRun(); });
  result.querySelector('#film-close').addEventListener('click', () => BACK.back());
  // 게임 창을 닫으면 그 위의 결과 사진도 함께 닫힌다
  const closeGame = () => BACK.closeTo('game');
  document.querySelector('#honeymoon-close').addEventListener('click', closeGame);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeGame(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeGame(); });
  dialog.addEventListener('close', () => {
    if (state.phase === 'playing') finishRun('여행을 마쳤어요', true);
    window.WEDDING_SOUND.play('hall');
    cancelAnimationFrame(state.animation);
    hideOverlays();
    result.hidden = true;
    state.phase = 'menu';
    document.body.classList.remove('modal-open');
  });
  window.addEventListener('keydown', event => {
    if (!dialog.open || play.hidden || !['Space', 'ArrowUp'].includes(event.code)) return;
    if (event.code === 'Space' && event.target?.closest?.('button')) return;
    event.preventDefault();
    if (event.repeat) return;
    if (state.phase === 'playing') press();
    else startRun();
  });

  window.HONEYMOON_GAME = {
    open(guest) {
      state.name = String(guest?.name || '하객').slice(0, 12);
      state.guestId = String(guest?.guestId || '');
      showPicker();
      dialog.showModal();
      document.body.classList.add('modal-open');
      BACK.push('game', () => dialog.close());
    }
  };
})();
