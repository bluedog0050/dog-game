import { useEffect } from 'react';
import { PetScene } from './scene/PetScene';
import { TopBar } from './ui/TopBar';
import { SpeechBubble } from './ui/SpeechBubble';
import { ActionBar } from './ui/ActionBar';
import { Floaters, NightShade, Toast, Welcome } from './ui/Overlays';
import { useGameLoop } from './hooks/useGameLoop';
import { unlockAudio } from './audio/sfx';
import { useGameStore } from './store/useGameStore';

export default function App() {
  useGameLoop();
  const bathing = useGameStore((s) => s.pet.bathing);
  const aiming = useGameStore((s) => s.pet.aiming);

  // iOS 需要使用者觸碰後才能播放聲音
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <div className={`app${bathing ? ' bathing' : ''}${aiming ? ' aiming' : ''}`}>
      <div className="scene">
        <PetScene />
      </div>
      <NightShade />
      <TopBar />
      <Welcome />
      <Floaters />
      <Toast />
      <div className="bottom">
        <SpeechBubble />
        <ActionBar />
      </div>
    </div>
  );
}
