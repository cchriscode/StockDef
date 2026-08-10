// 워룸 지도 스모크 — 마운트 시 렌더가 터지지 않고 핵심 UI가 나오는지 (SSR 문자열 검사)
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

beforeAll(() => {
  // api 모듈이 로드 시점에 localStorage를 읽는다
  vi.stubGlobal('localStorage', { getItem: () => 'tok', setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

describe('MapScreen (워룸)', () => {
  it('지도 로딩 전에도 렌더가 성공한다', async () => {
    const { MapScreen } = await import('../src/screens/MapScreen.js');
    const html = renderToStaticMarkup(
      <MapScreen onEnterStage={() => {}} onCodex={() => {}} onTutorial={() => {}} onTitle={() => {}} />,
    );
    expect(html).toContain('지도 로딩');
  });
});
