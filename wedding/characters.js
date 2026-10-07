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
      {id: 'glasses', label: '안경', view: '5 8 22 16'},
      {id: 'tie', label: '넥타이', view: '6 21 20 16'},
      {id: 'cap', label: '캡모자', view: '3 0 28 22'},
      {id: 'headphones', label: '헤드폰', view: '3 2 26 22'}
    ],
    long: [
      {id: 'none', label: '없음'},
      {id: 'ribbon', label: '리본', view: '6 2 26 22'},
      {id: 'beret', label: '베레모', view: '3 0 26 22'},
      {id: 'necklace', label: '목걸이', view: '6 21 20 16'},
      {id: 'flower', label: '꽃핀', view: '6 2 24 22'}
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

  function render(value = {}, formal = '') {
    const avatar = normalize(value);
    const hair = formal === 'groom' ? 'side' : formal === 'bride' ? 'long' : avatar.hair;
    const hairColor = formal === 'bride' ? '#68483f' : pick(colors.hair, avatar.hairColor, defaults.hairColor).hex;
    const skin = pick(skins, avatar.skin, defaults.skin).hex;
    const isSkirt = formal === 'bride' || (formal !== 'groom' && avatar.bottomType === 'skirt');
    const top = formal === 'groom' ? '#48566e' : formal === 'bride' ? '#fff9ee' : pick(colors.top, avatar.top, defaults.top).hex;
    const bottomKind = isSkirt ? 'skirt' : 'pants';
    const bottom = formal === 'groom' ? '#39445a'
      : formal === 'bride' ? '#fff9ee'
      : pick(colors[bottomKind], avatar[bottomKind], defaults[bottomKind]).hex;
    const accessory = formal === 'groom' ? 'tie' : formal === 'bride' ? 'flower' : avatar.accessory;
    const ink = '#62515d';
    const shade = '#d89d86';
    const px = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
    const blocks = (fill, list) => list.map(([x, y, width, height]) => px(x, y, width, height, fill)).join('');
    const hairBack = {
      neat: '',
      side: '',
      bob: blocks(ink, [[6, 8, 3, 19], [23, 8, 3, 19], [8, 25, 5, 3], [19, 25, 5, 3]])
        + blocks(hairColor, [[7, 8, 2, 18], [23, 8, 2, 18], [8, 25, 4, 2], [20, 25, 4, 2]]),
      long: blocks(ink, [[6, 8, 3, 28], [23, 8, 3, 28], [8, 33, 4, 3], [20, 33, 4, 3]])
        + blocks(hairColor, [[7, 8, 2, 27], [23, 8, 2, 27], [8, 33, 3, 2], [21, 33, 3, 2]]),
      pony: blocks(ink, [[6, 9, 3, 15], [23, 9, 4, 13], [26, 15, 4, 17], [25, 30, 4, 3]])
        + blocks(hairColor, [[7, 9, 2, 14], [23, 9, 3, 13], [27, 16, 2, 15], [25, 30, 3, 2]])
    }[hair];
    const frontHair = {
      neat: blocks(ink, [[10, 3, 12, 2], [8, 5, 16, 2], [7, 7, 18, 6], [7, 12, 4, 2], [21, 12, 4, 2]])
        + blocks(hairColor, [[10, 4, 12, 2], [8, 6, 16, 6], [7, 11, 5, 2], [20, 11, 5, 2]])
        + blocks('#ffffff44', [[11, 6, 6, 1]]),
      side: blocks(ink, [[10, 3, 12, 2], [8, 5, 16, 2], [7, 7, 18, 5], [7, 11, 13, 4], [21, 11, 4, 2]])
        + blocks(hairColor, [[10, 4, 12, 2], [8, 6, 16, 5], [7, 10, 13, 4], [21, 10, 4, 2]])
        + blocks('#ffffff55', [[18, 6, 1, 4], [16, 10, 2, 1]]),
      bob: blocks(ink, [[10, 3, 12, 2], [8, 5, 16, 2], [7, 7, 18, 7], [7, 12, 5, 4], [21, 12, 4, 3]])
        + blocks(hairColor, [[10, 4, 12, 2], [8, 6, 16, 7], [7, 11, 6, 4], [20, 11, 5, 3]])
        + blocks('#ffffff44', [[11, 6, 4, 1]]),
      long: blocks(ink, [[10, 3, 12, 2], [8, 5, 16, 2], [7, 7, 18, 7], [7, 12, 6, 3], [21, 12, 4, 3]])
        + blocks(hairColor, [[10, 4, 12, 2], [8, 6, 16, 7], [7, 11, 7, 3], [20, 11, 5, 3]])
        + blocks('#ffffff44', [[11, 6, 5, 1]]),
      pony: blocks(ink, [[10, 3, 12, 2], [8, 5, 16, 2], [7, 7, 18, 7], [7, 12, 5, 3], [21, 12, 4, 3]])
        + blocks(hairColor, [[10, 4, 12, 2], [8, 6, 16, 7], [7, 11, 6, 3], [20, 11, 5, 3]])
        + blocks('#ffffff44', [[11, 6, 5, 1]])
    }[hair];
    const accessoryArt = {
      none: '',
      glasses: blocks('#4f6174', [
        [9, 16, 6, 1], [9, 17, 1, 4], [14, 17, 1, 4], [17, 16, 6, 1], [17, 17, 1, 4], [22, 17, 1, 4],
        [15, 18, 2, 1], [8, 17, 1, 1], [23, 17, 1, 1], [10, 20, 4, 1], [18, 20, 4, 1]
      ]),
      tie: blocks('#fff8eb', [[14, 26, 4, 3]]) + blocks('#c86e88', [[15, 27, 2, 2], [14, 29, 4, 5], [15, 34, 2, 1]]),
      cap: blocks(ink, [[8, 2, 16, 2], [6, 4, 20, 2], [5, 6, 22, 3], [14, 9, 16, 2]])
        + blocks('#8ca8c7', [[8, 3, 16, 2], [6, 5, 20, 3], [14, 8, 15, 2]])
        + blocks('#6e8eaf', [[16, 9, 14, 1]]),
      headphones: blocks('#686e8b', [[9, 4, 14, 2], [7, 6, 3, 8], [22, 6, 3, 8], [6, 13, 3, 8], [23, 13, 3, 8]])
        + blocks('#e4a6b8', [[7, 15, 3, 5], [22, 15, 3, 5]]),
      ribbon: blocks('#b76e87', [[22, 7, 8, 2], [21, 9, 9, 3], [23, 12, 5, 2]])
        + blocks('#ef9fb4', [[23, 8, 2, 4], [27, 8, 2, 4]])
        + px(25, 9, 2, 2, '#fff9f1'),
      beret: blocks(ink, [[10, 1, 12, 2], [7, 3, 18, 3], [5, 6, 22, 2], [7, 8, 20, 2]])
        + blocks('#baa2d4', [[10, 2, 12, 2], [7, 4, 18, 3], [5, 7, 22, 1], [7, 8, 20, 1]])
        + px(16, 0, 2, 2, '#baa2d4'),
      necklace: blocks('#fff3cb', [[12, 26, 2, 2], [14, 28, 4, 1], [18, 26, 2, 2]]) + px(15, 29, 2, 2, '#e6b380'),
      flower: blocks('#fffaf0', [[24, 6, 2, 6], [22, 8, 6, 2]])
        + blocks('#e796ab', [[23, 7, 4, 4]])
        + px(24, 8, 2, 2, '#f3cf81')
    }[accessory];
    const skirt = blocks(ink, [[11, 33, 10, 2], [9, 35, 14, 4], [8, 39, 16, 2]])
      + blocks(bottom, [[12, 33, 8, 2], [10, 35, 12, 4], [9, 39, 14, 1]])
      + blocks('#ffffff66', [[12, 36, 1, 3], [19, 36, 1, 3]]);
    const pants = blocks(ink, [[11, 33, 10, 2], [11, 35, 5, 6], [17, 35, 5, 6]])
      + blocks(bottom, [[12, 34, 8, 2], [12, 36, 3, 4], [18, 36, 3, 4]])
      + blocks('#ffffff55', [[13, 36, 1, 3], [19, 36, 1, 3]]);
    const veil = formal === 'bride'
      ? blocks('#e4dbe3', [[9, 2, 14, 2], [6, 4, 20, 2], [4, 6, 24, 2], [3, 8, 3, 28], [26, 8, 3, 28], [4, 34, 5, 3], [23, 34, 5, 3]])
        + blocks('#fff8f2', [[4, 8, 2, 27], [26, 8, 2, 27], [5, 34, 3, 2], [24, 34, 3, 2]])
      : '';
    const bouquet = formal === 'bride'
      ? blocks('#d78ba5', [[4, 31, 6, 2], [5, 29, 4, 2], [7, 33, 5, 2]]) + blocks('#f9d8e2', [[5, 30, 4, 2], [7, 32, 4, 2]])
      : '';
    return `<svg class="character" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      ${blocks('#726c7d33', [[7, 42, 18, 2]])}
      ${veil}${hairBack}
      ${blocks(ink, [[10, 40, 7, 3], [17, 40, 7, 3]])}${blocks('#615a70', [[10, 41, 6, 2], [18, 41, 6, 2]])}
      ${blocks(skin, [[12, 38, 4, 3], [18, 38, 4, 3]])}
      ${isSkirt ? skirt : pants}
      ${blocks(ink, [[10, 25, 12, 10], [7, 27, 4, 9], [21, 27, 4, 9]])}
      ${blocks(top, [[11, 26, 10, 8], [8, 28, 3, 6], [21, 28, 3, 6]])}
      ${blocks(skin, [[8, 34, 3, 3], [21, 34, 3, 3]])}
      ${blocks('#fff9ed', [[14, 26, 4, 2]])}
      ${blocks(ink, [[10, 7, 12, 1], [8, 8, 16, 2], [7, 10, 18, 12], [8, 22, 16, 2], [10, 24, 12, 1], [6, 15, 2, 5], [24, 15, 2, 5]])}
      ${blocks(skin, [[10, 8, 12, 1], [8, 10, 16, 12], [10, 22, 12, 2], [6, 16, 2, 3], [24, 16, 2, 3]])}
      ${blocks(shade, [[8, 20, 2, 2], [22, 20, 2, 2]])}
      ${blocks('#eaa4a8', [[10, 20, 3, 1], [19, 20, 3, 1]])}
      ${blocks('#42414d', [[11, 16, 2, 3], [19, 16, 2, 3]])}
      ${blocks('#fff9ee', [[11, 16, 1, 1], [19, 16, 1, 1]])}
      ${blocks('#a16e73', [[15, 21, 2, 1], [14, 20, 1, 1], [17, 20, 1, 1]])}
      ${frontHair}${accessoryArt}
      ${bouquet}
    </svg>`;
  }

  window.MINIMI = {hairs, colors, skins, accessories, groupOf, normalize, render};
})();
