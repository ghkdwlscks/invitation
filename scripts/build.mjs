// 청첩장을 GitHub Pages에 올릴 dist/ 폴더로 만든다.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PHOTOS = path.join(ROOT, 'assets', 'photos');
const IMAGE_FILE = /\.(jpe?g|png|webp|avif|tiff?)$/i;
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const GALLERY_PREVIEW_COUNT = 12;
const WEDDING_DATE = { year: 2027, month: 1, day: 30 };
const SITE_URL = 'https://wedding.storyofus.cloud/';
const warnings = [];

const byName = (a, b) => a.localeCompare(b, 'ko', { numeric: true });

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

async function imagesIn(directory) {
  if (!(await exists(directory))) return [];
  return (await readdir(directory)).filter(name => IMAGE_FILE.test(name)).sort(byName);
}

async function findPhoto(directory, baseName) {
  const match = (await imagesIn(directory)).find(name => path.parse(name).name === baseName);
  return match ? path.join(directory, match) : null;
}

function calendarMarkup({ year, month, day }) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const week = ['일', '월', '화', '수', '목', '금', '토']
    .map((label, index) => `<span${index === 0 ? ' class="is-sunday"' : ''}>${label}</span>`).join('');
  const cells = Array.from({ length: firstWeekday }, () => '<span></span>');
  for (let date = 1; date <= daysInMonth; date += 1) {
    const classes = [];
    if ((firstWeekday + date - 1) % 7 === 0) classes.push('is-sunday');
    if (date === day) classes.push('is-wedding');
    cells.push(`<span${classes.length ? ` class="${classes.join(' ')}"` : ''}>${date}</span>`);
  }
  return `<div class="calendar-week" aria-hidden="true">${week}</div>\n        <div class="calendar-days" aria-hidden="true">${cells.join('')}</div>`;
}

async function buildFourcut() {
  const source = path.join(PHOTOS, 'fourcut');
  await mkdir(path.join(DIST, 'photos', 'fourcut'), { recursive: true });
  for (const season of SEASONS) {
    const file = await findPhoto(source, season);
    if (!file) throw new Error(`첫 화면 사진이 없습니다: assets/photos/fourcut/${season}.jpg (또는 .webp, .png)`);
    // 휴대폰에 맞는 크기: 가장 선명한 휴대폰 화면(3배)에서도 깨지지 않을 만큼
    await sharp(file).rotate()
      .resize({ width: 720, height: 960, fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 85 })
      .toFile(path.join(DIST, 'photos', 'fourcut', `${season}.webp`));
  }
}

async function buildGallery() {
  const source = path.join(PHOTOS, 'gallery');
  let files = (await imagesIn(source)).map(name => path.join(source, name));
  if (!files.length) {
    warnings.push('갤러리 사진이 없어 첫 화면 사진 4장을 대신 넣었습니다. assets/photos/gallery/에 사진을 넣어 주세요.');
    files = await Promise.all(SEASONS.map(season => findPhoto(path.join(PHOTOS, 'fourcut'), season)));
  } else if (files.some(file => path.basename(file).startsWith('sample-'))) {
    warnings.push('갤러리에 샘플 사진(sample-*)이 들어 있습니다. 실제 사진으로 바꿔 주세요.');
  }
  await mkdir(path.join(DIST, 'photos', 'gallery', 'thumb'), { recursive: true });
  await mkdir(path.join(DIST, 'photos', 'gallery', 'full'), { recursive: true });
  const items = [];
  for (const [index, file] of files.entries()) {
    const name = `${String(index + 1).padStart(2, '0')}.webp`;
    const image = sharp(file).rotate();
    await image.clone()
      .resize({ width: 480, height: 480, fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 82 })
      .toFile(path.join(DIST, 'photos', 'gallery', 'thumb', name));
    // 크게 보기도 휴대폰 화면에 맞는 크기(긴 쪽 2000)로
    await image.clone()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(DIST, 'photos', 'gallery', 'full', name));
    const extra = index >= GALLERY_PREVIEW_COUNT ? ' class="is-extra"' : '';
    items.push(`<li${extra}><button type="button" class="gallery-item" data-full="photos/gallery/full/${name}" aria-label="사진 ${index + 1} 크게 보기">`
      + `<img src="photos/gallery/thumb/${name}" alt="" width="480" height="480" loading="lazy" decoding="async"></button></li>`);
  }
  return items.join('\n        ');
}

async function buildShareImage() {
  let file = await findPhoto(PHOTOS, 'og');
  if (!file) {
    warnings.push('카카오톡 미리보기 사진(assets/photos/og.jpg)이 없어 겨울 사진으로 대신 만들었습니다.');
    file = await findPhoto(path.join(PHOTOS, 'fourcut'), 'winter');
  }
  await mkdir(path.join(DIST, 'images'), { recursive: true });
  const image = await sharp(file).rotate()
    .resize({ width: 1200, height: 630, fit: 'cover', position: sharp.strategy.attention })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(DIST, 'images', 'og-wedding.jpg'), image);
  // 사진이 바뀌면 주소도 바뀌게 해서 카카오톡이 예전 미리보기를 붙들고 있지 않게 한다
  return `og-wedding.jpg?v=${createHash('sha1').update(image).digest('hex').slice(0, 8)}`;
}

function findPlaceholders(html) {
  const lines = html.split('\n');
  const found = [];
  lines.forEach((line, index) => {
    if (/○|준비 중|000-0000/.test(line)) {
      const text = line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      found.push(`  ${index + 1}행: ${text.slice(0, 70)}`);
    }
  });
  return found;
}

async function folderSize(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    total += entry.isDirectory() ? await folderSize(full) : (await stat(full)).size;
  }
  return total;
}

const kb = bytes => `${Math.round(bytes / 1024).toLocaleString()}KB`;

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const file of ['style.css', 'main.js']) {
  await cp(path.join(ROOT, 'site', file), path.join(DIST, file));
}
await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), {
  recursive: true,
  filter: source => !source.startsWith(PHOTOS),
});
await cp(path.join(ROOT, 'wedding'), path.join(DIST, 'wedding'), { recursive: true });

await buildFourcut();
const galleryMarkup = await buildGallery();
const shareImage = await buildShareImage();

let html = await readFile(path.join(ROOT, 'site', 'index.html'), 'utf8');
for (const [marker, markup] of [['<!-- @gallery -->', galleryMarkup], ['<!-- @calendar -->', calendarMarkup(WEDDING_DATE)]]) {
  if (!html.includes(marker)) throw new Error(`site/index.html에 ${marker} 자리가 없습니다.`);
  html = html.replace(marker, markup);
}
// 카카오톡 미리보기는 전체 주소가 있어야 사진을 불러온다
for (const [attribute, value] of [['property="og:url" content=""', SITE_URL], ['property="og:image" content="images/og-wedding.jpg', `${SITE_URL}images/${shareImage}`]]) {
  if (!html.includes(attribute)) throw new Error(`site/index.html에 ${attribute} 자리가 없습니다.`);
  html = html.replace(attribute, attribute.replace(/content="[^"]*/, `content="${value}`));
}
await writeFile(path.join(DIST, 'index.html'), html);

const placeholders = findPlaceholders(html);
if (placeholders.length) warnings.push(`아직 채우지 않은 정보가 ${placeholders.length}곳 있습니다 (dist/index.html):\n${placeholders.join('\n')}`);

let firstLoad = 0;
for (const file of ['index.html', 'style.css', 'main.js', ...SEASONS.map(season => `photos/fourcut/${season}.webp`)]) {
  firstLoad += (await stat(path.join(DIST, file))).size;
}
console.log(`dist/ 완성: 전체 ${kb(await folderSize(DIST))}, 첫 화면에 필요한 용량 ${kb(firstLoad)} (웹폰트 제외)`);
if (warnings.length) {
  console.log('\n확인할 것:');
  warnings.forEach(warning => console.log(`- ${warning}`));
}
