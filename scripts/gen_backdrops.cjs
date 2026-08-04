// '도시별 전장 배경' 목업 번들(HTML)에서 전투 배경 장면 데이터를 추출해
// web/src/game/battleBackdrops.ts 를 생성한다.
// 사용: node scripts/gen_backdrops.cjs "Dead Cat Bounce - Backgrounds.html"
const fs = require('fs');
const path = require('path');
const src = process.argv[2] ?? 'Dead Cat Bounce - Backgrounds.html';
const bundle = fs.readFileSync(src, 'utf8');
function bundlePart(type) {
  const i = bundle.indexOf('script type="__bundler/' + type + '"');
  const start = bundle.indexOf('>', i) + 1;
  return bundle.slice(start, bundle.indexOf('</script>', start));
}
const html = JSON.parse(bundlePart('template'));

const PANEL_RE = /<div style="position:relative;width:580px;height:326px/g;
const idxs = [];
let m;
while ((m = PANEL_RE.exec(html))) idxs.push(m.index);

// 패널 뒤에 나오는 라벨(R1 여의도 등)으로 키 매핑
function labelAfter(i) {
  const seg = html.slice(idxs[i], (idxs[i + 1] ?? html.length));
  const lm = seg.match(/color:#E8ECF4">(R1|R2|R3|J1|J2|J3)?\s*([가-힣A-Za-z·\s]+)</);
  return lm ? (lm[1] ?? '') + ' ' + lm[2].trim() : '?';
}

// 균형 괄호로 repeating-linear-gradient(...) 전체 추출
function extractGradients(s) {
  const out = [];
  let i = 0;
  while ((i = s.indexOf('repeating-linear-gradient(', i)) >= 0) {
    let j = i + 'repeating-linear-gradient('.length, depth = 1;
    while (j < s.length && depth > 0) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') depth--;
      j++;
    }
    out.push(s.slice(i + 'repeating-linear-gradient('.length, j - 1));
    i = j;
  }
  return out;
}

function parseGradient(body) {
  // "to right,#A 0 6px,#B 6px 9px" — 세그먼트에 rgba() 콤마가 있으므로 괄호 깊이로 split
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  parts.push(cur.trim());
  const dirPart = parts.shift();
  const dir = dirPart.includes('bottom') ? 'y' : 'x';
  const segs = [];
  let period = 0;
  for (const p of parts) {
    const mm = p.match(/^(.+?)\s+([\d.]+)(?:px)?\s+([\d.]+)px$/);
    if (!mm) continue;
    const [, c, a, b] = mm;
    period = Math.max(period, parseFloat(b));
    if (c !== 'transparent') segs.push({ c, a: parseFloat(a), b: parseFloat(b) });
  }
  return segs.length ? { dir, period, segs } : null;
}

function num(style, key) {
  const mm = style.match(new RegExp(key + ':(-?[\\d.]+)px'));
  return mm ? parseFloat(mm[1]) : null;
}

const KEYMAP = { 0: 'R1', 1: 'R2', 2: 'R3', 3: 'J1', 4: 'J2', 5: 'J3' };
const scenes = {};

idxs.forEach((start, pi) => {
  const seg = html.slice(start, (idxs[pi + 1] ?? start + 20000));
  const styles = [...seg.matchAll(/style="([^"]+)"/g)].map((x) => x[1]);

  const bands = [];
  const rects = [];
  for (const s of styles.slice(1)) { // 첫 스타일 = 패널 자신
    if (s.startsWith('position:absolute;inset:0')) continue; // 램프 컨테이너
    if (!s.includes('position:absolute')) {
      // 램프 밴드 (flex column 자식)
      let mm = s.match(/^height:([\d.]+)px;background:(#[0-9A-Fa-f]{3,8})$/);
      if (mm) { bands.push({ h: parseFloat(mm[1]), c: mm[2] }); continue; }
      mm = s.match(/^height:([\d.]+)px;background:repeating-conic-gradient\((#[0-9A-Fa-f]{3,8}) 0% 25%,(#[0-9A-Fa-f]{3,8}) 0% 50%\)/);
      if (mm) { bands.push({ h: parseFloat(mm[1]), d: [mm[2], mm[3]] }); continue; }
      mm = s.match(/^flex:1;background:(#[0-9A-Fa-f]{3,8})$/);
      if (mm) { bands.push({ h: -1, c: mm[1] }); continue; } // flex 잔여
      continue;
    }
    // 절대 배치 사각형
    const x = num(s, 'left');
    const w = num(s, 'width');
    const h = num(s, 'height');
    if (x == null || w == null || h == null) continue;
    const top = num(s, 'top');
    const bottom = num(s, 'bottom');
    const op = (s.match(/opacity:([\d.]+)/) ?? [])[1];
    // base color: background:#hex 또는 background:rgba(...)
    const bg = (s.match(/background:(#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\))/) ?? [])[1] ?? null;
    const gradSrc = s.includes('background-image') ? s.slice(s.indexOf('background-image')) : (bg == null ? s : '');
    const layers = extractGradients(gradSrc).map(parseGradient).filter(Boolean);
    const r = { x, w, h };
    if (top != null) r.t = top;
    else if (bottom != null) r.b = bottom;
    else continue;
    if (bg) r.c = bg;
    if (op) r.o = parseFloat(op);
    if (layers.length) r.g = layers;
    rects.push(r);
  }
  scenes[KEYMAP[pi]] = { label: labelAfter(pi), bands, rects };
  console.log(KEYMAP[pi], labelAfter(pi), 'bands', bands.length, 'rects', rects.length);
});

// TS 모듈 출력
const ts = `// 자동 생성 — "Dead Cat Bounce - Backgrounds.html" 목업(도시별 전장 배경, 580×326)에서 추출.
// 재생성: node scripts/gen_backdrops.cjs "Dead Cat Bounce - Backgrounds.html"
// bands: 위→아래 하늘 램프 (h=-1은 잔여 채움, d=[a,b] 4px 디더). rects: t=top 앵커 / b=bottom 앵커(px, 패널 기준).
// g: 줄무늬 레이어 (dir x|y, period, segs[{c,a,b}]) — 창문·글로우 패턴.
export interface BackdropStripe { dir: 'x' | 'y'; period: number; segs: { c: string; a: number; b: number }[] }
export interface BackdropRect { x: number; w: number; h: number; t?: number; b?: number; c?: string; o?: number; g?: BackdropStripe[] }
export interface Backdrop { label: string; bands: { h: number; c?: string; d?: [string, string] }[]; rects: BackdropRect[] }
export const BACKDROP_W = 580;
export const BACKDROP_H = 326;
export const BACKDROP_GROUND = 128; // 패널 bottom 기준 지면선 오프셋
export const BACKDROPS: Record<string, Backdrop> = ${JSON.stringify(scenes)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'web', 'src', 'game', 'battleBackdrops.ts'), ts);
console.log('written battleBackdrops.ts', ts.length, 'bytes');
