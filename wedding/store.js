/* 예식장이 서버와 주고받는 일을 모은 곳. 화면 코드는 이 함수들만 쓴다.
   - ENDPOINT가 비어 있으면: 이 브라우저 안에서 서버처럼 동작하는 체험용 더미 서버를 쓴다(기록은 이 기기에만 남는다).
   - ENDPOINT에 구글 Apps Script 웹 앱 주소를 넣으면: 모든 하객의 방명록·자리·순위가 한곳에 모인다(server/apps-script.gs).
   하객 한 명은 기기마다 한 번 만든 guestId로 구분한다. 같은 guestId로 다시 보내면 새로 등록하지 않고 앞의 기록을 돌려준다. */
(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycby5Q2_u27HZe8KPSEyG1eFX9986jUGH7KRZEbrCoY0-W1Hz8FxKVYy_OGrp1LF2JSwr/exec';
  // 순위와 선물 선정에서 빼는 이름: 기능 확인용으로 남긴 기록
  const TEST_NAME = /테스트|test/i;
  const isRealName = name => !TEST_NAME.test(String(name || ''));

  /* ---------- 실제 서버 ---------- */
  async function call(action, payload = {}) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      // text/plain이면 브라우저가 사전 확인 요청을 보내지 않아 Apps Script와 바로 통한다
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, ...payload})
    });
    if (!response.ok) throw new Error(`서버 응답 ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  const server = {
    mode: 'server',
    loadGuests: async () => (await call('loadGuests')).guests,
    claimSeat: payload => call('claimSeat', payload),
    updateAvatar: payload => call('updateAvatar', payload),
    saveScore: (game, payload) => call('saveScore', {game, ...payload}),
    loadRanking: async game => (await call('loadRanking', {game})).ranking.filter(item => isRealName(item.name)),
    // 두 분 확인용: Apps Script의 ADMIN_KEY가 있어야 한다
    loadWinners: key => call('loadWinners', {key})
  };

  /* ---------- 체험용 더미 서버 (이 브라우저 안) ---------- */
  const DB_KEY = 'wedding-dummy-server-v1';
  // 체험용 당첨 자리: 실제 당첨 자리는 Apps Script의 스크립트 속성(WINNING_SEATS)에만 넣는다
  const DEMO_WINNING_SEATS = ['A2', 'A7', 'B4', 'C1', 'D6', 'E3', 'F8', 'G5', 'H1', 'I6', 'J3', 'K8'];
  const SAMPLE_GUESTS = [
    ['A4', '지은', '두 분의 오늘이 오래도록 따뜻하게 기억되길 바라요!', {hair: 'bob', top: 'rose', bottomType: 'skirt', skirt: 'ivory', accessory: 'ribbon'}],
    ['B7', '민호', '행복한 날에 함께할 수 있어 정말 기뻐요.', {hair: 'side', top: 'sky', pants: 'beige', accessory: 'glasses'}],
    ['C2', '서연', '앞으로의 모든 계절을 응원합니다. 축하해요!', {hair: 'long', hairColor: 'brown', top: 'cream', bottomType: 'skirt', skirt: 'pink', accessory: 'necklace'}],
    ['D8', '도윤', '웃음 가득한 하루가 계속되길 바라요.', {hair: 'neat', hairColor: 'chestnut', top: 'lemon', pants: 'denim', accessory: 'tie'}],
    ['E4', '하린', '서로의 가장 좋은 친구로 오래오래 함께해요.', {hair: 'pony', top: 'lilac', bottomType: 'skirt', skirt: 'blue', accessory: 'flower'}],
    ['F1', '유진', '오늘처럼 반짝이는 순간이 가득하길!', {hair: 'bob', hairColor: 'ash', top: 'sky', bottomType: 'pants', pants: 'cocoa', accessory: 'beret'}],
    ['G7', '수아', '두 분의 새 출발을 진심으로 축하해요.', {hair: 'long', hairColor: 'blonde', top: 'rose', bottomType: 'skirt', skirt: 'mint', accessory: 'ribbon'}],
    ['H3', '준서', '언제나 서로에게 포근한 집이 되어주세요.', {hair: 'side', top: 'cream', pants: 'charcoal', accessory: 'cap'}],
    ['I8', '채원', '행복이 꽃처럼 피어나는 날들이길 바라요.', {hair: 'pony', hairColor: 'brown', top: 'lemon', bottomType: 'skirt', skirt: 'violet', accessory: 'necklace'}],
    ['J2', '현우', '아름다운 시작에 마음을 보탭니다.', {hair: 'neat', top: 'lilac', pants: 'navy', accessory: 'headphones'}],
    ['K6', '나은', '오늘의 기쁨을 오래오래 간직하세요!', {hair: 'bob', top: 'cream', bottomType: 'skirt', skirt: 'blue', accessory: 'flower'}],
    ['L4', '소율', '두 분의 모든 내일을 응원할게요.', {hair: 'long', hairColor: 'chestnut', top: 'sky', bottomType: 'pants', pants: 'beige', accessory: 'beret'}]
  ].map(([seat, name, message, avatar]) => ({seat, name, message, avatar, sample: true}));

  const clone = value => JSON.parse(JSON.stringify(value));
  const wait = (min, max) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

  function readDb() {
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY));
      if (saved && Array.isArray(saved.guests) && saved.scores) return saved;
    } catch (_) { /* 저장소를 못 쓰면 빈 상태로 시작한다. */ }
    return {guests: [], scores: {safari: [], zanzibar: []}};
  }

  function writeDb(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (_) { /* 저장소를 못 쓰면 저장하지 않고 넘어간다. */ }
  }

  const allGuests = db => [...SAMPLE_GUESTS, ...db.guests];
  // 예전 기록에는 guestId가 없어서 이름으로 같은 사람을 묶는다
  const playerOf = item => item.guestId || `name:${item.name}`;

  // 같은 하객은 가장 높은 점수 하나만, 점수가 같으면 먼저 세운 기록이 앞선다
  function bestPerPlayer(records) {
    const best = new Map();
    for (const item of records) {
      if (!isRealName(item.name)) continue;
      const id = playerOf(item);
      const before = best.get(id);
      if (!before || item.score > before.score || (item.score === before.score && (item.at || '') < (before.at || ''))) {
        best.set(id, {id, name: item.name, score: item.score, at: item.at || ''});
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
  }

  const demo = {
    mode: 'demo',
    async loadGuests() {
      await wait(400, 800);
      return clone(allGuests(readDb()).map(({seat, name, message, avatar}) => ({seat, name, message, avatar})));
    },
    async claimSeat({guestId, seat, name, message, avatar}) {
      await wait(900, 1500);
      const db = readDb();
      // 같은 하객이 다시 보낸 요청(연타·재시도)이면 앞서 앉은 자리를 그대로 돌려준다
      const mine = db.guests.find(item => item.guestId && item.guestId === guestId);
      if (mine) return {ok: true, seat: mine.seat, won: DEMO_WINNING_SEATS.includes(mine.seat), already: true};
      const owner = allGuests(db).find(item => item.seat === seat);
      if (owner) return {ok: false, reason: 'taken', guest: clone({seat, name: owner.name, message: owner.message, avatar: owner.avatar})};
      db.guests.push({guestId, seat, name, message, avatar, at: new Date().toISOString()});
      writeDb(db);
      return {ok: true, seat, won: DEMO_WINNING_SEATS.includes(seat)};
    },
    async updateAvatar({guestId, avatar}) {
      await wait(300, 600);
      const db = readDb();
      const mine = db.guests.find(item => item.guestId && item.guestId === guestId);
      if (!mine) return {ok: false, reason: 'not-seated'};
      mine.avatar = avatar;
      writeDb(db);
      return {ok: true};
    },
    async saveScore(game, {guestId, name, score}) {
      await wait(250, 500);
      const db = readDb();
      db.scores[game] = [...(db.scores[game] || []), {guestId, name, score, at: new Date().toISOString()}].slice(-300);
      writeDb(db);
      return {id: guestId};
    },
    async loadRanking(game) {
      await wait(250, 500);
      return clone(bestPerPlayer(readDb().scores[game] || []));
    },
    /** 두 분 확인용: 당첨 자리와 거기 앉은 하객 [{seat, guest|null}] */
    async loadWinners() {
      const guests = readDb().guests;
      return clone(DEMO_WINNING_SEATS.map(seat => {
        const owner = guests.find(item => item.seat === seat && isRealName(item.name));
        return {seat, guest: owner ? {name: owner.name, message: owner.message, at: owner.at} : null};
      }));
    }
  };

  window.WEDDING_STORE = ENDPOINT ? server : demo;
})();
