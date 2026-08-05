import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { bakeAllRigs } from './game/rigFrames.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
void bakeAllRigs(); // 리그 스프라이트를 타이틀 화면 동안 미리 굽는다 — 스테이지 진입을 막지 않게
