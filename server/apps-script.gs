/* 온라인 예식장 서버: Google 스프레드시트에 붙인 Apps Script 웹 앱.
   wedding/store.js의 ENDPOINT에 이 웹 앱 주소를 넣으면 모든 하객의 방명록·자리·순위가 이 시트에 모인다.

   설정 (Apps Script 편집기 > 프로젝트 설정 > 스크립트 속성)
   - WINNING_SEATS: 당첨 자리 목록. 예) A2,B4,C1   ← 공개 저장소에는 절대 적지 않는다
   - ADMIN_KEY: 두 분만 아는 문자열. 당첨 결과를 볼 때 쓴다 */

const COLUMNS = {
  guests: ['guestId', 'seat', 'name', 'message', 'avatar', 'at'],
  scores: ['game', 'guestId', 'name', 'score', 'at']
};
const TEST_NAME = /테스트|test/i;

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (error) {
    return reply({error: '요청을 읽지 못했어요'});
  }
  const actions = {loadGuests, claimSeat, updateAvatar, saveScore, loadRanking, loadWinners};
  const action = actions[body.action];
  if (!action) return reply({error: '알 수 없는 요청이에요'});
  try {
    return reply(action(body));
  } catch (error) {
    return reply({error: String(error.message || error)});
  }
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let target = book.getSheetByName(name);
  if (!target) {
    target = book.insertSheet(name);
    target.appendRow(COLUMNS[name]);
  }
  return target;
}

function rows(name) {
  const values = sheet(name).getDataRange().getValues();
  const head = values.shift();
  return values.map(row => Object.fromEntries(head.map((key, i) => [key, row[i]])));
}

// 동시에 같은 자리를 고르는 요청이 와도 한 번에 하나씩 처리한다
function withLock(work) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

// 시트 수식으로 읽히지 않게 앞에 작은따옴표를 붙인다
const text = (value, max) => {
  const clean = String(value || '').trim().slice(0, max);
  return /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
};
const parseAvatar = value => {
  try { return JSON.parse(value); } catch (error) { return {}; }
};
const property = key => PropertiesService.getScriptProperties().getProperty(key) || '';
const winningSeats = () => property('WINNING_SEATS').split(',').map(seat => seat.trim()).filter(Boolean);

function loadGuests() {
  // at: 자리에 앉은 시각(밀리초). 예식장 위의 TODAY·TOTAL을 세는 데 쓴다
  return {guests: rows('guests').map(guest => ({seat: guest.seat, name: guest.name, message: guest.message, avatar: parseAvatar(guest.avatar), at: Number(guest.at) || null}))};
}

function claimSeat(body) {
  const guestId = text(body.guestId, 64);
  const seat = text(body.seat, 4);
  if (!guestId || !/^[A-L][1-8]$/.test(seat)) throw new Error('잘못된 요청이에요');
  return withLock(() => {
    const guests = rows('guests');
    // 같은 하객의 재시도·연타는 새로 등록하지 않고 앞의 자리를 돌려준다
    const mine = guests.find(guest => guest.guestId === guestId);
    if (mine) return {ok: true, seat: mine.seat, won: winningSeats().includes(mine.seat), already: true};
    const owner = guests.find(guest => guest.seat === seat);
    if (owner) return {ok: false, reason: 'taken', guest: {seat, name: owner.name, message: owner.message, avatar: parseAvatar(owner.avatar)}};
    sheet('guests').appendRow([guestId, seat, text(body.name, 12), text(body.message, 120), JSON.stringify(body.avatar || {}), Date.now()]);
    return {ok: true, seat, won: winningSeats().includes(seat)};
  });
}

// 앉은 뒤 옷 갈아입기: 그 하객의 미니미만 바꾼다
function updateAvatar(body) {
  const guestId = text(body.guestId, 64);
  if (!guestId) throw new Error('잘못된 요청이에요');
  return withLock(() => {
    const target = sheet('guests');
    const values = target.getDataRange().getValues();
    const idColumn = values[0].indexOf('guestId');
    const avatarColumn = values[0].indexOf('avatar');
    const index = values.findIndex((row, i) => i > 0 && row[idColumn] === guestId);
    if (index < 0) return {ok: false, reason: 'not-seated'};
    target.getRange(index + 1, avatarColumn + 1).setValue(JSON.stringify(body.avatar || {}));
    return {ok: true};
  });
}

function saveScore(body) {
  const game = body.game === 'zanzibar' ? 'zanzibar' : 'safari';
  const guestId = text(body.guestId, 64);
  const score = Math.floor(Number(body.score));
  if (!guestId || !Number.isFinite(score) || score < 0 || score > 100000) throw new Error('잘못된 점수예요');
  withLock(() => sheet('scores').appendRow([game, guestId, text(body.name, 12), score, Date.now()]));
  return {id: guestId};
}

// 같은 하객은 가장 높은 점수 하나만, 점수가 같으면 먼저 세운 기록이 앞선다
function bestRanking(game) {
  const best = new Map();
  for (const item of rows('scores')) {
    if (item.game !== game || TEST_NAME.test(String(item.name))) continue;
    const before = best.get(item.guestId);
    if (!before || item.score > before.score || (item.score === before.score && item.at < before.at)) {
      best.set(item.guestId, {id: item.guestId, name: item.name, score: Number(item.score), at: Number(item.at)});
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.at - b.at);
}

function loadRanking(body) {
  return {ranking: bestRanking(body.game === 'zanzibar' ? 'zanzibar' : 'safari').slice(0, 50)};
}

// 두 분 확인용: 당첨 자리와 하객, 게임별 1등
function loadWinners(body) {
  if (!property('ADMIN_KEY') || body.key !== property('ADMIN_KEY')) throw new Error('볼 수 있는 권한이 없어요');
  const guests = rows('guests');
  return {
    seats: winningSeats().map(seat => {
      const owner = guests.find(guest => guest.seat === seat && !TEST_NAME.test(String(guest.name)));
      return {seat, guest: owner ? {name: owner.name, message: owner.message, at: owner.at} : null};
    }),
    games: {safari: bestRanking('safari')[0] || null, zanzibar: bestRanking('zanzibar')[0] || null}
  };
}
