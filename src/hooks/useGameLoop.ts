import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { BALANCE } from '../data/balance';

/** 每 0.1 秒推進遊戲邏輯；切到背景時暫停，回來時判斷是否要重置 */
export function useGameLoop() {
  useEffect(() => {
    let last = performance.now();
    let hiddenAt: number | null = null;

    const id = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      // 單次最多推進 0.5 秒，避免頁面卡頓後數值暴跌
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      useGameStore.getState().step(dt);
    }, 100);

    const onHide = () => {
      hiddenAt = Date.now();
    };
    const onShow = () => {
      last = performance.now();
      if (hiddenAt === null) return;
      const away = (Date.now() - hiddenAt) / 1000;
      hiddenAt = null;
      if (away > BALANCE.offlineResetSeconds) useGameStore.getState().returnAfterAway(away);
    };
    const onVis = () => (document.hidden ? onHide() : onShow());

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
}
