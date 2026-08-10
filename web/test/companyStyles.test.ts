import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 업그레이드 화면도 CSS 클래스에 전적으로 기대는 레이아웃이라 정의 누락을 테스트로 막는다
const ROOT = path.resolve(__dirname, '..');
const tsx = fs.readFileSync(path.join(ROOT, 'src/screens/CompanyScreen.tsx'), 'utf-8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf-8');

describe('업그레이드 데스크 클래스 정의', () => {
  it('CompanyScreen이 쓰는 클래스가 styles.css에 모두 있다', () => {
    const tokens = new Set<string>();
    for (const m of tsx.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      for (const t of raw.split(/\s+/)) if (t && /^[a-z][\w-]*$/i.test(t)) tokens.add(t);
    }
    for (const t of ['ready', 'locked', 'maxed']) tokens.add(t); // 상태 클래스는 표현식으로만 붙는다
    expect([...tokens].filter((t) => !css.includes(`.${t}`))).toEqual([]);
    expect(tokens.size).toBeGreaterThan(10);
  });
});
