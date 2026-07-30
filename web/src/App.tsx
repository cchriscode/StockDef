import { useEffect, useState } from 'react';
import type { FinishRes, RegionId } from '@tf/shared';
import { api, ensureAccount, track } from './net/api.js';
import { IntroScreen, TutorialSummary } from './screens/IntroScreen.js';
import { MapScreen } from './screens/MapScreen.js';
import { StageScreen } from './screens/StageScreen.js';
import { RevealScreen } from './screens/RevealScreen.js';
import { CompanyScreen } from './screens/CompanyScreen.js';
import { CodexScreen } from './screens/CodexScreen.js';

// §8 화면 흐름: intro → tutorial(stage TUT) → map → stage → reveal(→reward) → map …
type Screen =
  | { name: 'boot' }
  | { name: 'intro' }
  | { name: 'tutorialSummary' }
  | { name: 'map' }
  | { name: 'stage'; regionId: RegionId }
  | { name: 'reveal'; sessionId: string; finish: FinishRes; regionId: RegionId }
  | { name: 'company' }
  | { name: 'codex' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'boot' });

  useEffect(() => {
    (async () => {
      await ensureAccount(); // FR-1.1: 로그인 없이 익명 계정 자동 발급
      const me = await api.me();
      setScreen(me.tutorialDone || localStorage.getItem('tf.tutSkipped') ? { name: 'map' } : { name: 'intro' });
    })().catch(() => setScreen({ name: 'intro' }));
  }, []);

  switch (screen.name) {
    case 'boot':
      return <div className="screen center"><p>TICKER FRONT</p></div>;
    case 'intro':
      return <IntroScreen onStart={() => { track('tutorial_step', { step: 'intro_done' }); setScreen({ name: 'stage', regionId: 'TUT' }); }} />;
    case 'tutorialSummary':
      return <TutorialSummary onDone={() => { localStorage.setItem('tf.tutSkipped', '1'); setScreen({ name: 'map' }); }} />;
    case 'map':
      return (
        <MapScreen
          onEnterStage={(regionId) => setScreen({ name: 'stage', regionId })}
          onCompany={() => setScreen({ name: 'company' })}
          onCodex={() => setScreen({ name: 'codex' })}
          onTutorial={() => setScreen({ name: 'stage', regionId: 'TUT' })}
        />
      );
    case 'stage':
      return (
        <StageScreen
          regionId={screen.regionId}
          onFinish={(sessionId, finish, regionId) => setScreen({ name: 'reveal', sessionId, finish, regionId })}
          onSkipTutorial={() => setScreen({ name: 'tutorialSummary' })}
        />
      );
    case 'reveal':
      return (
        <RevealScreen
          sessionId={screen.sessionId}
          finish={screen.finish}
          regionId={screen.regionId}
          onDone={() => setScreen({ name: 'map' })}
        />
      );
    case 'company':
      return <CompanyScreen onBack={() => setScreen({ name: 'map' })} />;
    case 'codex':
      return <CodexScreen onBack={() => setScreen({ name: 'map' })} />;
  }
}
