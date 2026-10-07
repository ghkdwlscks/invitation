/* 신혼여행 게임 그림 (도트 스타일).
   모양(원·곡선)으로 그린 뒤 반투명한 가장자리를 없애고, 쓴 색으로만 다시 칠해(번짐 없음) 1px 테두리를 두른다.
   화면은 320×200 픽셀이고 그대로 확대해서 보여준다. 게임 규칙은 minigames.js에 있다. */
(() => {
  'use strict';

  const W = 320;
  const H = 200;
  const GROUND = 172;
  const OUTLINE = '#3b3034';
  const TAU = Math.PI * 2;

  /* ---------- 픽셀 스프라이트 도구 ---------- */
  let palette = null;
  const use = color => { if (palette) palette.add(color); return color; };
  const rgb = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const wrap = (value, span) => ((value % span) + span) % span;
  const rad = degrees => degrees * Math.PI / 180;

  function pixelSprite(w, h, draw, outline = OUTLINE) {
    const pad = outline ? 1 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w) + pad * 2;
    canvas.height = Math.ceil(h) + pad * 2;
    const g = canvas.getContext('2d');
    g.translate(pad, pad);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    palette = new Set();
    draw(g);
    const colors = [...palette].map(rgb);
    palette = null;
    const image = g.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const total = canvas.width * canvas.height;
    const solid = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      if (data[o + 3] < 128) { data[o + 3] = 0; continue; }
      solid[i] = 1;
      data[o + 3] = 255;
      // 경계에서 섞인 색을 쓴 색 중 가장 가까운 색으로 되돌린다
      let best = colors[0];
      let bestGap = Infinity;
      for (const c of colors) {
        const gap = (c[0] - data[o]) ** 2 + (c[1] - data[o + 1]) ** 2 + (c[2] - data[o + 2]) ** 2;
        if (gap < bestGap) { bestGap = gap; best = c; }
      }
      if (best) { data[o] = best[0]; data[o + 1] = best[1]; data[o + 2] = best[2]; }
    }
    if (outline) {
      const [r, gg, b] = rgb(outline);
      const width = canvas.width;
      for (let i = 0; i < total; i++) {
        if (solid[i]) continue;
        const x = i % width;
        if ((x > 0 && solid[i - 1]) || (x < width - 1 && solid[i + 1]) || solid[i - width] || solid[i + width]) {
          const o = i * 4;
          data[o] = r; data[o + 1] = gg; data[o + 2] = b; data[o + 3] = 255;
        }
      }
    }
    g.putImageData(image, 0, 0);
    canvas.pad = pad;
    return canvas;
  }

  function blit(target, sprite, x, y) {
    target.drawImage(sprite, Math.round(x) - sprite.pad, Math.round(y) - sprite.pad);
  }

  function circle(g, x, y, r, color) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = use(color); g.fill(); }
  function ellipse(g, x, y, rx, ry, color, rotation = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rotation, 0, TAU); g.fillStyle = use(color); g.fill(); }
  function rrect(g, x, y, w, h, r, color) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = use(color); g.fill(); }
  function rect(g, x, y, w, h, color) { g.fillStyle = use(color); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function poly(g, points, color) {
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = use(color);
    g.fill();
  }
  function limb(g, x1, y1, x2, y2, width, color) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
    g.lineWidth = width; g.strokeStyle = use(color); g.stroke();
  }
  function curve(g, points, width, color) {
    g.beginPath(); g.moveTo(...points[0]);
    if (points.length === 3) g.quadraticCurveTo(...points[1], ...points[2]);
    else g.bezierCurveTo(...points[1], ...points[2], ...points[3]);
    g.lineWidth = width; g.strokeStyle = use(color); g.stroke();
  }
  const reach = (x, y, angle, length) => [x + Math.sin(rad(angle)) * length, y + Math.cos(rad(angle)) * length];

  function seeded(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => (value = value * 16807 % 2147483647) / 2147483647;
  }

  /* ---------- 신랑·신부 (사파리, 오른쪽을 보고 달림, 머리는 키의 약 1/3) ---------- */
  const SKIN = '#f0c6a2';
  const SKIN_SHADE = '#d9a37e';
  const BRIDE_SKIN = '#f8dcc4';
  const BRIDE_SHADE = '#e6bc9e';
  const RUN_POSES = [
    {front: 30, back: -26, arm: -32, bob: 0},
    {front: 9, back: -7, arm: -10, bob: -1},
    {front: -26, back: 30, arm: 32, bob: 0},
    {front: -7, back: 9, arm: 10, bob: -1}
  ];
  const JUMP_POSE = {front: 46, back: -14, arm: -150, bob: 0, jump: true};

  function drawLeg(g, hipX, hipY, angle, length, skin, shoe, jump, front) {
    if (jump && front) {
      const [kx, ky] = reach(hipX, hipY, 70, length * .55);
      const [fx, fy] = reach(kx, ky, -10, length * .5);
      limb(g, hipX, hipY, kx, ky, 3.4, skin);
      limb(g, kx, ky, fx, fy, 3.2, skin);
      ellipse(g, fx + 1.2, fy + .4, 2.6, 1.6, shoe);
      return;
    }
    const [fx, fy] = reach(hipX, hipY, angle, length);
    limb(g, hipX, hipY, fx, fy, 3.4, skin);
    ellipse(g, fx + 1.3, fy + .3, 2.7, 1.6, shoe);
  }

  function groomFrame(pose) {
    return pixelSprite(26, 43, g => {
      g.translate(0, pose.bob + 1);
      const shoulder = [14.4, 19.6];
      const [bx, by] = reach(...shoulder, -58, 8.2);
      limb(g, ...shoulder, bx, by, 2.8, SKIN_SHADE);
      drawLeg(g, 12.4, 31, pose.back, 9.2, SKIN_SHADE, '#5b3e2d', pose.jump, false);
      drawLeg(g, 16.2, 31, pose.front, 9.2, SKIN, '#6b4a36', pose.jump, true);
      rrect(g, 9.4, 26.4, 10.2, 5.4, 1.8, '#b39a6e');
      rrect(g, 9.2, 17.2, 10.6, 10.4, 3, '#f5eddc');
      rect(g, 9.4, 18, 2, 9, '#ddd0b6');
      rect(g, 15.6, 20.6, 2.4, 2, '#ddd0b6');
      rect(g, 13, 15.4, 3, 2.6, SKIN);
      ellipse(g, 9.8, 10.2, 3.4, 4.6, '#34313a');
      circle(g, 14.2, 10.2, 6.3, SKIN);
      rect(g, 11, 10, 2, 2, SKIN_SHADE);
      rect(g, 16.6, 9.4, 1.2, 2, '#2c2427');
      rect(g, 17.4, 12, 2, 1, '#f09c9a');
      ellipse(g, 9.6, 7.6, 3.2, 2.2, '#34313a');
      rrect(g, 8.8, 1.2, 10.6, 5.6, 2.4, '#e6c88f');
      rect(g, 8.8, 4.9, 10.6, 1.6, '#7b5b3c');
      ellipse(g, 14.6, 6.9, 10, 1.8, '#c9a466');
      const [ax, ay] = reach(...shoulder, pose.arm, 8.2);
      limb(g, ...shoulder, ax, ay, 2.8, SKIN);
      limb(g, ...shoulder, ...reach(...shoulder, pose.arm, 2.6), 3.4, '#f5eddc');
    });
  }

  function brideFrame(pose) {
    return pixelSprite(27, 43, g => {
      g.translate(0, pose.bob + 1);
      const shoulder = [14.2, 19.4];
      const [bx, by] = reach(...shoulder, -pose.arm, 7.6);
      limb(g, ...shoulder, bx, by, 2.4, BRIDE_SHADE);
      ellipse(g, 9.4, 15.4, 3.6, 7.8, '#6a4a40', rad(12));
      drawLeg(g, 12.6, 30.6, pose.back, 8.2, BRIDE_SHADE, '#d97f9a', pose.jump, false);
      drawLeg(g, 15.8, 30.6, pose.front, 8.2, BRIDE_SKIN, '#e79ab0', pose.jump, true);
      const flutter = pose.bob ? 0 : 1;
      poly(g, [[9.4, 23.4], [19.2, 23.4], [21.8 + flutter, 31.6], [7.4 - flutter, 31.6]], '#9fc3e6');
      rect(g, 7.6 - flutter, 29.6, 14 + flutter * 2, 2, '#c2dbf1');
      rrect(g, 9.6, 17, 9.4, 7.4, 2.8, '#9fc3e6');
      rect(g, 9.4, 23, 9.8, 1, '#fbf6ec');
      rect(g, 12.8, 15.2, 3, 2.4, BRIDE_SKIN);
      ellipse(g, 12.8, 8.8, 6.9, 5.9, '#6a4a40');
      circle(g, 15, 11, 4.9, BRIDE_SKIN);
      rect(g, 16.8, 9.8, 1.2, 2, '#2c2427');
      rect(g, 17.6, 12.2, 2, 1, '#f09c9a');
      ellipse(g, 11.6, 8.4, 4.6, 3.4, '#7c5749');
      rrect(g, 8.6, 1.4, 10.8, 4.8, 2.4, '#f6e6c6');
      rect(g, 8.6, 4.4, 10.8, 1.6, '#e79ab0');
      ellipse(g, 14.2, 6.6, 12, 2, '#e0cba0');
      const [ax, ay] = reach(...shoulder, 58, 7.6);
      limb(g, ...shoulder, ax, ay, 2.4, BRIDE_SKIN);
    });
  }

  const GROOM_RUN = RUN_POSES.map(groomFrame);
  const BRIDE_RUN = RUN_POSES.map(brideFrame);
  const GROOM_JUMP = groomFrame(JUMP_POSE);
  const BRIDE_JUMP = brideFrame({...JUMP_POSE, arm: 150});
  const COUPLE = {left: 46, height: 43, hitLeft: 55, hitRight: 80, hitTop: 9};

  function drawCouple(target, top, time, airborne) {
    const frame = Math.floor(time * 11) % 4;
    blit(target, airborne ? BRIDE_JUMP : BRIDE_RUN[(frame + 2) % 4], COUPLE.left, top);
    blit(target, airborne ? GROOM_JUMP : GROOM_RUN[frame], COUPLE.left + 15, top);
  }

  /* ---------- 사파리 동물 (왼쪽을 보고 달려옴, 사람 키에 맞춘 크기) ----------
     점 하나하나를 번짐 없이 찍는 도구로 그린다. draw(cv, frame): 0 = 다리를 뻗은 자세, 1 = 모은 자세 */
  // 픽셀 단위로 정확히 찍는 작은 그리기 도구
  function makeCanvas(w, h) {
    const px = new Map();
    const paint = (c, x, y) => (typeof c === 'function' ? c(x, y) : c);
    const api = {
      w, h, px,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) { const v = paint(c, x, y); if (v) px.set(`${x},${y}`, v); } },
      ellipse(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) api.set(x, y, c);
        }
      },
      poly(points, c) {
        const ys = points.map(p => p[1]), xs = points.map(p => p[0]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i], [xj, yj] = points[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) api.set(x, y, c);
        }
      },
      // 굵기가 w0에서 w1로 가늘어지는 선
      line(x0, y0, x1, y1, w0, w1, c) {
        const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, r = (w0 + (w1 - w0) * t) / 2;
          api.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.max(r, .5), Math.max(r, .5), c);
        }
      },
      path(points, w0, w1, c) {
        const n = points.length - 1;
        for (let i = 0; i < n; i++) api.line(...points[i], ...points[i + 1], w0 + (w1 - w0) * i / n, w0 + (w1 - w0) * (i + 1) / n, c);
      },
      rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) api.set(x + i, y + j, c); }
    };
    return api;
  }

  const ART_DEFS = {};
  const hoofed = (cv, pts, w0, w1, color, hoof, hw = 2) => {
    cv.path(pts, w0, w1, color);
    const [fx, fy] = pts[pts.length - 1];
    cv.rect(Math.round(fx - hw / 2), Math.round(fy) + 1, hw, 2, hoof);
  };
  // 3×3 칸마다 무작위로 작은 점을 찍는다 (줄무늬처럼 보이지 않게)
  const spotAt = (x, y, size = 2, rate = 3) => {
    const row = Math.floor(y / 3), col = Math.floor((x + (row % 2) * 1.5) / 3);
    const hash = Math.abs((col * 73856093) ^ (row * 19349663)) % rate;
    const inX = (x + (row % 2) * 1.5) - col * 3, inY = y - row * 3;
    return hash === 0 && inX < size && inY < Math.min(size, 2);
  };
  const pawed = (cv, pts, w0, w1, color, paw) => {
    cv.path(pts, w0, w1, color);
    const [fx, fy] = pts[pts.length - 1];
    cv.ellipse(fx - 1, fy + 1, 2.3, 1.2, paw);
  };

  /* 사자 */
  ART_DEFS.lion = {
    w: 58, h: 34,
    draw(cv, f) {
      const body = '#dfa556', far = '#b8803c', mane = '#8a4d26', maneMid = '#a86630', maneLight = '#c4843f';
      const face = '#e9b76d', muzzle = '#f6e1b6', dark = '#2e1f1a', paw = '#d6a052';
      if (f === 0) {
        pawed(cv, [[22, 19], [18, 25], [14, 29], [11, 31]], 4, 2.6, far, far);
        cv.ellipse(39, 17, 4.5, 6, far);
        pawed(cv, [[40, 21], [44, 26], [48, 29], [51, 31]], 3.6, 2.6, far, far);
      } else {
        pawed(cv, [[22, 19], [24, 25], [24, 31]], 4, 2.6, far, far);
        cv.ellipse(39, 17, 4.5, 6, far);
        pawed(cv, [[38, 22], [35, 27], [33, 31]], 3.6, 2.6, far, far);
      }
      cv.path([[48, 12], [52, 9], [55, 6], [56, 4]], 1.8, 1.4, body);
      cv.ellipse(56, 3, 2, 2, '#6e3d20');
      cv.ellipse(32, 15, 14, 6.5, body);
      cv.ellipse(20, 16, 6.5, 7, body);
      cv.ellipse(43, 14, 6, 6.5, body);
      if (f === 0) {
        cv.ellipse(43, 17, 5, 6.5, body);
        pawed(cv, [[44, 22], [47, 27], [51, 30], [54, 31]], 4, 2.8, body, paw);
        pawed(cv, [[18, 19], [14, 24], [10, 28], [6, 31]], 4.6, 3, body, paw);
      } else {
        cv.ellipse(42, 17, 5, 6.5, body);
        pawed(cv, [[41, 22], [38, 27], [36, 31]], 4, 2.8, body, paw);
        pawed(cv, [[18, 19], [19, 25], [18, 31]], 4.6, 3, body, paw);
      }
      // 갈기: 바깥은 짙게, 안쪽은 결이 보이게
      cv.ellipse(12, 13, 9.5, 10.5, mane);
      cv.ellipse(11, 12, 7.6, 8.6, (x, y) => ((x + y * 2) % 4 === 0 ? maneLight : maneMid));
      cv.ellipse(9, 4, 1.8, 1.8, face); cv.set(9, 4, dark);
      cv.ellipse(7, 11, 5.5, 5, face);
      cv.ellipse(3.6, 14, 3.8, 2.6, muzzle);
      cv.rect(0, 12, 2, 2, '#5a3328');
      cv.set(5, 9, dark); cv.set(6, 9, dark);
      cv.rect(4, 8, 4, 1, '#c99555');
      cv.rect(2, 16, 3, 1, '#b07c45');
    }
  };

  /* 얼룩말 */
  ART_DEFS.zebra = {
    w: 50, h: 41,
    draw(cv, f) {
      const W = '#f6f3ec', K = '#262224';
      const bodyStripe = (x, y) => ((x + Math.round(Math.sin(y * .45) * 1.2)) % 4 < 2 ? K : W);
      const legStripe = (x, y) => (y % 3 === 0 ? K : W);
      const farLeg = (x, y) => (y % 3 === 0 ? K : '#d4cdc2');
      const neckStripe = (x, y) => ((x * 2 + y) % 5 < 2 ? K : W);
      const legs = f === 0
        ? {nf: [[18, 25], [14, 31], [10, 35], [8, 38]], ff: [[21, 25], [18, 31], [15, 35], [13, 38]], nh: [[40, 26], [43, 32], [46, 35], [48, 38]], fh: [[36, 26], [38, 32], [40, 35], [41, 38]]}
        : {nf: [[18, 25], [19, 31], [18, 35], [17, 38]], ff: [[21, 25], [23, 31], [22, 38]], nh: [[39, 26], [36, 32], [34, 38]], fh: [[36, 26], [33, 32], [31, 38]]};
      hoofed(cv, legs.ff, 3, 2.2, farLeg, K);
      hoofed(cv, legs.fh, 3.2, 2.2, farLeg, K);
      cv.path([[41, 16], [44, 21], [45, 27]], 1.6, 1.4, W);
      cv.ellipse(45, 28, 1.5, 2.2, K);
      cv.ellipse(29, 20, 12.5, 6.5, bodyStripe);
      cv.ellipse(18, 21, 5, 6, bodyStripe);
      cv.ellipse(39, 19, 6, 6.5, bodyStripe);
      cv.ellipse(39, 22, 4.5, 6, bodyStripe);
      hoofed(cv, legs.nf, 3.2, 2.4, legStripe, K);
      hoofed(cv, legs.nh, 3.4, 2.4, legStripe, K);
      // 목과 머리
      cv.poly([[13, 18], [21, 16], [16, 4], [9, 6]], neckStripe);
      cv.path([[10, 6], [5, 13]], 6, 4.6, (x, y) => ((x + y * 2) % 4 === 0 ? K : W));
      cv.ellipse(4, 14, 3, 2.6, '#3a3335');
      cv.poly([[9, 4], [10, 0], [12, 4]], W); cv.set(10, 2, K);
      cv.poly([[12, 5], [14, 1], [15, 5]], W);
      cv.path([[11, 3], [15, 7], [19, 12]], 2.2, 2, (x, y) => ((x + y) % 2 ? K : W));
      cv.set(8, 8, K);
    }
  };

  /* 누 */
  ART_DEFS.wildebeest = {
    w: 50, h: 39,
    draw(cv, f) {
      const body = '#76726f', far = '#575350', dark = '#262224', horn = '#c4b7a0';
      const brindle = x => (x >= 14 && x <= 27 && x % 3 === 0 ? '#5a5653' : body);
      const legs = f === 0
        ? {nf: [[18, 24], [14, 30], [11, 34], [9, 36]], ff: [[21, 24], [18, 30], [16, 36]], nh: [[39, 25], [42, 30], [45, 34], [47, 36]], fh: [[35, 25], [37, 31], [39, 36]]}
        : {nf: [[18, 24], [19, 30], [18, 36]], ff: [[21, 24], [23, 30], [22, 36]], nh: [[38, 25], [35, 30], [33, 36]], fh: [[35, 25], [32, 30], [30, 36]]};
      hoofed(cv, legs.ff, 2.8, 2, far, dark);
      hoofed(cv, legs.fh, 3, 2, far, dark);
      cv.path([[43, 16], [46, 21], [47, 26]], 1.6, 1.4, dark);
      cv.ellipse(47, 28, 1.6, 2.8, dark);
      cv.ellipse(29, 19, 12.5, 6.5, brindle);
      cv.ellipse(21, 15, 7.5, 7, brindle);
      cv.ellipse(39, 20, 5.5, 5.5, body);
      hoofed(cv, legs.nf, 3, 2.2, body, dark);
      cv.ellipse(39, 22, 4, 5, body);
      hoofed(cv, legs.nh, 3.2, 2.2, body, dark);
      cv.poly([[12, 12], [20, 8], [22, 18], [14, 21]], brindle);
      cv.path([[13, 9], [22, 9]], 2.4, 2, dark);
      cv.path([[12, 9], [6, 18]], 6.2, 5, '#625c58');
      cv.ellipse(5, 19.5, 3.6, 3, dark);
      cv.path([[11, 19], [12, 23], [11, 27]], 2.8, 1.6, dark);
      cv.path([[10, 8], [7, 6], [7, 3], [9, 2]], 1.8, 1.4, horn);
      cv.path([[13, 8], [16, 6], [16, 3], [14, 2]], 1.8, 1.4, '#a69a86');
      cv.set(9, 11, dark);
    }
  };

  /* 톰슨가젤 */
  ART_DEFS.gazelle = {
    w: 40, h: 31,
    draw(cv, f) {
      const tan = '#cf9455', white = '#f7f0e3', dark = '#2e2422', far = '#a8743f';
      const coat = (x, y) => (y >= 17 ? white : y === 16 ? dark : x >= 31 && y >= 13 ? white : tan);
      const legs = f === 0
        ? {nf: [[13, 18], [9, 21], [5, 23]], ff: [[16, 18], [12, 22], [8, 24]], nh: [[31, 18], [35, 22], [38, 25]], fh: [[28, 18], [32, 23], [35, 26]]}
        : {nf: [[13, 18], [13, 23], [12, 28]], ff: [[16, 18], [17, 23], [17, 28]], nh: [[30, 18], [29, 23], [30, 28]], fh: [[28, 18], [26, 23], [26, 28]]};
      hoofed(cv, legs.ff, 2, 1.6, far, dark);
      hoofed(cv, legs.fh, 2.2, 1.6, far, dark);
      cv.path([[34, 13], [36, 15]], 1.6, 1.4, dark);
      cv.ellipse(22, 15, 10, 4.5, coat);
      cv.ellipse(13, 15, 3.5, 4.5, coat);
      cv.ellipse(30, 14, 4, 4.5, coat);
      hoofed(cv, legs.nf, 2.2, 1.8, tan, dark);
      hoofed(cv, legs.nh, 2.4, 1.8, tan, dark);
      cv.poly([[10, 14], [15, 12], [10, 5], [7, 6]], tan);
      cv.ellipse(6, 7, 3.6, 2.7, tan);
      cv.path([[5, 8], [1, 10]], 2.6, 2.2, tan);
      cv.rect(0, 10, 2, 1, dark);
      cv.path([[4, 6], [2, 9]], 1, 1, white);
      cv.poly([[8, 4], [10, 1], [10, 5]], tan);
      cv.path([[6, 5], [6, 2], [8, 0]], 1.4, 1.2, dark);
      cv.path([[7, 5], [8, 2], [10, 1]], 1.4, 1.2, '#4a3c36');
      cv.set(5, 6, dark);
    }
  };

  /* 치타 */
  ART_DEFS.cheetah = {
    w: 55, h: 28,
    draw(cv, f) {
      const base = '#e8b85b', far = '#c99a45', cream = '#f8e8bf', spot = '#2e2422';
      const coat = (x, y) => (spotAt(x, y, 1, 2) ? spot : y >= 15 ? cream : base);
      const farCoat = (x, y) => (spotAt(x, y, 1, 2) ? spot : far);
      const legs = f === 0
        ? {nf: [[16, 15], [10, 19], [4, 22], [1, 24]], ff: [[19, 15], [14, 20], [8, 23], [6, 24]], nh: [[40, 17], [45, 21], [50, 24]], fh: [[37, 17], [42, 22], [46, 25]]}
        : {nf: [[16, 15], [20, 20], [24, 25]], ff: [[19, 15], [23, 20], [27, 25]], nh: [[38, 17], [33, 21], [28, 25]], fh: [[36, 17], [31, 21], [26, 25]]};
      pawed(cv, legs.ff, 2.4, 2, farCoat, far);
      pawed(cv, legs.fh, 2.6, 2, farCoat, far);
      cv.path([[42, 11], [47, 13], [51, 15], [54, 13]], 2, 1.6, x => (x > 47 && x % 2 === 0 ? spot : x >= 53 ? cream : base));
      cv.ellipse(28, 12, 13, 4.5, coat);
      cv.ellipse(17, 13, 4.5, 5, coat);
      cv.ellipse(38, 12, 4.5, 5, coat);
      cv.ellipse(38, 15, 4, 4.5, coat);
      pawed(cv, legs.nf, 2.6, 2.2, coat, base);
      pawed(cv, legs.nh, 2.8, 2.2, coat, base);
      cv.path([[11, 10], [16, 11]], 6, 6, coat);
      cv.ellipse(8, 9, 4.6, 3.8, base);
      cv.ellipse(4, 11, 2.7, 2, cream);
      cv.ellipse(9, 5.5, 1.3, 1.3, base); cv.ellipse(12, 6, 1.3, 1.3, base);
      cv.set(1, 10, spot);
      cv.path([[6, 9], [4, 13]], 1, 1, spot);
      cv.set(6, 8, spot); cv.set(7, 8, spot);
    }
  };

  /* 점박이하이에나 */
  ART_DEFS.hyena = {
    w: 46, h: 32,
    draw(cv, f) {
      const base = '#c3a77c', far = '#9c835e', spot = '#5e4936', dark = '#352a26';
      const coat = (x, y) => (spotAt(x, y, 2, 3) ? spot : base);
      const farCoat = (x, y) => (spotAt(x, y, 2, 3) ? spot : far);
      const legs = f === 0
        ? {nf: [[14, 21], [10, 26], [7, 30]], ff: [[17, 21], [15, 26], [13, 30]], nh: [[35, 21], [39, 25], [42, 29]], fh: [[32, 21], [34, 25], [36, 30]]}
        : {nf: [[14, 21], [15, 26], [14, 30]], ff: [[17, 21], [19, 26], [18, 30]], nh: [[34, 21], [32, 25], [30, 30]], fh: [[32, 21], [29, 25], [27, 30]]};
      pawed(cv, legs.ff, 3, 2.2, farCoat, far);
      pawed(cv, legs.fh, 3, 2.2, farCoat, far);
      cv.path([[39, 15], [42, 18], [43, 22]], 2.8, 2, dark);
      cv.poly([[13, 9], [24, 7], [36, 12], [40, 16], [38, 21], [16, 22], [11, 17]], coat);
      cv.ellipse(15, 16, 5, 6, coat);
      cv.ellipse(36, 17, 4.5, 4.5, coat);
      pawed(cv, legs.nf, 3.4, 2.4, coat, base);
      pawed(cv, legs.nh, 3.4, 2.4, coat, base);
      cv.poly([[9, 8], [16, 7], [17, 17], [10, 16]], coat);
      cv.path([[10, 7], [25, 8]], 2, 1.4, '#6e5a46');
      cv.ellipse(7, 10, 5, 4.5, base);
      cv.path([[4, 11], [0, 13]], 4, 3.2, dark);
      cv.ellipse(9, 4, 2.2, 2.6, base); cv.set(9, 4, dark);
      cv.ellipse(5, 5, 2, 2.4, base); cv.set(5, 5, dark);
      cv.set(6, 9, dark);
    }
  };

  /* 아프리카물소 */
  ART_DEFS.buffalo = {
    w: 56, h: 39,
    draw(cv, f) {
      const body = '#4d423e', far = '#382f2c', horn = '#c0b5a4', dark = '#211b1c';
      const legs = f === 0
        ? {nf: [[19, 25], [15, 31], [12, 36]], ff: [[23, 25], [21, 31], [20, 36]], nh: [[43, 25], [46, 31], [48, 36]], fh: [[39, 25], [40, 31], [41, 36]]}
        : {nf: [[19, 25], [19, 31], [18, 36]], ff: [[23, 25], [24, 31], [23, 36]], nh: [[42, 25], [41, 31], [42, 36]], fh: [[39, 25], [37, 31], [37, 36]]};
      hoofed(cv, legs.ff, 4.4, 3.4, far, dark, 3);
      hoofed(cv, legs.fh, 4.6, 3.4, far, dark, 3);
      cv.path([[48, 15], [51, 20], [51, 27]], 1.6, 1.4, body);
      cv.ellipse(51, 28, 1.5, 2, dark);
      cv.ellipse(31, 19, 15, 8, body);
      cv.ellipse(23, 15, 8, 6.5, body);
      cv.ellipse(42, 18, 7, 7.5, body);
      hoofed(cv, legs.nf, 4.8, 3.8, body, dark, 3);
      hoofed(cv, legs.nh, 5, 3.8, body, dark, 3);
      cv.ellipse(10, 18, 6.2, 5.8, '#433935');
      cv.ellipse(6, 22, 4, 3, '#2d2527');
      cv.path([[18, 11], [21, 13], [21, 16], [19, 18]], 2.2, 1.4, '#9d927f');
      cv.ellipse(17.5, 16.5, 2.4, 1.4, dark);
      cv.path([[4, 12], [8, 10], [14, 10], [18, 11]], 3.2, 3.2, horn);
      cv.path([[4, 12], [1, 14], [1, 17], [3, 19]], 2.4, 1.4, horn);
      cv.ellipse(3, 17, 2.4, 1.4, dark);
      cv.set(8, 16, '#d8cdbd');
    }
  };

  /* 하마 */
  ART_DEFS.hippo = {
    w: 56, h: 33,
    draw(cv, f) {
      const body = '#8d7e86', far = '#6d5f67', pink = '#d89da0', dark = '#3a2f34';
      const skin = (x, y) => (y >= 22 ? pink : body);
      const legs = f === 0
        ? {nf: [[20, 22], [17, 27], [16, 30]], ff: [[24, 22], [25, 27], [26, 30]], nh: [[43, 22], [46, 27], [47, 30]], fh: [[40, 22], [39, 27], [39, 30]]}
        : {nf: [[20, 22], [20, 27], [20, 30]], ff: [[24, 22], [24, 27], [23, 30]], nh: [[43, 22], [43, 27], [43, 30]], fh: [[40, 22], [40, 27], [41, 30]]};
      hoofed(cv, legs.ff, 6, 5, far, dark, 4);
      hoofed(cv, legs.fh, 6, 5, far, dark, 4);
      cv.path([[47, 14], [50, 16]], 1.6, 1.2, body);
      cv.ellipse(32, 16, 16, 9, skin);
      hoofed(cv, legs.nf, 6.4, 5.4, body, dark, 4);
      hoofed(cv, legs.nh, 6.4, 5.4, body, dark, 4);
      cv.ellipse(13, 14, 8, 7, body);
      cv.ellipse(7, 17, 7.2, 5.6, '#9d8a93');
      cv.rect(1, 20, 10, 1, '#6d5a63');
      cv.ellipse(8, 22, 5, 1.6, pink);
      cv.ellipse(3, 13, 1.6, 1.2, '#9d8a93'); cv.set(2, 13, dark); cv.set(4, 13, dark);
      cv.ellipse(12, 8, 2, 1.6, body); cv.set(11, 8, dark);
      cv.ellipse(16, 6.5, 1.2, 1.4, body);
    }
  };

  /* 검은코뿔소 */
  ART_DEFS.rhino = {
    w: 58, h: 37,
    draw(cv, f) {
      const body = '#7f7b7c', far = '#5f5b5d', horn = '#e7d9c0', dark = '#2c2628';
      const legs = f === 0
        ? {nf: [[21, 24], [18, 30], [16, 34]], ff: [[25, 24], [26, 30], [27, 34]], nh: [[45, 24], [48, 30], [50, 34]], fh: [[41, 24], [41, 30], [41, 34]]}
        : {nf: [[21, 24], [21, 30], [20, 34]], ff: [[25, 24], [25, 30], [24, 34]], nh: [[45, 24], [45, 30], [46, 34]], fh: [[41, 24], [41, 30], [42, 34]]};
      hoofed(cv, legs.ff, 5, 4.2, far, dark, 4);
      hoofed(cv, legs.fh, 5.2, 4.2, far, dark, 4);
      cv.path([[50, 15], [53, 19]], 1.4, 1.2, body);
      cv.ellipse(33, 18, 15, 8, body);
      cv.ellipse(24, 14.5, 8, 6, body);
      cv.ellipse(44, 17, 7, 7.5, body);
      hoofed(cv, legs.nf, 5.4, 4.6, body, dark, 4);
      hoofed(cv, legs.nh, 5.6, 4.6, body, dark, 4);
      cv.path([[21, 11], [21, 24]], 1, 1, '#6c6869');
      cv.poly([[19, 10], [21, 21], [9, 23], [3, 20], [4, 14], [11, 10]], '#787475');
      cv.poly([[4, 15], [2, 4], [8, 14]], horn);
      cv.poly([[9, 13], [9, 7], [12, 12]], '#d2c3a8');
      cv.poly([[17, 9], [18, 4], [20, 9]], body); cv.set(18, 7, dark);
      cv.set(2, 21, '#787475');
      cv.set(12, 15, dark);
      cv.rect(4, 21, 5, 1, '#5f5b5d');
    }
  };

  /* 아프리카코끼리 */
  ART_DEFS.elephant = {
    w: 74, h: 57,
    draw(cv, f) {
      const body = '#8f8a8c', far = '#6e696b', ear = '#837e80', inner = '#ae9a9f', tusk = '#f1e8d6', dark = '#2b2628', nail = '#d9d2c8';
      const legs = f === 0
        ? {nf: [[28, 34], [25, 44], [23, 53]], ff: [[33, 34], [34, 44], [35, 53]], nh: [[54, 34], [57, 44], [59, 53]], fh: [[49, 34], [48, 44], [48, 53]]}
        : {nf: [[28, 34], [28, 44], [27, 53]], ff: [[33, 34], [33, 44], [33, 53]], nh: [[54, 34], [54, 44], [55, 53]], fh: [[49, 34], [49, 44], [50, 53]]};
      hoofed(cv, legs.ff, 8, 7, far, far, 7);
      hoofed(cv, legs.fh, 8.4, 7, far, far, 7);
      cv.path([[61, 22], [64, 30], [64, 37]], 1.6, 1.4, body);
      cv.ellipse(64, 38, 1.4, 2, dark);
      cv.ellipse(42, 24, 19, 13, body);
      cv.ellipse(28, 23, 7, 11, body);
      hoofed(cv, legs.nf, 8.6, 7.6, body, body, 7);
      hoofed(cv, legs.nh, 9, 7.6, body, body, 7);
      for (const [x, y] of [legs.nf[2], legs.nh[2]]) { cv.set(x - 2, y + 2, nail); cv.set(x, y + 2, nail); cv.set(x + 2, y + 2, nail); }
      cv.ellipse(18, 19, 9, 10, body);
      cv.ellipse(14, 12, 6, 4, body);
      cv.path([[12, 25], [8, 33], [6, 40], [6, 45], [9, 48]], 6.5, 3.6, body);
      for (let y = 30; y < 46; y += 3) cv.set(7, y, '#7a7577');
      cv.path([[13, 29], [9, 33], [5, 34]], 2.6, 1.6, tusk);
      cv.ellipse(27, 21, 9.5, 12.5, ear);
      cv.ellipse(27, 21, 7, 10, inner);
      cv.path([[22, 11], [24, 31]], 1, 1, '#9f8b90');
      cv.set(14, 17, dark); cv.set(13, 17, dark);
      cv.rect(12, 15, 4, 1, '#7a7577');
    }
  };

  /* 아프리카물수리 */
  ART_DEFS.eagle = {
    w: 46, h: 25,
    draw(cv, f) {
      const white = '#f7f2e8', chestnut = '#8a4a2c', wing = '#3a2f2c', cover = '#5d4a40', beak = '#f2c14e', dark = '#1f1a1c';
      if (f === 0) {
        cv.poly([[19, 10], [24, 10], [29, 1], [25, 1]], '#2c2422');
        cv.poly([[17, 11], [27, 11], [35, 1], [33, 0], [29, 0], [22, 4]], wing);
        cv.poly([[18, 10], [25, 10], [29, 5], [23, 6]], cover);
      }
      cv.poly([[30, 11], [38, 9], [39, 15], [30, 14]], white);
      cv.ellipse(22, 12.5, 8.5, 3.4, chestnut);
      cv.ellipse(15, 12.5, 3.8, 3.2, white);
      cv.ellipse(11, 11, 4, 3, white);
      cv.poly([[7, 10], [4, 11.5], [7, 12.5]], beak); cv.set(4, 12, dark);
      cv.set(10, 10, dark);
      if (f === 1) {
        cv.poly([[17, 13], [27, 13], [34, 24], [29, 24], [21, 19]], wing);
        cv.poly([[18, 13], [26, 13], [27, 17], [21, 17]], cover);
      }
    }
  };

  // 위쪽 가장자리는 밝게, 아래쪽은 어둡게 칠해 몸의 둥근 느낌을 낸다
  const tint = (color, amount) => '#' + [1, 3, 5]
    .map(i => Math.max(0, Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * (1 + amount)))).toString(16).padStart(2, '0'))
    .join('');
  const brightness = color => [1, 3, 5].reduce((sum, i) => sum + parseInt(color.slice(i, i + 2), 16), 0) / 3;

  function shadeVolume(pixels) {
    const shaded = new Map();
    const filled = (x, y) => pixels.has(`${x},${y}`);
    for (const [key, color] of pixels) {
      const [x, y] = key.split(',').map(Number);
      if (brightness(color) < 70) { shaded.set(key, color); continue; }
      let above = 0;
      while (above < 3 && filled(x, y - above - 1)) above++;
      let below = 0;
      while (below < 4 && filled(x, y + below + 1)) below++;
      let amount = 0;
      if (above === 0) amount += .14;
      else if (above === 1) amount += .06;
      if (below === 0) amount -= .16;
      else if (below <= 2) amount -= .07;
      if (!filled(x - 1, y)) amount += .04;
      shaded.set(key, amount ? tint(color, amount) : color);
    }
    return shaded;
  }

  // 두 프레임을 같은 상자로 잘라 발끝이 땅에 닿게 한다
  function animalFrames(def) {
    const frames = [0, 1].map(frame => {
      const cv = makeCanvas(def.w, def.h);
      def.draw(cv, frame);
      return shadeVolume(cv.px);
    });
    const points = frames.flatMap(pixels => [...pixels.keys()].map(key => key.split(',').map(Number)));
    const left = Math.min(...points.map(p => p[0]));
    const top = Math.min(...points.map(p => p[1]));
    const width = Math.max(...points.map(p => p[0])) - left + 1;
    const height = Math.max(...points.map(p => p[1])) - top + 1;
    return frames.map(pixels => pixelSprite(width, height, g => {
      for (const [key, color] of pixels) {
        const [x, y] = key.split(',').map(Number);
        g.fillStyle = use(color);
        g.fillRect(x - left, y - top, 1, 1);
      }
    }));
  }

  const ANIMALS = Object.fromEntries(['wildebeest', 'zebra', 'gazelle', 'lion', 'cheetah', 'hyena', 'buffalo', 'hippo', 'elephant', 'rhino']
    .map(name => [name, animalFrames(ART_DEFS[name])]));
  const EAGLE = animalFrames(ART_DEFS.eagle);
  const sizeOf = frames => ({w: frames[0].width - 2, h: frames[0].height - 2});
  const SAFARI_SIZES = {
    ...Object.fromEntries(Object.entries(ANIMALS).map(([key, frames]) => [key, sizeOf(frames)])),
    eagle: sizeOf(EAGLE),
    puddle: {w: 58, h: 4}
  };


  function drawSafariObstacle(target, item, time) {
    const frames = ANIMALS[item.type];
    if (frames) {
      const frame = frames[Math.floor(time * 8 + item.x * .02) % 2];
      blit(target, frame, item.x, GROUND - frame.height + frame.pad * 2 - 1);
      return;
    }
    if (item.type === 'eagle') { blit(target, EAGLE[Math.floor(time * 5) % 2], item.x, item.y); return; }
    if (item.type === 'puddle') {
      target.fillStyle = '#5a8f9c'; target.fillRect(Math.round(item.x) + 4, GROUND - 1, item.w - 8, 5);
      target.fillStyle = '#76aeb9'; target.fillRect(Math.round(item.x) + 1, GROUND, item.w - 2, 3);
      target.fillStyle = '#a9d6dc'; target.fillRect(Math.round(item.x) + 10, GROUND, 12, 1);
      target.fillRect(Math.round(item.x) + 30, GROUND + 1, 8, 1);
    }
  }

  /* ---------- 사파리 배경: 구간마다 따로 그린 도트 풍경 ---------- */
  function skySprite(colors, edges) {
    return pixelSprite(W, edges[edges.length - 1], g => {
      colors.forEach((color, i) => rect(g, 0, edges[i], W, edges[i + 1] - edges[i], color));
      // 띠 경계는 바둑판 점무늬로 이어 붙인다
      for (let i = 1; i < colors.length; i++) {
        const y = edges[i];
        for (let x = 0; x < W; x += 2) {
          rect(g, x, y - 1, 1, 1, colors[i]);
          rect(g, x + 1, y, 1, 1, colors[i - 1]);
        }
      }
    }, null);
  }

  function hillStrip(width, height, base, peaks, colors, seed) {
    return pixelSprite(width, height, g => {
      const random = seeded(seed);
      colors.forEach((color, layer) => {
        g.beginPath(); g.moveTo(0, height);
        for (let x = 0; x <= width; x += 4) {
          const y = base + layer * 4 - Math.sin((x / width) * TAU * peaks + layer) * (6 - layer) - Math.sin((x / width) * TAU * (peaks * 3)) * 1.6;
          g.lineTo(x, y);
        }
        g.lineTo(width, height); g.closePath(); g.fillStyle = use(color); g.fill();
      });
      for (let i = 0; i < width / 6; i++) rect(g, Math.floor(random() * width), base + 6 + Math.floor(random() * (height - base - 7)), 2, 1, colors[0]);
    }, null);
  }

  function craterStrip() {
    // 화면 뒤를 크게 둘러싸는 응고롱고로 분화구 벽
    const width = 640;
    const height = 92;
    return pixelSprite(width, height, g => {
      const random = seeded(42);
      g.beginPath(); g.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) g.lineTo(x, 22 + Math.sin(x / width * TAU) * 6 + Math.sin(x / width * TAU * 5) * 3);
      g.lineTo(width, height); g.closePath(); g.fillStyle = use('#5a7663'); g.fill();
      g.beginPath(); g.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) g.lineTo(x, 40 + Math.sin(x / width * TAU + 1) * 5 + Math.sin(x / width * TAU * 7) * 2);
      g.lineTo(width, height); g.closePath(); g.fillStyle = use('#6b8a70'); g.fill();
      // 숲 질감과 골짜기 주름
      for (let i = 0; i < 260; i++) rect(g, Math.floor(random() * width), 28 + Math.floor(random() * 56), 2, 1, random() < .5 ? '#4d6756' : '#7c9a7c');
      for (let i = 0; i < 9; i++) {
        const x = random() * width;
        limb(g, x, 30 + random() * 8, x + 4 - random() * 8, 48 + random() * 10, 1, '#55705e');
      }
      // 분화구 벽 아래 안개
      rect(g, 0, 78, width, 6, '#a9c4b6');
      rect(g, 0, 84, width, 8, '#bed3c4');
      for (let x = 0; x < width; x += 2) rect(g, x, 77, 1, 1, '#a9c4b6');
    }, null);
  }

  function acaciaSprite(scale, leaf, trunk) {
    return pixelSprite(44 * scale, 34 * scale, g => {
      g.scale(scale, scale);
      limb(g, 22, 34, 22, 18, 2.2, trunk);
      limb(g, 22, 20, 13, 11, 1.6, trunk);
      limb(g, 22, 18, 31, 10, 1.6, trunk);
      ellipse(g, 22, 8.4, 21, 4.4, leaf);
      ellipse(g, 15, 5.6, 11, 3.2, leaf);
      ellipse(g, 30, 6, 10, 3, leaf);
    }, null);
  }

  function tuftSprite(colors, tall) {
    const h = tall ? 9 : 6;
    return pixelSprite(7, h, g => {
      curve(g, [[1, h], [1, h - 3], [0, 1]], 1, colors[0]);
      curve(g, [[3, h], [3.4, h - 4], [3, 0]], 1, colors[1]);
      curve(g, [[5, h], [5, h - 3], [6.4, 1.4]], 1, colors[0]);
    }, null);
  }

  const FLAMINGO = pixelSprite(7, 11, g => {
    ellipse(g, 3, 4, 2.6, 1.6, '#f1a1b0');
    curve(g, [[5, 3.4], [6.4, 1], [5, 0]], 1, '#f1a1b0');
    limb(g, 2.6, 5.4, 2.6, 11, .8, '#d98390');
  }, null);

  const SAFARI_SCENES = [
    { // 1. 은두투 출산 평원: 탁 트인 초록 평원, 나무는 드물게
      sky: skySprite(['#8ecbe4', '#a6d7e8', '#c0e3ea', '#d9eee8'], [0, 28, 54, 76, 96]),
      sun: {x: 262, y: 22, r: 9, color: '#fff3c4'},
      clouds: '#fbf8ec',
      far: hillStrip(640, 40, 14, 3, ['#a8c78c', '#9abf80'], 1),
      farY: 82,
      plain: ['#b4d282', '#a7cb76'],
      trees: {sprite: acaciaSprite(.8, '#6f9a52', '#7d6248'), every: 520, base: 140},
      ground: '#9cc46a', groundDot: '#86b257', soil: '#a8885c', soilDot: '#93744c',
      tufts: [tuftSprite(['#7aa94e', '#8fbd5c'], false), tuftSprite(['#86b85a', '#a1cc6c'], false)]
    },
    { // 2. 은두투 포식자 구역: 아카시아, 황금빛 초원, 늦은 오후 노을
      sky: skySprite(['#e08c74', '#eca77d', '#f3c08b', '#f8d7a2'], [0, 26, 52, 76, 96]),
      sun: {x: 248, y: 70, r: 14, color: '#ffe0a0'},
      far: hillStrip(640, 40, 18, 2, ['#c99a6c', '#b98a5e'], 2),
      farY: 80,
      plain: ['#e2bd6c', '#d8b061'],
      trees: {sprite: acaciaSprite(1.1, '#556b3c', '#5a4636'), every: 190, base: 140},
      ground: '#d8ac5a', groundDot: '#c4954a', soil: '#a7794b', soilDot: '#8f663f',
      tufts: [tuftSprite(['#c4943f', '#e2bb67'], true), tuftSprite(['#b98a3a', '#d8ae5c'], true)]
    },
    { // 3. 응고롱고로 분화구: 뒤를 감싸는 분화구 벽, 초원·습지·호수, 멀리 플라밍고
      sky: skySprite(['#7fb9db', '#98c8e2', '#b5d8e8'], [0, 26, 50, 70]),
      sun: {x: 70, y: 18, r: 8, color: '#fff5d2'},
      clouds: '#f4f8f6',
      crater: craterStrip(),
      lake: true,
      plain: ['#8fb46a', '#83a95f'],
      ground: '#9ab868', groundDot: '#86a657', soil: '#8b7650', soilDot: '#776444',
      tufts: [tuftSprite(['#6f9a4c', '#86b05c'], true), tuftSprite(['#7aa652', '#94bd66'], false)]
    },
    { // 보너스: 대이동 질주 — 다시 은두투 평원, 흙먼지
      sky: skySprite(['#e9b77f', '#f1cb92', '#f5dbaa', '#efe2bf'], [0, 26, 52, 76, 96]),
      sun: {x: 272, y: 58, r: 12, color: '#ffe7b0'},
      far: hillStrip(640, 40, 16, 3, ['#b8b47c', '#a9a86f'], 3),
      farY: 80,
      dust: true,
      plain: ['#c2c27a', '#b5b86f'],
      ground: '#b5bd6c', groundDot: '#a0aa5c', soil: '#a7865a', soilDot: '#8f714c',
      tufts: [tuftSprite(['#94a556', '#adbd68'], false)]
    }
  ];
  const CLOUD = color => pixelSprite(34, 10, g => {
    ellipse(g, 17, 6.4, 15, 3.6, color); ellipse(g, 12, 4.4, 7, 3.6, color); ellipse(g, 21, 3.6, 8, 3.6, color);
  }, null);
  const CLOUDS = {};

  function drawStrip(target, sprite, offset, y) {
    const x = -wrap(offset, sprite.width);
    target.drawImage(sprite, Math.round(x), Math.round(y));
    target.drawImage(sprite, Math.round(x + sprite.width), Math.round(y));
  }

  function drawSafariLayer(target, stageIndex, time, distance) {
    const scene = SAFARI_SCENES[stageIndex];
    target.drawImage(scene.sky, 0, 0);
    const skyBottom = scene.sky.height;
    target.fillStyle = scene.plain[0];
    target.fillRect(0, skyBottom, W, 140 - skyBottom);
    // 해
    const sun = scene.sun;
    target.fillStyle = sun.color;
    for (let dy = -sun.r; dy <= sun.r; dy++) {
      const half = Math.round(Math.sqrt(sun.r * sun.r - dy * dy));
      target.fillRect(sun.x - half, sun.y + dy, half * 2, 1);
    }
    if (scene.clouds) {
      CLOUDS[scene.clouds] = CLOUDS[scene.clouds] || CLOUD(scene.clouds);
      for (const [cx, cy, speed] of [[30, 16, 3], [150, 34, 5], [250, 10, 2]]) {
        target.drawImage(CLOUDS[scene.clouds], Math.round(wrap(cx - time * speed, 380) - 40), cy);
      }
    }
    if (scene.crater) {
      drawStrip(target, scene.crater, distance * .02, 40);
    } else {
      drawStrip(target, scene.far, distance * .05, scene.farY);
    }
    // 들판
    target.fillStyle = scene.plain[1];
    target.fillRect(0, 118, W, 22);
    if (scene.lake) {
      // 호수와 플라밍고, 습지
      target.fillStyle = '#c9e0dc'; target.fillRect(0, 116, W, 10);
      target.fillStyle = '#b3d3d2'; target.fillRect(0, 124, W, 2);
      for (let i = 0; i < 22; i++) target.drawImage(FLAMINGO, Math.round(wrap(i * 17 - distance * .12, 374) - 10), 110 + (i % 3));
      target.fillStyle = '#7da662'; target.fillRect(0, 126, W, 14);
      for (let i = 0; i < 40; i++) {
        const x = Math.round(wrap(i * 9 - distance * .3, 360) - 10);
        target.fillStyle = i % 2 ? '#5f8a4a' : '#6c9752';
        target.fillRect(x, 124 - (i % 3), 1, 6 + (i % 3));
      }
    }
    if (scene.trees) {
      const {sprite, every, base} = scene.trees;
      for (let x = -wrap(distance * .3, every); x < W + every; x += every) target.drawImage(sprite, Math.round(x), base - sprite.height);
    }
    // 땅
    target.fillStyle = scene.ground;
    target.fillRect(0, 140, W, GROUND - 140);
    target.fillStyle = scene.groundDot;
    for (let i = 0; i < 46; i++) target.fillRect(Math.round(wrap(i * 13 - distance * .7, 598) - 10), 142 + (i * 7) % 28, 2, 1);
    scene.tufts.forEach((tuft, k) => {
      for (let i = 0; i < 10; i++) target.drawImage(tuft, Math.round(wrap(i * 41 + k * 19 - distance * .75, 410) - 10), 146 + ((i + k) * 9) % 20);
    });
    target.fillStyle = scene.groundDot;
    target.fillRect(0, GROUND, W, 1);
    target.fillStyle = scene.soil;
    target.fillRect(0, GROUND + 1, W, H - GROUND - 1);
    target.fillStyle = scene.soilDot;
    for (let i = 0; i < 16; i++) target.fillRect(Math.round(wrap(i * 29 - distance, 464) - 10), 178 + (i * 5) % 18, 3, 1);
    if (scene.dust) {
      for (let i = 0; i < 18; i++) {
        target.fillStyle = i % 2 ? '#efe0b8' : '#e6d4a8';
        target.fillRect(Math.round(wrap(i * 21 - time * 70, 378) - 20), 128 + (i * 5) % 10, 6, 2);
      }
    }
  }

  /** scene: {time, distance, stage(1~4), previousStage, blend, obstacles, coupleTop, airborne} */
  function drawSafari(target, scene) {
    target.save();
    target.imageSmoothingEnabled = false;
    drawSafariLayer(target, (scene.previousStage || scene.stage) - 1, scene.time, scene.distance);
    if (scene.previousStage) {
      target.globalAlpha = scene.blend;
      drawSafariLayer(target, scene.stage - 1, scene.time, scene.distance);
      target.globalAlpha = 1;
    }
    scene.obstacles.forEach(item => drawSafariObstacle(target, item, scene.time));
    drawCouple(target, scene.coupleTop, scene.time, scene.airborne);
    target.restore();
  }

  /* ---------- 잔지바르: 스노클링하는 신랑·신부와 돌고래 ---------- */
  function swimmerFrame(bride, kick) {
    return pixelSprite(46, 18, g => {
      const skin = bride ? BRIDE_SKIN : SKIN;
      const shade = bride ? BRIDE_SHADE : SKIN_SHADE;
      const legs = kick ? [[6.6, 8.6], [4.4, 13.6]] : [[4.4, 9.6], [6.6, 12.8]];
      legs.forEach(([fx, fy], i) => {
        limb(g, 17, 10.6 + i * 1.2, fx + 3, fy, 3, i ? shade : skin);
        poly(g, [[fx + 3, fy - 1.6], [fx - 3.6, fy - 3], [fx - 3.6, fy + 3], [fx + 3, fy + 1.6]], bride ? '#f2a1b5' : '#f2c14f');
      });
      ellipse(g, 25.4, 11, 10.2, 3.8, skin);
      if (bride) {
        ellipse(g, 24, 11, 6.8, 3.9, '#ee869c');
        rect(g, 27.6, 7.6, 1.2, 3, '#ee869c');
        g.beginPath(); g.moveTo(34, 6.4);
        g.bezierCurveTo(28, 2.4, 22, 6.4, 15, 3.6);
        g.bezierCurveTo(21, 8.4, 28, 5.6, 34, 9);
        g.fillStyle = use('#6a4a40'); g.fill();
      } else {
        rrect(g, 15.6, 7.6, 7.6, 6.6, 2, '#4f7fb6');
        rect(g, 15.8, 9.6, 7.2, 1, '#8fb7e2');
      }
      const front = kick ? [44, 8.8] : [43, 12.4];
      limb(g, 31, 9.6, front[0], front[1], 2.6, skin);
      limb(g, 30, 12, kick ? 22 : 26, 15.2, 2.4, shade);
      circle(g, 36.4, 9.6, 5.4, skin);
      ellipse(g, bride ? 35.2 : 35, bride ? 7.6 : 7, 5.6, bride ? 4.2 : 3.6, bride ? '#6a4a40' : '#34313a');
      if (bride) circle(g, 33.4, 5.2, 1.6, '#f6b9cf');
      limb(g, 32.4, 8.6, 38.6, 8.6, 1.2, '#2f6f7a');
      rrect(g, 37.4, 6.6, 5, 4.6, 1.6, '#5aa7b8');
      rect(g, 38.6, 7.6, 3, 2.4, '#d9f3f5');
      limb(g, 35.2, 5.6, 34.6, .6, 1.4, '#f2c14f');
      limb(g, 34.6, .6, 36.6, .2, 1.4, '#f2c14f');
    });
  }

  // 큰돌고래: 짧은 부리, 둥근 이마, 뒤로 휜 등지느러미, 등은 짙고 배는 하얗다. t는 꼬리를 위아래로 흔드는 정도
  function dolphinFrame(t) {
    const cv = makeCanvas(60, 26);
    const back = '#6c9cbc', side = '#a8cadd', belly = '#f4f9fb', dark = '#1f2b33';
    const skin = (x, y) => (y < 11 + (x < 28 ? 1.5 : 0) ? back : y < 14.5 ? side : belly);
    // 꼬리지느러미와 꼬리자루
    cv.poly([[17, 13 + t], [10, 7 + t * 1.6], [13, 13 + t], [10, 19 + t * 1.6]], back);
    cv.path([[25, 13], [20, 13 + t * .5], [16, 13 + t]], 7, 2.6, skin);
    // 크고 뒤로 휜 등지느러미
    cv.poly([[36, 9], [34, 5.5], [31, 2.6], [27, 1], [29, 3], [30, 6], [30, 9]], back);
    // 짧고 통통한 몸통, 도톰한 이마, 길고 또렷한 부리
    cv.ellipse(34, 13.4, 11, 6, skin);
    cv.ellipse(43, 12.8, 6, 5, skin);
    cv.ellipse(47, 11.4, 4.6, 4.4, skin);
    cv.path([[51, 14.2], [58, 14.6]], 2.6, 2, (x, y) => (y < 14 ? side : belly));
    cv.rect(52, 15, 6, 1, '#5f8aa6');
    cv.poly([[40, 16], [36, 22], [39, 22], [44, 17]], back);
    cv.set(48, 12, dark); cv.set(48, 11, '#ffffff');
    const pixels = shadeVolume(cv.px);
    return pixelSprite(60, 26, g => {
      for (const [key, color] of pixels) {
        const [x, y] = key.split(',').map(Number);
        g.fillStyle = use(color);
        g.fillRect(x, y, 1, 1);
      }
    });
  }

  // 잔뜩 부푼 복어: 사방으로 선 가시, 화난 눈. phase에 따라 가시와 지느러미가 움찔한다
  function pufferFrame(phase) {
    const cv = makeCanvas(24, 22);
    const top = '#d9b44f', belly = '#f4e7c0', spot = '#7a5b2a', spike = '#efe2c2', brow = '#3a2f2c', fin = '#e2a548';
    const center = [12, 11];
    // 가시: 몸 둘레로 짧고 날카롭게
    for (let k = 0; k < 14; k++) {
      const angle = k / 14 * TAU + (phase ? .12 : 0);
      const reachOut = 10.2 + (k % 2 ? 0 : 1) + (phase ? .5 : 0);
      cv.line(center[0] + Math.cos(angle) * 7.4, center[1] + Math.sin(angle) * 7.2,
        center[0] + Math.cos(angle) * reachOut, center[1] + Math.sin(angle) * reachOut, 1, 1, spike);
    }
    // 꼬리지느러미
    cv.poly([[19, 11], [23, 7 + phase], [23, 15 - phase]], fin);
    cv.ellipse(12, 11, 8, 7.6, (x, y) => (y >= 13 ? belly : (x * 3 + y * 5) % 7 === 0 ? spot : top));
    cv.poly([[13, 12], [16, 10 + phase], [16, 15 - phase]], fin);
    // 화난 눈과 찡그린 눈썹, 입
    cv.ellipse(7, 8.6, 2.4, 2.2, '#ffffff');
    cv.rect(6, 8, 2, 2, '#1c1416'); cv.set(6, 8, '#ffffff');
    cv.line(4.4, 5.6, 9.6, 7.2, 1.2, 1.2, brow);
    cv.rect(3, 13, 3, 1, brow); cv.set(4, 12, '#c0504a');
    const pixels = shadeVolume(cv.px);
    return pixelSprite(24, 22, g => {
      for (const [key, color] of pixels) {
        const [x, y] = key.split(',').map(Number);
        g.fillStyle = use(color);
        g.fillRect(x, y, 1, 1);
      }
    });
  }

  function rayFrame(up) {
    return pixelSprite(50, 18, g => {
      limb(g, 30, 9, 49, 9.6, 1, '#4d6a83');
      const tip = up ? 1 : 17;
      poly(g, [[4, 9], [15, tip], [24, 7], [32, 9], [24, 11], [15, 18 - tip]], '#6a8aa4');
      poly(g, [[4, 9], [15, up ? 17 : 1], [24, 11]], '#58768e');
      ellipse(g, 18, 9, 9, 3.2, '#7e9db5');
      rect(g, 6, 7.6, 1.4, 1.4, '#24323d');
    });
  }

  const SHELL = pixelSprite(13, 11, g => {
    g.beginPath(); g.moveTo(6.5, 10.4);
    g.lineTo(.6, 3.6); g.bezierCurveTo(2, -.4, 11, -.4, 12.4, 3.6); g.closePath();
    g.fillStyle = use('#f6c79e'); g.fill();
    for (let i = 0; i < 5; i++) limb(g, 6.5, 10, 1.8 + i * 2.35, 1.6, 1, '#df8f6d');
    rect(g, 4.4, 9, 4.2, 2, '#e49c7a');
  });

  const SWIM_BRIDE = [swimmerFrame(true, 0), swimmerFrame(true, 1)];
  const SWIM_GROOM = [swimmerFrame(false, 0), swimmerFrame(false, 1)];
  const DOLPHIN = [dolphinFrame(-1.6), dolphinFrame(0), dolphinFrame(1.6), dolphinFrame(0)];
  const PUFFER = [pufferFrame(0), pufferFrame(1)];
  const RAY = [rayFrame(true), rayFrame(false)];
  const SWIMMERS = {left: 44, hitLeft: 54, hitRight: 128, hitTop: 6, hitBottom: 13};
  const PUFFER_SIZE = sizeOf(PUFFER);
  const RAY_SIZE = sizeOf(RAY);

  /* 산호초: 울퉁불퉁한 바위 기둥에 산호가 자연스럽게 덮여 자란다 */
  const ROCK = ['#7a6d73', '#665a61', '#93868a', '#54494f'];
  const CORAL_TONES = [
    ['#e48f86', '#bf6c66'],
    ['#dca068', '#b67b47'],
    ['#b98bc0', '#93679c'],
    ['#e3b55c', '#b98a39'],
    ['#8bb87a', '#64925a']
  ];
  function coralClump(g, x, y, r, tone) {
    ellipse(g, x, y, r, r * .8, tone[0]);
    for (let k = 0; k < 3; k++) rect(g, x - r * .5 + k * r * .45, y - r * .2 + (k % 2), 1, 1, tone[1]);
  }
  function seaFan(g, x, y, dir, size, color) {
    for (let k = -2; k <= 2; k++) limb(g, x, y, x + dir * size, y + k * size * .45, 1, color);
    limb(g, x + dir * size * .55, y - size * .8, x + dir * size * .55, y + size * .8, 1, color);
    limb(g, x + dir * size * .9, y - size * .9, x + dir * size * .9, y + size * .9, 1, color);
  }
  const REEF_GROW = 10;
  function reefSprite(width, height, seed, fromTop) {
    const pad = 9;
    // 끝부분 산호가 틈 쪽으로 자라도록 그림 위아래에 여유를 둔다
    return pixelSprite(width + pad * 2, height + REEF_GROW, g => {
      if (!fromTop) g.translate(0, REEF_GROW);
      const random = seeded(seed);
      const tip = fromTop ? height - 1 : 1;
      const into = fromTop ? 1 : -1;
      const left = [];
      const right = [];
      for (let y = 0; y <= height; y += 4) {
        const nearTip = Math.abs(y - tip) < 14 ? 2 : 0;
        left.push([pad + 1 + random() * 5 - nearTip, y]);
        right.push([pad + width - 1 - random() * 5 + nearTip, y]);
      }
      poly(g, [...left, ...right.reverse()], ROCK[0]);
      for (let y = 0; y < height; y += 4) {
        rect(g, pad + width * .64 + random() * 3, y, width * .3, 4, ROCK[1]);
        if (random() < .6) rect(g, pad + 3 + random() * 4, y + 1, 2, 2, ROCK[2]);
        if (random() < .35) limb(g, pad + 7 + random() * (width - 14), y, pad + 7 + random() * (width - 14), y + 4, 1, ROCK[3]);
      }
      // 기둥 옆면에 붙어 자라는 산호 덩어리, 부채산호, 해면, 해조
      for (let y = 8; y < height - 6; y += 9 + random() * 7) {
        const side = random() < .5 ? -1 : 1;
        const edge = side < 0 ? pad + 2 : pad + width - 2;
        const pickTone = CORAL_TONES[Math.floor(random() * CORAL_TONES.length)];
        const roll = random();
        if (roll < .45) coralClump(g, edge + side * 1.5, y, 2.6 + random() * 2, pickTone);
        else if (roll < .65) seaFan(g, edge, y, side, 4 + random() * 2, random() < .5 ? '#a66fb3' : '#d9786a');
        else if (roll < .8) {
          for (let k = 0; k < 3; k++) {
            rrect(g, edge + side * (1 + k * 2.4) - 1.2, y - k * 2, 2.6, 6 + k, 1, '#d9a64a');
            rect(g, edge + side * (1 + k * 2.4) - .6, y - k * 2, 1.2, 1, '#8a6224');
          }
        } else {
          const color = random() < .5 ? '#6f9c62' : '#82ad6c';
          for (let k = 0; k < 3; k++) curve(g, [[edge, y + k * 2], [edge + side * 3, y + k * 2 - 2], [edge + side * 4.4, y + k * 2 - 5]], 1, color);
        }
      }
      // 끝부분 산호 무리: 뇌산호, 가지산호, 부채산호, 말미잘
      const brainX = pad + 3 + random() * (width - 16);
      ellipse(g, brainX + 6, tip - into * 1.4, 7.4, 5, '#d4a067');
      for (let k = -1; k <= 1; k++) {
        curve(g, [
          [brainX + 1, tip - into * (1.4 + k * 1.6)],
          [brainX + 6, tip - into * (3 + k * 1.6)],
          [brainX + 11, tip - into * (1.4 + k * 1.6)]
        ], 1, '#ad7c45');
      }
      const stag = random() < .5 ? '#e8907a' : '#e9a07c';
      const sx = pad + width * (brainX > pad + width / 2 ? .2 : .72);
      for (let k = 0; k < 3; k++) {
        const bx = sx + (k - 1) * 3.4;
        const len = 6 + random() * 4;
        limb(g, bx, tip, bx + (k - 1) * 1.6, tip + into * len, 1.8, stag);
        limb(g, bx + (k - 1) * .8, tip + into * len * .5, bx + (k - 1) * 3, tip + into * (len * .5 + 2.6), 1.3, stag);
        rect(g, bx + (k - 1) * 1.6 - .5, tip + into * len - .5, 1.4, 1.4, '#f7c2b1');
      }
      seaFan(g, pad + (random() < .5 ? 1 : width - 1), tip - into * (6 + random() * 6), random() < .5 ? -1 : 1, 5, '#a66fb3');
      const ax = pad + width / 2 + (random() - .5) * 8;
      for (let k = 0; k < 6; k++) limb(g, ax + k * 1.3 - 3.4, tip, ax + k * 1.6 - 4, tip + into * (2.6 + (k % 2) * 1.4), 1, '#ef9fbe');
      // 끝부분 산호 덩어리는 초록을 빼고 고른다
      for (let k = 0; k < 3; k++) {
        const x = pad + 4 + k * (width - 8) / 2 + (random() - .5) * 3;
        const y = tip - into * (3 + random() * 6);
        coralClump(g, x, y, 2.6 + random() * 1.4, CORAL_TONES[Math.floor(random() * 4)]);
      }
    });
  }

  const SEAS = [
    {bands: ['#bfeee7', '#8fd8d3', '#72c8cc', '#5bb6c4', '#48a2b8'], sand: '#ecd6a3', sandDot: '#d9c08b', weed: ['#3f8f6b', '#5aa77d', '#79e1a8']},
    {bands: ['#b4e8e4', '#82cdd2', '#66b8c8', '#4ea3bb', '#3d8fb0'], sand: '#e6cd9b', sandDot: '#d1b682', weed: ['#3a8566', '#53a078', '#70d8a2']},
    {bands: ['#93d1db', '#62b2c7', '#4a98b5', '#367ea2', '#26668c'], sand: '#d6c296', sandDot: '#c1ac80', weed: ['#2f6f5e', '#3f8a70', '#55ba97']},
    {bands: ['#f6c6a0', '#e8a99b', '#b79aae', '#8b8fb0', '#5f6f9a'], sand: '#d5b795', sandDot: '#c0a07f', weed: ['#3b6f62', '#4f8875', '#6ab79d']},
    {bands: ['#c49ab0', '#8d80a6', '#66729a', '#4a5b88', '#33456f'], sand: '#c0a68e', sandDot: '#ab917a', weed: ['#2d5a52', '#3c7064', '#519787']}
  ];
  const SEA_SKIES = SEAS.map(sea => skySprite(sea.bands, [0, 18, 58, 100, 142, 186]));
  // 해초 덤불: 한 뿌리에서 여러 가닥이 자라 물결 따라 흔들린다
  function kelpClump(sea, variant, frame) {
    const random = seeded(variant * 97 + 13);
    const height = 20 + variant * 5;
    const fronds = 5 + (variant % 3);
    return pixelSprite(26, height, g => {
      for (let f = 0; f < fronds; f++) {
        const baseX = 6 + f * 2.2 + random() * 2;
        const top = height * (.45 + random() * .55);
        const lean = (random() - .5) * 8;
        const phase = random() * TAU;
        const tone = sea.weed[f % 2];
        for (let y = 0; y < top; y++) {
          const t = y / top;
          const x = baseX + lean * t + Math.sin(t * 5 + phase + frame * 1.3) * 1.8 * t;
          rect(g, x, height - 1 - y, t > .9 ? 1 : 2, 1, tone);
          // 줄기를 따라 번갈아 난 잎
          if (y > 3 && y % 4 === f % 4) {
            const side = (Math.floor(y / 4) + f) % 2 ? 1 : -1;
            rect(g, x + (side > 0 ? 2 : -2), height - 2 - y, 2, 1, sea.weed[2]);
            rect(g, x + (side > 0 ? 3 : -2), height - 3 - y, 1, 1, sea.weed[2]);
          }
        }
      }
      // 뿌리를 덮은 짧은 해초
      for (let k = 0; k < 7; k++) {
        const x = 5 + k * 2.4 + random();
        const blade = 2 + Math.floor(random() * 4);
        rect(g, x, height - blade, 1, blade, sea.weed[k % 2]);
      }
    }, null);
  }
  const KELP = SEAS.map(sea => [0, 1, 2, 3].map(variant => [0, 1].map(frame => kelpClump(sea, variant, frame))));
  // 덤불 사이 간격을 고르지 않게 둔다
  const KELP_SPOTS = [0, 41, 70, 124, 150, 203, 262, 290, 345, 381];

  const FISH = ['#f5d27a', '#f3a3b5', '#ffffff', '#f6a86d', '#9fd8e6'].map(color => pixelSprite(9, 5, g => {
    ellipse(g, 3.4, 2.5, 3.2, 1.8, color); poly(g, [[6, 2.5], [9, .4], [9, 4.6]], color);
  }, null));
  const REEF_HILLS = pixelSprite(640, 26, g => {
    for (let i = 0; i < 10; i++) ellipse(g, 30 + i * 64, 26, 30, 10 + (i % 3) * 4, i % 2 ? '#3f7f92' : '#447f8e');
  }, null);

  function drawZanzibarLayer(target, stageIndex, time, distance) {
    const sea = SEAS[stageIndex];
    target.drawImage(SEA_SKIES[stageIndex], 0, 0);
    target.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 14; i++) target.fillRect(Math.round(wrap(i * 26 - time * 18, 364) - 20), 15 + (i % 2), 10, 1);
    if (stageIndex >= 3) {
      const bx = Math.round(wrap(220 - distance * .05, 420) - 60);
      target.fillStyle = '#5d4858';
      target.fillRect(bx + 2, 12, 30, 2); target.fillRect(bx + 5, 14, 24, 2); target.fillRect(bx + 16, 0, 1, 12);
      target.fillStyle = '#8a7183';
      for (let i = 0; i < 11; i++) target.fillRect(bx + 17, 1 + i, 11 - i, 1);
    }
    // 빛 줄기(계단 모양)
    target.fillStyle = 'rgba(255,255,255,.1)';
    for (let i = 0; i < 4; i++) {
      const x = wrap(i * 96 + 30 - distance * .06, 384) - 30;
      for (let y = 20; y < 176; y += 4) target.fillRect(Math.round(x + (y - 20) * .2), y, 12, 4);
    }
    target.globalAlpha = stageIndex >= 2 ? .55 : .4;
    drawStrip(target, REEF_HILLS, distance * .15, 162);
    target.globalAlpha = 1;
    if (stageIndex <= 2) {
      for (let i = 0; i < 6; i++) target.drawImage(FISH[i % FISH.length], Math.round(wrap(i * 71 - time * (14 + i * 3), 420) - 20), 40 + (i * 29) % 110);
    }
    target.fillStyle = sea.sand;
    target.fillRect(0, 186, W, H - 186);
    target.fillStyle = sea.sandDot;
    for (let i = 0; i < 10; i++) target.fillRect(Math.round(wrap(i * 37 - distance * .9, 370) - 10), 190 + (i % 3) * 3, 6, 1);
    const frame = Math.floor(time * 2) % 2;
    KELP_SPOTS.forEach((spot, i) => {
      const sprite = KELP[stageIndex][(i * 3) % 4][(frame + i) % 2];
      target.drawImage(sprite, Math.round(wrap(spot - distance * .9, 434) - 14), 190 - sprite.height);
    });
  }

  /** scene: {time, distance, stage(1~5), previousStage, blend, obstacles, swimTop, dolphinTop} */
  function drawZanzibar(target, scene) {
    target.save();
    target.imageSmoothingEnabled = false;
    drawZanzibarLayer(target, (scene.previousStage || scene.stage) - 1, scene.time, scene.distance);
    if (scene.previousStage) {
      target.globalAlpha = scene.blend;
      drawZanzibarLayer(target, scene.stage - 1, scene.time, scene.distance);
      target.globalAlpha = 1;
    }
    scene.obstacles.forEach(item => {
      if (item.type === 'reef') {
        const top = Math.round(item.gap - item.opening / 2);
        const bottom = Math.round(item.gap + item.opening / 2);
        item.topArt = item.topArt || reefSprite(item.w, top + 4, item.seed, true);
        item.bottomArt = item.bottomArt || reefSprite(item.w, 190 - bottom, item.seed + 7, false);
        target.drawImage(item.topArt, Math.round(item.x) - 9, -4);
        target.drawImage(item.bottomArt, Math.round(item.x) - 9, bottom - REEF_GROW);
        if (item.shell && !item.shell.taken) blit(target, SHELL, item.x - 20, item.gap - 5);
        if (item.puffer) blit(target, PUFFER[Math.floor(scene.time * 3) % 2], item.x + item.w / 2 - PUFFER_SIZE.w / 2, item.puffer.y);
      } else if (item.type === 'ray') {
        blit(target, RAY[Math.floor(scene.time * 3) % 2], item.x, item.y);
      }
    });
    // 돌고래는 두 사람보다 조금 아래에서 따라와 머리가 가려지지 않는다
    blit(target, DOLPHIN[Math.floor(scene.time * 6) % 4], -10, Math.min(scene.dolphinTop + 11, 164));
    const kick = Math.floor(scene.time * 6) % 2;
    blit(target, SWIM_BRIDE[kick], SWIMMERS.left, scene.swimTop);
    blit(target, SWIM_GROOM[1 - kick], SWIMMERS.left + 45, scene.swimTop - kick);
    target.restore();
  }

  /** 여행지 고르는 화면의 작은 미리보기 */
  function drawPreview(target, mode) {
    target.save();
    target.imageSmoothingEnabled = false;
    target.translate(0, -Math.round((H - target.canvas.height) / 2) - 8);
    if (mode === 'safari') {
      const zebra = {type: 'zebra', x: 200};
      drawSafari(target, {time: .2, distance: 0, stage: 1, obstacles: [zebra], coupleTop: GROUND - COUPLE.height, airborne: false});
    } else {
      const reef = {type: 'reef', x: 214, w: 28, gap: 100, opening: 96, seed: 3, shell: {taken: false}};
      drawZanzibar(target, {time: .2, distance: 0, stage: 1, obstacles: [reef], swimTop: 92, dolphinTop: 98});
    }
    target.restore();
  }

  window.HONEYMOON_ART = {
    W, GROUND, COUPLE, SWIMMERS, SAFARI_SIZES, PUFFER_SIZE, RAY_SIZE,
    drawSafari, drawZanzibar, drawPreview
  };
})();
