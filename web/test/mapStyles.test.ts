import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 지도 화면은 CSS 클래스에 전적으로 기대는 레이아웃이라, 정의 없는 클래스를 쓰면
// 타입체크·빌드가 통과해도 화면만 조용히 깨진다. 참조된 클래스가 모두 정의돼 있는지 본다.
const ROOT = path.resolve(__dirname, '..');
const tsx = fs.readFileSync(path.join(ROOT, 'src/screens/MapScreen.tsx'), 'utf-8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf-8');

describe('워룸 지도 클래스 정의', () => {
  it('MapScreen이 쓰는 클래스가 styles.css에 모두 있다', () => {
    const tokens = new Set<string>();
    for (const m of tsx.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' '); // 템플릿 표현식 제거
      for (const t of raw.split(/\s+/)) if (t && /^[a-z][\w-]*$/i.test(t)) tokens.add(t);
    }
    // 표현식으로만 붙는 상태 클래스 (state 값이라 소스에 리터럴이 없다)
    for (const t of ['captured', 'locked']) tokens.add(t);
    const missing = [...tokens].filter((t) => !css.includes(`.${t}`));
    expect(missing).toEqual([]);
    expect(tokens.size).toBeGreaterThan(10); // 파싱이 비어버린 경우 방지
  });
});
