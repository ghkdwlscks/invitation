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
    {id: 'warm', label: '살구 피부', hex: '#e7bb98'},
    {id: 'deep', label: '갈색 피부', hex: '#b88163'}
  ];
  const accessories = {
    // view: 고르기 버튼에서 미니미의 어느 부분을 잘라 보여줄지 (SVG viewBox)
    short: [
      {id: 'none', label: '없음'},
      {id: 'glasses', label: '안경', view: '5 7 22 14'},
      {id: 'tie', label: '넥타이', view: '7 20 18 12'},
      {id: 'cap', label: '캡모자', view: '3 0 26 20'},
      {id: 'headphones', label: '헤드폰', view: '2 0 28 22'}
    ],
    long: [
      {id: 'none', label: '없음'},
      {id: 'ribbon', label: '리본', view: '5 0 26 22'},
      {id: 'beret', label: '베레모', view: '3 0 26 20'},
      {id: 'necklace', label: '목걸이', view: '7 19 18 12'},
      {id: 'flower', label: '꽃핀', view: '5 0 26 22'}
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

  /* ---------- 그리기: 싸이월드 미니미 비율(머리가 키의 절반쯤), 32×44 칸에 한 점씩 찍는다 ---------- */
  const OUTLINE = '#4a3a3e';
  // 베일은 비치는 천이라 테두리를 연하게 둔다
  const VEIL = '#f5f0ed';
  const VEIL_EDGE = '#d6cbc8';
  const shade = (hex, amount) => '#' + [1, 3, 5]
    .map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 + amount)))).toString(16).padStart(2, '0'))
    .join('');

  function canvas() {
    const cells = new Map();
    const set = (x, y, color) => { if (x >= 0 && x < 32 && y >= 0 && y < 44) cells.set(`${x},${y}`, color); };
    return {
      cells,
      set,
      // [줄, 시작 칸, 끝 칸] 목록으로 칠한다
      rows(list, color) { for (const [y, from, to] of list) for (let x = from; x <= to; x++) set(x, y, color); },
      rect(x, y, w, h, color) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, color); },
      has: (x, y) => cells.has(`${x},${y}`),
      get: (x, y) => cells.get(`${x},${y}`)
    };
  }

  // 바깥 테두리를 한 칸 두르고 SVG로 만든다(같은 색이 이어진 칸은 하나로 묶는다)
  function toSvg(c) {
    const lines = [];
    for (const [key, color] of [...c.cells.entries()]) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < 32 && ny >= 0 && ny < 44 && !c.cells.has(`${nx},${ny}`)) lines.push([nx, ny, color === VEIL]);
      }
    }
    // 베일에만 닿은 테두리는 연하게, 다른 곳에 닿으면 진하게
    const strong = new Set(lines.filter(line => !line[2]).map(([x, y]) => `${x},${y}`));
    for (const [x, y] of lines) c.set(x, y, strong.has(`${x},${y}`) ? OUTLINE : VEIL_EDGE);
    let rects = '';
    for (let y = 0; y < 44; y++) {
      for (let x = 0; x < 32;) {
        const color = c.get(x, y);
        if (!color) { x++; continue; }
        let end = x;
        while (end + 1 < 32 && c.get(end + 1, y) === color) end++;
        rects += `<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${color}"/>`;
        x = end + 1;
      }
    }
    return rects;
  }

  const HEAD = [[6, 11, 20], [7, 9, 22], [8, 8, 23], ...Array.from({length: 10}, (_, i) => [9 + i, 7, 24]), [19, 8, 23], [20, 9, 22], [21, 11, 20]];

  function drawHairBack(c, hair, color, dark) {
    if (hair === 'bob') {
      c.rows(Array.from({length: 11}, (_, i) => [9 + i, 5, 26]), color);
      c.rows([[20, 6, 9], [20, 22, 25]], dark);
    }
    if (hair === 'long') {
      c.rows(Array.from({length: 22}, (_, i) => [9 + i, 4, 27]), color);
      for (let y = 12; y < 31; y += 3) { c.set(5, y, dark); c.set(26, y + 1, dark); }
      c.rows([[31, 5, 9], [31, 22, 26]], dark);
    }
    if (hair === 'pony') {
      c.rows(Array.from({length: 14}, (_, i) => [7 + i, 25, 28 - (i > 10 ? 1 : 0)]), color);
      c.rows([[21, 25, 26]], dark);
    }
  }

  function drawHairFront(c, hair, color, light, dark) {
    // 정수리: 둥근 머리 윗부분
    c.rows([[2, 11, 20], [3, 9, 22], [4, 8, 23], [5, 7, 24], [6, 7, 24], [7, 7, 24], [8, 7, 24]], color);
    c.rows([[3, 12, 15], [4, 11, 13]], light);
    if (hair === 'neat') {
      c.rows([[9, 7, 24], [10, 7, 9], [10, 11, 12], [10, 15, 17], [10, 20, 24], [11, 7, 8], [11, 23, 24], [12, 7, 7], [12, 24, 24]], color);
      c.rows([[1, 13, 14], [1, 18, 19]], color);
    }
    if (hair === 'side') {
      // 가르마: 이마 한쪽이 드러난다
      c.rows([[9, 7, 17], [10, 7, 14], [11, 7, 11], [12, 7, 9], [13, 7, 8], [9, 21, 24], [10, 23, 24], [11, 24, 24]], color);
      c.rows([[1, 12, 16], [2, 17, 19]], color);
      c.set(18, 4, dark); c.set(18, 5, dark); c.set(18, 6, dark);
    }
    if (hair === 'bob' || hair === 'pony') {
      c.rows([[9, 7, 24], [10, 7, 24], [11, 7, 9], [11, 12, 13], [11, 18, 19], [11, 22, 24]], color);
    }
    if (hair === 'long') {
      // 가운데 가르마, 옆으로 흘러내린 앞머리
      c.rows([[9, 7, 14], [9, 17, 24], [10, 7, 12], [10, 19, 24], [11, 7, 10], [11, 21, 24], [12, 7, 8], [12, 23, 24]], color);
      c.set(15, 6, dark); c.set(15, 7, dark); c.set(16, 8, dark);
    }
    if (hair === 'bob' || hair === 'long') c.rows(Array.from({length: 7}, (_, i) => [12 + i, 7, 7]).concat(Array.from({length: 7}, (_, i) => [12 + i, 24, 24])), color);
    // 앞머리 끝은 한 톤 어둡게 해 얼굴과 나눈다
    for (let x = 7; x <= 24; x++) {
      for (let y = 9; y <= 19; y++) if (c.get(x, y) === color && c.get(x, y + 1) && c.get(x, y + 1) !== color) c.set(x, y, dark);
    }
  }

  function drawFace(c, skin) {
    c.rows(HEAD, skin);
    c.rect(6, 13, 1, 3, skin); c.rect(25, 13, 1, 3, skin);
    c.rows([[20, 9, 22], [21, 11, 20]], shade(skin, -.05));
    // 큰 눈과 반짝임, 볼터치, 활짝 웃는 입
    for (const x of [10, 20]) { c.rect(x, 12, 2, 4, '#2b2427'); c.set(x, 12, '#ffffff'); c.set(x + 1, 15, '#5a4a52'); }
    c.rows([[16, 8, 9], [17, 8, 9], [16, 22, 23], [17, 22, 23]], '#f4a9b0');
    c.rows([[16, 13, 18], [17, 13, 13], [17, 18, 18], [18, 14, 17]], '#3b2a2e');
    c.rows([[17, 14, 17]], '#e8737d');
    c.rows([[17, 14, 15]], '#ffffff');
  }

  function render(value = {}, formal = '') {
    const avatar = normalize(value);
    const hair = formal === 'groom' ? 'side' : formal === 'bride' ? 'long' : avatar.hair;
    const hairColor = formal === 'groom' ? '#2c2a2e' : formal === 'bride' ? '#3a2c2b' : pick(colors.hair, avatar.hairColor, defaults.hairColor).hex;
    const skin = pick(skins, avatar.skin, defaults.skin).hex;
    const isSkirt = formal === 'bride' || (formal !== 'groom' && avatar.bottomType === 'skirt');
    const top = formal === 'groom' ? '#33343b' : formal === 'bride' ? '#fbf8f2' : pick(colors.top, avatar.top, defaults.top).hex;
    const bottomKind = isSkirt ? 'skirt' : 'pants';
    const bottom = formal === 'groom' ? '#33343b'
      : formal === 'bride' ? '#fbf8f2'
      : pick(colors[bottomKind], avatar[bottomKind], defaults[bottomKind]).hex;
    const accessory = formal ? 'none' : avatar.accessory;
    const hairLight = shade(hairColor, .35);
    const hairDark = shade(hairColor, -.3);
    const c = canvas();

    // 베일과 뒷머리는 몸보다 뒤에 있다
    if (formal === 'bride') {
      c.rows(Array.from({length: 34}, (_, i) => [3 + i, 7 - Math.min(5, Math.floor(i / 3)), 24 + Math.min(5, Math.floor(i / 3))]), VEIL);
      for (let y = 10; y < 36; y += 5) { c.set(4, y, '#ffffff'); c.set(27, y + 2, '#ffffff'); }
    }
    drawHairBack(c, hair, hairColor, hairDark);

    // 다리·양말·신발
    if (formal !== 'bride') {
      const legTop = isSkirt ? 34 : 36;
      c.rect(11, legTop, 4, 39 - legTop, skin); c.rect(17, legTop, 4, 39 - legTop, skin);
      if (formal === 'groom') { c.rect(11, 34, 4, 6, bottom); c.rect(17, 34, 4, 6, bottom); }
      else { c.rect(11, 38, 4, 2, '#ffffff'); c.rect(17, 38, 4, 2, '#ffffff'); }
      const shoe = formal === 'groom' ? '#1f1d22' : '#5a4a50';
      c.rows([[40, 10, 14], [41, 10, 14], [40, 17, 21], [41, 17, 21]], shoe);
      c.set(11, 40, shade(shoe, .6)); c.set(18, 40, shade(shoe, .6));
    }

    // 팔과 손
    const sleeve = formal === 'bride' ? skin : top;
    c.rows([[23, 8, 9], [24, 8, 9], [25, 8, 9], [26, 8, 9], [27, 8, 9], [23, 22, 23], [24, 22, 23], [25, 22, 23], [26, 22, 23], [27, 22, 23]], sleeve);
    c.rows([[28, 8, 9], [29, 8, 9], [28, 22, 23], [29, 22, 23]], skin);

    // 몸통(상의)과 하의
    if (formal === 'bride') {
      // 어깨가 드러난 웨딩드레스, 아래로 넓게 퍼진다
      c.rows([[22, 11, 20], [23, 10, 21]], skin);
      c.rows([[24, 10, 21], [25, 10, 21], [26, 10, 21], [27, 11, 20], [28, 11, 20], [29, 11, 20]], top);
      c.rows(Array.from({length: 13}, (_, i) => [30 + i, 10 - Math.floor(i / 2), 21 + Math.floor(i / 2)]), top);
      for (const [x, y] of [[12, 33], [19, 35], [10, 38], [21, 39], [14, 40], [17, 37]]) c.set(x, y, '#ece3dc');
      c.rows([[24, 12, 13], [24, 18, 19]], '#ece3dc');
    } else {
      c.rows([[22, 11, 20], ...Array.from({length: 8}, (_, i) => [23 + i, 10, 21])], top);
      c.rows([[23, 11, 11], [24, 11, 11]], shade(top, .25));
      if (formal === 'groom') {
        // 검은 정장, 흰 셔츠, 아이보리 넥타이, 흰 꽃 부토니에르
        c.rows([[22, 14, 17], [23, 14, 17], [24, 15, 16], [25, 15, 16]], '#f7f5f0');
        c.rows([[23, 15, 16], [24, 15, 16], [25, 15, 16], [26, 15, 16], [27, 15, 16]], '#ece4d2');
        c.rows([[24, 13, 13], [25, 13, 14], [24, 18, 18], [25, 17, 18]], '#24252b');
        c.set(19, 25, '#ffffff'); c.set(20, 25, '#ffffff'); c.set(19, 26, '#f3c5d1');
      } else {
        // 가슴의 작은 하트(싸이월드 미니미처럼)
        c.rows([[25, 14, 14], [25, 16, 16], [26, 14, 16], [27, 15, 15]], '#ffffff');
      }
      if (isSkirt) {
        c.rows([[31, 10, 21], [32, 9, 22], [33, 9, 22], [34, 8, 23]], bottom);
        c.rows([[34, 9, 10], [34, 21, 22]], shade(bottom, -.12));
      } else if (formal !== 'groom') {
        c.rows([[31, 10, 21], [32, 10, 21], [33, 10, 15], [33, 16, 21], [34, 10, 14], [34, 17, 21], [35, 10, 14], [35, 17, 21]], bottom);
        c.rows([[33, 15, 16]], shade(bottom, -.2));
      } else {
        c.rows([[31, 10, 21], [32, 10, 21], [33, 10, 14], [33, 17, 21]], bottom);
      }
    }

    // 얼굴과 앞머리
    drawFace(c, skin);
    drawHairFront(c, hair, hairColor, hairLight, hairDark);
    if (formal === 'bride') {
      // 진주 머리장식과 부케
      c.rows([[2, 13, 18]], '#fffaf2'); c.set(14, 1, '#fffaf2'); c.set(17, 1, '#fffaf2');
      c.rows([[27, 13, 18], [28, 12, 19], [29, 13, 18]], '#f7f1ec');
      for (const [x, y] of [[13, 27], [16, 28], [18, 27], [14, 29]]) c.set(x, y, '#f0a9bb');
      c.rows([[30, 15, 16], [31, 15, 16]], '#8fb08a');
      c.rows([[28, 8, 9], [28, 22, 23]], skin);
    }

    // 액세서리
    if (accessory === 'glasses') {
      c.rows([[12, 9, 12], [16, 9, 12], [12, 19, 22], [16, 19, 22], [13, 13, 18]], '#4f6174');
      c.rect(9, 13, 1, 3, '#4f6174'); c.rect(12, 13, 1, 3, '#4f6174'); c.rect(19, 13, 1, 3, '#4f6174'); c.rect(22, 13, 1, 3, '#4f6174');
    }
    if (accessory === 'tie') {
      c.rows([[22, 14, 17]], '#fff8eb');
      c.rows([[23, 15, 16], [24, 15, 16], [25, 14, 17], [26, 14, 17], [27, 15, 16], [28, 15, 16]], '#c86e88');
    }
    if (accessory === 'cap') {
      c.rows([[1, 10, 21], [2, 8, 23], [3, 7, 24], [4, 7, 24], [5, 7, 24], [6, 7, 24]], '#8ca8c7');
      c.rows([[2, 13, 18]], '#a9c1da');
      c.rows([[7, 5, 26], [8, 6, 25]], '#6e8eaf');
    }
    if (accessory === 'headphones') {
      c.rows([[1, 10, 21], [2, 8, 9], [2, 22, 23], [3, 7, 7], [3, 24, 24]], '#686e8b');
      c.rect(4, 11, 3, 6, '#686e8b'); c.rect(25, 11, 3, 6, '#686e8b');
      c.rect(5, 12, 1, 4, '#e4a6b8'); c.rect(26, 12, 1, 4, '#e4a6b8');
    }
    if (accessory === 'ribbon') {
      c.rows([[3, 20, 22], [3, 25, 27], [4, 20, 27], [5, 20, 27], [6, 21, 22], [6, 25, 26]], '#ef9fb4');
      c.rows([[4, 23, 24], [5, 23, 24]], '#b76e87');
    }
    if (accessory === 'beret') {
      c.rows([[0, 15, 16], [1, 9, 22], [2, 7, 24], [3, 6, 25], [4, 6, 25], [5, 7, 24]], '#baa2d4');
      c.rows([[2, 10, 14]], '#d3c2e4');
      c.rows([[5, 7, 24]], '#9d84bb');
    }
    if (accessory === 'necklace') {
      for (const x of [12, 14, 17, 19]) c.set(x, 23, '#fff3cb');
      c.rows([[24, 15, 16]], '#fff3cb');
      c.rows([[25, 15, 16]], '#e6b380');
    }
    if (accessory === 'flower') {
      c.rows([[4, 21, 21], [5, 20, 22], [6, 21, 21]], '#e796ab');
      c.set(21, 5, '#f3cf81');
      c.rows([[5, 23, 24], [6, 23, 23]], '#8fb08a');
    }

    return `<svg class="character" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${toSvg(c)}</svg>`;
  }

  window.MINIMI = {hairs, colors, skins, accessories, groupOf, normalize, render};
})();
