// 'Units'/'Bases' 컨셉 시트 목업 번들에서 SVG 스프라이트를 추출해
// web/public/assets/sprites/ 에 의미 있는 이름으로 저장한다.
// 사용: node scripts/gen_sprites.cjs
// 매핑 근거: 시트의 카드 배치 순서 (포트레이트 카드가 IDLE 파일을 재사용 → 연속 중복 제거 후 순서 대응)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'web', 'public', 'assets', 'sprites');
fs.mkdirSync(OUT, { recursive: true });

function loadBundle(file) {
  const html = fs.readFileSync(file, 'utf8');
  const part = (type) => {
    const i = html.indexOf(`script type="__bundler/${type}"`);
    const start = html.indexOf('>', i) + 1;
    return html.slice(start, html.indexOf('</script>', start));
  };
  return { manifest: JSON.parse(part('manifest')), template: JSON.parse(part('template')) };
}

function orderedImageIds(template) {
  const ids = [];
  const seen = new Set();
  const re = /url\(&quot;([0-9a-f-]{36})&quot;\)/g;
  let m;
  while ((m = re.exec(template))) {
    if (!seen.has(m[1])) { // 최초 등장 순서 (포트레이트·미리보기 재사용 무시)
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids;
}

function saveAll(bundleFile, names) {
  const { manifest, template } = loadBundle(bundleFile);
  const ids = orderedImageIds(template);
  if (ids.length !== names.length) {
    throw new Error(`${bundleFile}: 스프라이트 ${ids.length}개 vs 이름 ${names.length}개 — 시트 구조 변경됨`);
  }
  ids.forEach((id, i) => {
    const e = manifest[id];
    let buf = Buffer.from(e.data, 'base64');
    if (e.compressed) buf = zlib.gunzipSync(buf);
    // 캔버스 drawImage가 고유 크기를 알도록 viewBox 기반 width/height 주입
    let svg = buf.toString('utf8');
    const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    if (vb && !/<svg[^>]*\swidth=/.test(svg)) {
      svg = svg.replace('<svg ', `<svg width="${vb[1]}" height="${vb[2]}" `);
    }
    fs.writeFileSync(path.join(OUT, names[i] + '.svg'), svg);
  });
  console.log(path.basename(bundleFile), '→', names.length, '개 저장');
}

const poses4 = (k, last) => [`${k}_idle`, `${k}_walk`, `${k}_atk`, `${k}_${last}`];
const UNIT_NAMES = [
  ...poses4('scalper', 'hit'), ...poses4('analyst', 'hit'), ...poses4('holder', 'hit'), ...poses4('riskmgr', 'hit'),
  'limit_idle', 'limit_active', 'dividend_idle', 'dividend_active', 'barrier_idle', 'barrier_active',
  ...poses4('broker', 'down'), ...poses4('algobot', 'down'), ...poses4('golem', 'down'),
  ...poses4('bureaucrat', 'down'), ...poses4('ronin', 'down'), ...poses4('giant', 'down'),
];
const BASE_NAMES = ['hq_100', 'hq_59', 'hq_24', 'foe_100', 'foe_59', 'foe_24'];

const root = path.join(__dirname, '..');
saveAll(path.join(root, 'Dead Cat Bounce - Units.html'), UNIT_NAMES);
saveAll(path.join(root, 'Dead Cat Bounce - Bases.html'), BASE_NAMES);

// 검증: 기지 viewBox가 기대 크기인지 (사옥 112×160 / 요새 176×128)
for (const [n, vb] of [['hq_100', '0 0 112 160'], ['foe_100', '0 0 176 128']]) {
  const svg = fs.readFileSync(path.join(OUT, n + '.svg'), 'utf8');
  if (!svg.includes(`viewBox="${vb}"`)) throw new Error(`${n}: viewBox ${vb} 불일치 — 순서 매핑 확인 필요`);
}
console.log('viewBox 검증 통과');
