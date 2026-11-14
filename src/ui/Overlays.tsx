import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

/** 「+8」等飄字 */
export function Floaters() {
  const floaters = useGameStore((s) => s.floaters);
  return (
    <div className="floaters" aria-live="polite">
      {floaters.map((f) => (
        <div key={f.id} className="floater">{f.text}</div>
      ))}
    </div>
  );
}

/** 短暫提示 */
export function Toast() {
  const toast = useGameStore((s) => s.toast);
  const [visible, setVisible] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast);
    const id = setTimeout(() => setVisible(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);
  if (!visible) return null;
  return (
    <div key={visible.id} className="toast" role="status">
      {visible.text}
    </div>
  );
}

/** 離開一陣子回來的歡迎訊息 */
export function Welcome() {
  const welcome = useGameStore((s) => s.welcome);
  const dismiss = useGameStore((s) => s.dismissWelcome);
  useEffect(() => {
    if (!welcome) return;
    const id = setTimeout(dismiss, 3500);
    return () => clearTimeout(id);
  }, [welcome, dismiss]);
  if (!welcome) return null;
  return (
    <button className="welcome" onClick={dismiss}>
      <span className="welcome-emoji">🐶</span>
      <span>{welcome}</span>
    </button>
  );
}

/** 睡覺時整個畫面變暗一點 */
export function NightShade() {
  const sleeping = useGameStore((s) => s.pet.sleeping);
  return <div className={`night${sleeping ? ' on' : ''}`} />;
}
