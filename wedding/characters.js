/* 직접 그린 픽셀아트 미니미. 고른 머리·옷·액세서리로 SVG를 만든다. */
(() => {
  'use strict';
  const hairs = [
    {id: 'neat', label: '단정 숏컷', group: 'short'},
    {id: 'side', label: '가르마 숏컷', group: 'short'},
    {id: 'bob', label: '동글 단발', group: 'long'},
    {id: 'long', label: '긴 머리', group: 'long'},
    {id: 'pony', label: '포니테일', group: 'long'}
  ];
  const colors = {
    hair: [
      {id: 'dark', label: '검정', hex: '#34313a'},
      {id: 'brown', label: '초코', hex: '#68483f'},
      {id: 'chestnut', label: '밤색', hex: '#9a6450'},
      {id: 'ash', label: '애쉬', hex: '#81777d'},
      {id: 'blonde', label: '금발', hex: '#c99d69'}
    ],
    top: [
      {id: 'cream', label: '크림', hex: '#f7e8d9'},
      {id: 'rose', label: '딸기우유', hex: '#e9a6b7'},
      {id: 'sky', label: '하늘', hex: '#a7c9e7'},
      {id: 'lemon', label: '레몬', hex: '#f5d989'},
      {id: 'lilac', label: '라일락', hex: '#c9b2df'}
    ],
    pants: [
      {id: 'navy', label: '네이비', hex: '#566782'},
      {id: 'denim', label: '데님', hex: '#85a8cc'},
      {id: 'beige', label: '베이지', hex: '#d8bea3'},
      {id: 'cocoa', label: '코코아', hex: '#937368'},
      {id: 'charcoal', label: '차콜', hex: '#676a74'}
    ],
    skirt: [
      {id: 'pink', label: '분홍', hex: '#e8aaba'},
      {id: 'ivory', label: '아이보리', hex: '#eee1c9'},
      {id: 'violet', label: '보라', hex: '#baa2d4'},
      {id: 'mint', label: '민트', hex: '#a7cbbc'},
      {id: 'blue', label: '파랑', hex: '#91b8d7'}
    ]
  };
  const skins = [
    {id: 'light', label: '밝은 피부', hex: '#f8dfc8'},
    {id: 'warm', label: '살구 피부', hex: '#f0caa9'},
    {id: 'deep', label: '갈색 피부', hex: '#cc9a78'}
  ];
  const accessories = {
    // view: 고르기 버튼에서 미니미의 어느 부분을 잘라 보여줄지 (SVG viewBox)
    short: [
      {id: 'none', label: '없음'},
      {id: 'glasses', label: '안경', view: '4 9 24 13'},
      {id: 'tie', label: '넥타이', view: '6 22 20 14'},
      {id: 'cap', label: '캡모자', view: '3 0 26 18'},
      {id: 'headphones', label: '헤드폰', view: '1 0 30 22'}
    ],
    long: [
      {id: 'none', label: '없음'},
      {id: 'ribbon', label: '리본', view: '4 0 26 20'},
      {id: 'beret', label: '베레모', view: '2 0 28 18'},
      {id: 'necklace', label: '목걸이', view: '7 22 18 11'},
      {id: 'flower', label: '꽃핀', view: '4 0 26 20'}
    ]
  };
  const defaults = Object.freeze({
    hair: 'neat', hairColor: 'dark', skin: 'light', top: 'sky',
    bottomType: 'pants', pants: 'navy', skirt: 'pink', accessory: 'none'
  });
  const pick = (items, id, fallback) => items.find(item => item.id === id) || items.find(item => item.id === fallback) || items[0];
  const groupOf = hair => pick(hairs, hair, defaults.hair).group;

  function normalize(value = {}) {
    const avatar = {...defaults};
    avatar.hair = pick(hairs, value.hair, defaults.hair).id;
    avatar.hairColor = pick(colors.hair, value.hairColor, defaults.hairColor).id;
    avatar.skin = pick(skins, value.skin, defaults.skin).id;
    avatar.top = pick(colors.top, value.top, defaults.top).id;
    avatar.bottomType = value.bottomType === 'skirt' ? 'skirt' : 'pants';
    avatar.pants = pick(colors.pants, value.pants, defaults.pants).id;
    avatar.skirt = pick(colors.skirt, value.skirt, defaults.skirt).id;
    avatar.accessory = pick(accessories[groupOf(avatar.hair)], value.accessory, 'none').id;
    return avatar;
  }

  /* ---------- 그리기: 싸이월드 미니미 비율(머리가 키의 절반이 조금 안 됨), 32×52 칸에 한 점씩 찍는다 ---------- */
  const W = 32, H = 52;
  // 베일은 비치는 천이라 테두리를 연하게 둔다
  const VEIL = '#f8f4f1';
  const VEIL_EDGE = '#dcd2cf';
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (hex, other, amount) => '#' + rgb(hex)
    .map((v, i) => Math.round(v + (rgb(other)[i] - v) * amount).toString(16).padStart(2, '0'))
    .join('');
  const brightness = hex => rgb(hex).reduce((sum, v, i) => sum + v * [.3, .59, .11][i], 0);
  // 부위마다 같은 색 계열의 진한 테두리를 쓴다
  const lineOf = hex => mix(hex, '#2a1a1c', .6);
  const shadowOf = hex => mix(hex, '#5a4560', .13);

  function canvas() {
    const cells = new Map();
    let pen = '#3a2a2c';
    const key = (x, y) => y * W + x;
    const set = (x, y, color) => { if (x >= 0 && x < W && y >= 0 && y < H) cells.set(key(x, y), [color, pen]); };
    return {
      cells,
      set,
      // 빈 칸에만 칠한다(이미 그린 것 뒤에 놓인다)
      under(list, color) { for (const [y, from, to] of list) for (let x = from; x <= to; x++) if (!cells.has(key(x, y))) set(x, y, color); },
      // 이어서 칠하는 부위의 바깥 테두리 색
      pen(color) { pen = color; },
      // [줄, 시작 칸, 끝 칸] 목록으로 칠한다
      rows(list, color) { for (const [y, from, to] of list) for (let x = from; x <= to; x++) set(x, y, color); },
      rect(x, y, w, h, color) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, color); },
      // 이미 칠해진 칸 가운데 그 색인 칸만 다시 칠한다(머리 윤기, 그늘)
      tint(list, color, only) { for (const [y, from, to] of list) for (let x = from; x <= to; x++) if (cells.get(key(x, y))?.[0] === only) set(x, y, color); },
      get: (x, y) => cells.get(key(x, y))?.[0]
    };
  }

  // 아직 테두리가 없는 부위에 바깥 테두리를 한 칸 두른다
  function outline(c) {
    const edges = new Map();
    for (const [index, [, line, done]] of c.cells) {
      if (done) continue;
      const x = index % W, y = Math.floor(index / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H || c.cells.has(ny * W + nx)) continue;
        // 여러 부위에 닿으면 더 진한 테두리를 쓴다
        const at = ny * W + nx;
        if (!edges.has(at) || brightness(line) < brightness(edges.get(at))) edges.set(at, line);
      }
    }
    for (const [at, line] of edges) c.cells.set(at, [line, line]);
    for (const cell of c.cells.values()) cell[2] = true;
  }

  // SVG로 만든다(같은 색이 이어진 칸은 하나로 묶는다)
  function toSvg(c) {
    outline(c);
    let rects = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W;) {
        const color = c.get(x, y);
        if (!color) { x++; continue; }
        let end = x;
        while (end + 1 < W && c.get(end + 1, y) === color) end++;
        rects += `<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${color}"/>`;
        x = end + 1;
      }
    }
    return rects;
  }

  const HEAD = [[4, 12, 19], [5, 10, 21], [6, 8, 23], [7, 7, 24], ...Array.from({length: 11}, (_, i) => [8 + i, 6, 25]),
    [19, 7, 24], [20, 7, 24], [21, 8, 23], [22, 10, 21], [23, 12, 19]];
  const range = (from, to, x1, x2) => Array.from({length: to - from + 1}, (_, i) => [from + i, x1, x2]);

  function drawHairBack(c, hair, color, dark) {
    if (hair === 'bob') {
      c.rows([[7, 6, 25], [8, 5, 26], ...range(9, 21, 4, 27), [22, 5, 9], [22, 22, 26]], color);
    }
    if (hair === 'long') {
      c.rows([[7, 6, 25], [8, 5, 26], ...range(9, 30, 4, 27), [31, 4, 8], [31, 23, 27], [32, 4, 7], [32, 24, 27], [33, 5, 6], [33, 25, 26]], color);
      c.rows([...range(16, 31, 5, 5), ...range(19, 32, 26, 26)], dark);
    }
    if (hair === 'updo') c.rows([[0, 14, 17], [1, 12, 19], [2, 12, 19], [3, 13, 18]], color);
    if (hair === 'pony') {
      c.rows([[5, 24, 27], [6, 24, 28], [7, 24, 28], [8, 25, 29], ...range(9, 15, 26, 29), ...range(16, 19, 26, 28), [20, 27, 28], [21, 27, 27]], color);
    }
  }

  function drawHairFront(c, hair, color, light, dark, line) {
    // 정수리는 머리 위쪽을 모두 덮는다
    const top = hair === 'long' || hair === 'updo' ? 10 : hair === 'side' ? 9 : 12;
    c.rows(HEAD.filter(([y]) => y <= top), color);
    if (hair === 'neat') {
      c.rows([[3, 12, 13], [3, 17, 18], [13, 6, 8], [13, 11, 12], [13, 16, 17], [13, 21, 25], ...range(14, 17, 6, 6), ...range(14, 17, 25, 25)], color);
    }
    if (hair === 'side') {
      // 가르마: 이마 오른쪽이 드러나고 앞머리가 왼쪽으로 넘어간다
      c.rows([[3, 13, 19], [2, 15, 18], [10, 6, 8], [10, 12, 25], [11, 6, 7], [11, 15, 25], [12, 6, 6], [12, 18, 25], [13, 21, 25], [14, 23, 25], ...range(13, 17, 6, 6), ...range(15, 17, 25, 25)], color);
    }
    if (hair === 'bob' || hair === 'pony') {
      c.rows([[13, 6, 8], [13, 10, 14], [13, 17, 21], [13, 23, 25]], color);
    }
    if (hair === 'bob') c.rows([...range(13, 22, 5, 7), ...range(13, 22, 24, 26)], color);
    if (hair === 'pony') c.rows([...range(14, 16, 6, 6), ...range(14, 16, 25, 25)], color);
    if (hair === 'updo') {
      // 가운데 가르마로 넘겨 귀 뒤로 묶은 머리
      c.rows([[11, 6, 13], [11, 18, 25], [12, 6, 10], [12, 21, 25], [13, 6, 8], [13, 23, 25], ...range(14, 16, 6, 6), ...range(14, 16, 25, 25)], color);
    }
    if (hair === 'long') {
      // 가운데 가르마, 양옆으로 흘러내린 앞머리
      c.rows([[11, 6, 13], [11, 18, 25], [12, 6, 11], [12, 20, 25], [13, 6, 9], [13, 22, 25], ...range(14, 23, 5, 7), ...range(14, 23, 24, 26)], color);
    }
    // 윤기 띠와 오른쪽 그늘
    c.tint([[6, 10, 12], [6, 19, 21], [7, 9, 22], [8, 13, 18]], light, color);
    c.tint([[5, 21, 21], [6, 23, 23], [7, 24, 24], ...range(8, 22, 24, 26)], dark, color);
    if (hair === 'side') { c.tint([[5, 11, 11], [6, 11, 11], [7, 11, 11], [8, 10, 10], [9, 10, 10]], dark, color); c.tint([[6, 11, 11], [7, 11, 11]], dark, light); }
    if (hair === 'long' || hair === 'updo') { c.tint([[7, 15, 16]], dark, light); c.tint([[4, 15, 16], [5, 15, 16], [6, 15, 16]], dark, color); }
    // 얼굴과 닿는 머리 끝은 진한 선으로 나눈다
    for (let x = 4; x <= 27; x++) {
      for (let y = 9; y <= 23; y++) {
        const here = c.get(x, y);
        if ((here === color || here === dark) && c.get(x, y + 1) && ![color, dark, line].includes(c.get(x, y + 1))) c.set(x, y, line);
      }
    }
  }

  function drawFace(c, skin, skinLine, skinShadow, glasses) {
    c.pen(skinLine);
    c.rows(HEAD, skin);
    // 오른쪽 볼과 턱 밑 그늘
    for (const [y, , to] of HEAD) if (y >= 13) c.set(to, y, skinShadow);
    c.rows([[23, 12, 19]], skinShadow);
    // 반짝이는 눈, 볼터치, 활짝 웃는 입
    for (const x of [9, 21]) { c.rect(x, 15, 2, 3, '#1f1719'); c.set(x, 16, '#ffffff'); }
    c.rows(glasses ? [[19, 7, 9], [19, 22, 24]] : [[18, 7, 8], [19, 7, 9], [18, 23, 24], [19, 22, 24]], '#fb8e92');
    c.rows([[19, 13, 18], [20, 13, 13], [20, 18, 18], [21, 14, 14], [21, 17, 17], [22, 15, 16]], '#a8473a');
    c.rows([[20, 14, 17], [21, 15, 16]], '#f2737a');
    c.rows([[21, 15, 16]], '#ff9fa0');
  }

  function render(value = {}, formal = '') {
    const avatar = normalize(value);
    const hair = formal === 'groom' ? 'side' : formal === 'bride' ? 'updo' : avatar.hair;
    const hairColor = formal === 'groom' ? '#2c2a30' : formal === 'bride' ? '#3d2c2a' : pick(colors.hair, avatar.hairColor, defaults.hairColor).hex;
    const skin = pick(skins, avatar.skin, defaults.skin).hex;
    const skinLine = mix(skin, '#6e2c14', .72);
    const skinShadow = mix(skin, '#e07a48', .28);
    const isSkirt = formal !== 'groom' && avatar.bottomType === 'skirt';
    const top = formal === 'groom' ? '#34353d' : pick(colors.top, avatar.top, defaults.top).hex;
    const bottomKind = isSkirt ? 'skirt' : 'pants';
    const bottom = formal === 'groom' ? '#34353d' : pick(colors[bottomKind], avatar[bottomKind], defaults[bottomKind]).hex;
    const accessory = formal ? 'none' : avatar.accessory;
    const hairLine = mix(hairColor, '#160c0c', .62);
    const c = canvas();

    // 뒷머리는 몸보다 뒤에 있다
    c.pen(hairLine);
    drawHairBack(c, hair, hairColor, mix(hairColor, '#160c0c', .25));

    if (formal === 'bride') {
      // 어깨와 팔이 드러난 튜브톱 웨딩드레스, 허리 아래로 넓게 퍼진다
      const dress = '#fdfbf7', fold = '#ece4de';
      c.pen(skinLine);
      c.rows([[25, 9, 22], ...range(26, 27, 8, 23), ...range(28, 34, 8, 8), ...range(28, 34, 23, 23)], skin);
      c.rows([...range(26, 34, 23, 23)], skinShadow);
      c.rows([...range(35, 37, 7, 8), ...range(35, 37, 23, 24), [36, 24, 24], [37, 8, 8], [37, 24, 24]], skin);
      c.rows([[36, 24, 24], [37, 8, 8], [37, 24, 24]], skinShadow);
      c.pen('#aa9f9c');
      c.rows([...range(28, 35, 10, 21)], dress);
      for (let i = 0; i <= 12; i++) c.rows([[36 + i, 10 - Math.ceil(i * .55), 21 + Math.ceil(i * .55)]], dress);
      c.rows([[28, 10, 21]], '#f3ece6');
      c.rows([[33, 10, 21]], '#efe5dd');
      c.rows([...range(29, 35, 21, 21)], fold);
      for (const [x, y1] of [[8, 41], [12, 38], [19, 38], [23, 41]]) for (let y = y1; y <= 47; y++) c.set(x, y, fold);
      c.rows([[48, 3, 28]], fold);
    } else {
      const topLine = lineOf(top), topShadow = shadowOf(top);
      const bottomLine = lineOf(bottom), bottomShadow = shadowOf(bottom);
      const shoe = formal === 'groom' ? '#232227' : '#5c4a51';
      // 다리·양말·신발
      const legTop = formal === 'groom' ? 37 : isSkirt ? 40 : 39;
      c.pen(formal === 'groom' ? bottomLine : skinLine);
      for (const x of [11, 18]) {
        c.rect(x, legTop, 3, 48 - legTop, formal === 'groom' ? bottom : skin);
        c.rect(x + 2, legTop, 1, 48 - legTop, formal === 'groom' ? bottomShadow : skinShadow);
      }
      if (!formal) {
        c.pen('#9c98a6');
        c.rect(11, 45, 3, 3, '#ffffff'); c.rect(18, 45, 3, 3, '#ffffff');
        c.rows([[45, 13, 13], [45, 20, 20]], '#e6e3ee');
      }
      c.pen(lineOf(shoe));
      c.rows([[48, 10, 14], [49, 10, 14], [48, 17, 21], [49, 17, 21]], shoe);
      c.set(11, 48, mix(shoe, '#ffffff', .35)); c.set(18, 48, mix(shoe, '#ffffff', .35));

      // 몸통과 소매, 소매 아래로 나온 팔
      c.pen(topLine);
      const bodyEnd = formal === 'groom' ? 37 : 34;
      c.rows([...range(25, bodyEnd, 10, 21), [25, 8, 9], [25, 22, 23], ...range(26, 28, 7, 9), ...range(26, 28, 22, 24)], top);
      if (formal === 'groom') c.rows([...range(29, 34, 7, 8), ...range(29, 34, 23, 24)], top);
      c.rows([...range(26, bodyEnd, 21, 21), [28, 7, 9], [28, 22, 24]], topShadow);
      c.rows([...range(formal === 'groom' ? 27 : 29, bodyEnd, 9, 9), ...range(formal === 'groom' ? 27 : 29, bodyEnd, 22, 22)], topLine);
      if (formal === 'groom') c.rows([[34, 7, 8], [34, 23, 24]], '#f4f1ea');
      c.pen(skinLine);
      if (formal !== 'groom') c.rows([...range(29, 34, 8, 8), ...range(29, 34, 23, 23)], skin);
      c.rows([...range(35, 37, 7, 8), ...range(35, 37, 23, 24), [37, 8, 8], [37, 24, 24]], skin);
      c.rows([[37, 8, 8], [37, 24, 24], [36, 24, 24]], skinShadow);
      // 목과 둥근 목둘레
      c.rows([[25, 13, 18], [26, 14, 17]], skin);
      c.rows([[26, 13, 13], [26, 18, 18], [27, 14, 17]], topLine);

      if (formal === 'groom') {
        // 검은 정장, 흰 셔츠, 아이보리 넥타이, 흰 부토니에르
        c.rows([[25, 12, 12], [25, 19, 19], [26, 13, 18], [27, 13, 18], [28, 14, 17], [29, 14, 17], [30, 15, 16], [31, 15, 16]], '#f7f5f0');
        c.rows([[25, 14, 17]], skin);
        c.rows([[26, 15, 16], [27, 15, 16], [28, 15, 16], [29, 15, 16], [30, 15, 16]], '#e9dfc6');
        c.rows([[26, 15, 16]], '#f3ead4');
        c.rows([[27, 12, 12], [28, 13, 13], [29, 13, 13], [30, 14, 14], [31, 14, 14], [32, 15, 16], [27, 19, 19], [28, 18, 18], [29, 18, 18], [30, 17, 17], [31, 17, 17]], '#1f2026');
        c.rows([[34, 15, 16], [36, 15, 16], [37, 15, 16]], '#1f2026');
        c.rows([[28, 19, 20]], '#ffffff'); c.set(19, 29, '#f2d6dd'); c.set(20, 29, '#93b48b');
      } else if (accessory !== 'tie' && accessory !== 'necklace') {
        // 가슴의 작은 하트(싸이월드 미니미처럼)
        const heart = brightness(top) > 225 ? '#f08ba5' : '#ffffff';
        c.rows([[29, 13, 14], [29, 17, 18], [30, 13, 18], [31, 14, 17], [32, 15, 16]], heart);
      }

      // 하의
      if (formal !== 'groom') {
        c.pen(bottomLine);
        if (isSkirt) {
          c.rows([[35, 10, 21], [36, 10, 21], [37, 9, 22], [38, 9, 22], [39, 8, 23]], bottom);
          c.rows([[39, 8, 23], ...range(37, 39, 12, 12), ...range(37, 39, 16, 16), ...range(37, 39, 20, 20)], bottomShadow);
        } else {
          c.rows([...range(35, 38, 10, 21)], bottom);
          c.rows([[35, 10, 21], ...range(36, 38, 21, 21)], bottomShadow);
          c.rows([[37, 15, 16], [38, 15, 16]], bottomLine);
        }
        c.rows([...range(35, 37, 10, 10)], bottomLine);
        c.rows([...range(35, 37, 21, 21)], bottomLine);
      }
    }

    // 얼굴과 앞머리
    drawFace(c, skin, skinLine, skinShadow, accessory === 'glasses');
    c.pen(hairLine);
    drawHairFront(c, hair, hairColor, mix(hairColor, '#ffe6c4', .24), mix(hairColor, '#160c0c', .25), hairLine);
    if (formal === 'bride') {
      // 진주 머리장식
      c.pen('#b9aea6');
      for (const x of [9, 11, 13, 15, 16, 18, 20, 22]) c.set(x, x < 12 || x > 19 ? 6 : 5, '#fffaf0');
      c.set(15, 4, '#f4dfe4'); c.set(16, 4, '#f4dfe4');
    }

    // 액세서리
    if (accessory === 'glasses') {
      c.pen('#2c3140');
      const frame = '#323848';
      for (const x of [7, 19]) {
        c.rows([[14, x + 1, x + 4], [18, x + 1, x + 4]], frame);
        c.rect(x, 15, 1, 3, frame); c.rect(x + 5, 15, 1, 3, frame);
        c.set(x + 4, 15, '#ffffff');
      }
      c.rows([[15, 13, 18], [15, 6, 6], [15, 25, 25]], frame);
    }
    if (accessory === 'tie') {
      c.pen('#7e3550');
      c.rows([[26, 13, 14], [26, 17, 18]], '#ffffff');
      c.rows([[26, 15, 16], [27, 15, 16], [28, 15, 16], [29, 14, 17], [30, 14, 17], [31, 14, 17], [32, 15, 16]], '#c9607f');
      c.rows([[26, 15, 16]], '#de809b');
      c.rows([[29, 17, 17], [30, 17, 17], [31, 17, 17]], '#ad4f6c');
    }
    if (accessory === 'cap') {
      c.pen('#3f5878');
      c.rows([[1, 15, 16], [2, 11, 20], [3, 9, 22], [4, 8, 23], ...range(5, 8, 7, 24)], '#7d9cc0');
      c.rows([[3, 11, 14], [4, 10, 12]], '#a7c0dc');
      c.rows([...range(3, 8, 15, 15)], '#6c8bb0');
      c.rows([[9, 5, 26], [10, 6, 25]], '#5f7fa5');
      c.rows([[9, 6, 25]], '#6c8bb0');
    }
    if (accessory === 'headphones') {
      c.pen('#3d4258');
      const band = '#666c8a';
      c.rows([[1, 11, 20], [2, 9, 10], [2, 21, 22], [3, 8, 8], [3, 23, 23], [4, 7, 7], [4, 24, 24], ...range(5, 11, 6, 6), ...range(5, 11, 25, 25)], band);
      c.rows([...range(12, 18, 3, 5), ...range(12, 18, 26, 28)], band);
      c.rows([...range(13, 17, 6, 6), ...range(13, 17, 25, 25)], '#e8a7ba');
      c.rows([[13, 4, 4], [13, 27, 27]], '#8d93b0');
    }
    if (accessory === 'ribbon') {
      c.pen('#a64f6c');
      c.rows([[2, 18, 19], [2, 23, 24], [3, 17, 20], [3, 22, 25], [4, 17, 25], [5, 17, 20], [5, 22, 25], [6, 18, 19], [6, 23, 24]], '#f59ab2');
      c.rows([[3, 18, 18], [3, 23, 23]], '#ffc4d3');
      c.rows([[3, 21, 21], [4, 21, 21], [5, 21, 21]], '#d4718e');
    }
    if (accessory === 'beret') {
      c.pen('#62507e');
      c.rows([[0, 16, 17], [1, 9, 22], [2, 6, 25], [3, 5, 26], [4, 5, 26], [5, 6, 25]], '#b6a0d6');
      c.rows([[2, 9, 13], [3, 8, 10]], '#d2c3e8');
      c.rows([[6, 7, 24]], '#9a83bf');
    }
    if (accessory === 'necklace') {
      c.pen('#a0784a');
      // 금빛 줄에 하트 펜던트
      for (const [x, y] of [[12, 25], [12, 26], [13, 27], [14, 28], [17, 28], [18, 27], [19, 26], [19, 25]]) c.set(x, y, '#e2ad45');
      c.rows([[29, 14, 14], [29, 17, 17], [29, 15, 16], [30, 14, 17], [31, 15, 16]], '#ef7f9f');
      c.set(14, 29, '#ffc2d2');
    }
    if (accessory === 'flower') {
      c.pen('#a64f6c');
      // 다섯 잎 꽃
      c.rows([[6, 21, 22], [7, 19, 24], [8, 19, 24], [9, 20, 23], [10, 19, 20], [10, 23, 24]], '#f49ab0');
      c.rows([[7, 21, 22], [8, 21, 22]], '#ffd76a');
      c.rows([[7, 20, 20], [6, 21, 21]], '#ffc4d3');
      c.pen('#4f6d4a');
      c.rows([[10, 25, 26], [11, 25, 26]], '#8fb488');
    }

    // 베일: 신부를 다 그리고 테두리를 두른 뒤 빈 칸에만 칠해 뒤에 놓는다
    if (formal === 'bride') {
      outline(c);
      c.pen(VEIL_EDGE);
      // 쪽머리에서 시작해 머리 양옆으로 퍼지고, 엉덩이 아래까지 내려온다. 끝단은 물결 모양
      c.under([[2, 11, 20], [3, 8, 23], [4, 6, 25], [5, 5, 26]], VEIL);
      for (let y = 6; y <= 41; y++) {
        const left = Math.max(1, Math.round(4.4 - (y - 6) * .09));
        c.under(y === 41 ? [[y, left + 1, left + 3], [y, W - 4 - left, W - 2 - left]] : [[y, left, W - 1 - left]], VEIL);
      }
      c.tint([...range(12, 40, 3, 3), ...range(16, 40, 28, 28)], '#efe8e5', VEIL);
      for (const [x, y] of [[4, 9], [27, 13], [3, 21], [28, 27], [2, 35]]) c.tint([[y, x, x]], '#ffffff', VEIL);
    }

    return `<svg class="character" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${toSvg(c)}</svg>`;
  }

  window.MINIMI = {hairs, colors, skins, accessories, groupOf, normalize, render};
})();
