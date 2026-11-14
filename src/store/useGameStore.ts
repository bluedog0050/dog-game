import { create } from 'zustand';
import * as G from '../game/pet';
import { fetchTimeline } from '../game/fetch';
import { CAPTURE, captureTimeline } from '../game/capture';
import { BALANCE } from '../data/balance';
import type { PetState } from '../game/types';
import { DEFAULT_NAME, loadSave, writeSave } from '../persistence/storage';
import { setSoundEnabled, sfx } from '../audio/sfx';

interface Floater {
  id: number;
  text: string;
}

interface GameStore {
  pet: PetState;
  name: string;
  sound: boolean;
  toast: { id: number; text: string } | null;
  floaters: Floater[];
  /** 每次增加代表要冒出愛心特效 */
  heartBurst: number;
  /** 回來時的提示 */
  welcome: string | null;

  step: (dt: number) => void;
  doAction: (a: G.ActionKey) => void;
  touchPet: (part: 'head' | 'body') => void;
  /** 洗澡時手指按在寵物身上 dt 秒 */
  bathTouch: (dt: number) => void;
  /** 瞄準模式下點畫面：把球丟到地板上的 (x, z) */
  throwBall: (x: number, z: number) => void;
  /** 寶可夢球瞄準模式下點畫面：hit = 有沒有點在寵物身上 */
  throwCapture: (hit: boolean, x: number, z: number) => void;
  returnAfterAway: (seconds: number) => void;
  setName: (n: string) => void;
  toggleSound: () => void;
  dismissWelcome: () => void;
}

const save = loadSave();
setSoundEnabled(save.sound);
let uid = 1;

export const useGameStore = create<GameStore>((set, get) => {
  const toast = (text: string) => set({ toast: { id: uid++, text } });
  const float = (text: string) => {
    const f = { id: uid++, text };
    set((s) => ({ floaters: [...s.floaters, f] }));
    setTimeout(() => set((s) => ({ floaters: s.floaters.filter((x) => x.id !== f.id) })), 1100);
  };

  return {
    pet: G.createPet(),
    name: save.name,
    sound: save.sound,
    toast: null,
    floaters: [],
    heartBurst: 0,
    welcome: null,

    step: (dt) => {
      const prev = get().pet;
      const next = G.tick(prev, dt);
      if (!prev.sick && next.sick) {
        sfx.whine();
        toast(`${get().name}生病了！快餵藥 💊`);
      }
      if (!prev.sulking && next.sulking) {
        sfx.huff();
        toast(`${get().name}鬧脾氣了，摸摸牠 5 下吧`);
      }
      if (prev.sleeping && !next.sleeping && !next.sick) {
        sfx.bark();
        toast('睡飽了！精神滿滿～');
      }
      set({ pet: next });
    },

    doAction: (a) => {
      const s = get().pet;
      // 睡覺按鈕在睡覺時代表「叫醒」
      if (a === 'sleep' && s.sleeping) {
        set({ pet: G.wake(s) });
        sfx.huff();
        toast('被叫醒了…有點不開心');
        return;
      }
      // 再按一次同一顆球的按鈕 = 取消瞄準
      if (a === 'play' && s.aiming && s.aimKind === 'ball') {
        set({ pet: G.cancelAiming(s) });
        return;
      }
      if (a === 'capture' && s.aiming && s.aimKind === 'capture') {
        set({ pet: G.cancelAiming(s) });
        return;
      }
      if (a === 'bath' && s.bathing) {
        toast(s.bathStage === 'wash' ? '用手指在牠身上搓泡泡 🫧' : '按住牠，慢慢吹乾 💨');
        return;
      }
      const reason = G.canDo(s, a);
      if (reason) {
        sfx.nope();
        toast(reason);
        return;
      }
      switch (a) {
        case 'feed':
          set({ pet: G.feed(s) });
          sfx.munch();
          float('🍖 +50');
          break;
        case 'play':
          set({ pet: G.startAiming(s) });
          toast('點一下畫面，把球丟過去 🎾');
          break;
        case 'bath':
          set({ pet: G.startBath(s) });
          toast('用手指在牠身上搓泡泡 🫧');
          break;
        case 'sleep':
          set({ pet: G.toggleSleep(s) });
          sfx.sleep();
          break;
        case 'capture':
          set({ pet: G.startCaptureAim(s) });
          toast('點寵物，丟出寶可夢球！');
          break;
        case 'medicine':
          set({ pet: G.giveMedicine(s) });
          sfx.ding();
          float('💊 康復了！');
          break;
      }
    },

    touchPet: (part) => {
      const s = get().pet;
      if (s.bathing) return;
      const wasSleeping = s.sleeping;
      const wasSulking = s.sulking;
      const { state, gained } = G.petPet(s, part);
      set({ pet: state });
      if (wasSleeping) {
        sfx.huff();
        toast('被叫醒了…有點不開心');
        return;
      }
      if (wasSulking) {
        if (!state.sulking) {
          sfx.happy();
          float('💗 原諒你了！');
          set((x) => ({ heartBurst: x.heartBurst + 1 }));
        } else if (state !== s) {
          sfx.huff();
          float(`還要 ${5 - state.sulkPets} 下`);
        }
        return;
      }
      if (gained > 0) {
        // 轉圈跳、伸懶腰會叫一聲，其他動作是開心的音效
        if (state.activity === 'jumpSpin' || state.activity === 'playBow') sfx.bark();
        else sfx.happy();
        float(`💗 +${gained}`);
        set((x) => ({ heartBurst: x.heartBurst + 1 }));
      }
    },

    bathTouch: (dt) => {
      const s = get().pet;
      if (!s.bathing) return;
      const { state, event } = G.bathTouch(s, dt);
      set({ pet: state });
      if (event === 'washDone') {
        sfx.ding();
        toast('泡泡搓好了！按住牠吹乾 💨');
      } else if (event === 'finished') {
        sfx.ding();
        setTimeout(() => sfx.bark(), 500);
        float(`✨ 香香蓬蓬！💗+${BALANCE.bath.happinessBonus}`);
        set((x) => ({ heartBurst: x.heartBurst + 1 }));
      }
    },

    throwBall: (x, z) => {
      const s = get().pet;
      const next = G.throwBall(s, { x, z });
      if (next === s) return;
      set({ pet: next });
      sfx.throwBall();
      const tl = fetchTimeline(next.ballTarget!);
      setTimeout(() => sfx.bark(), tl.grabEnd * 1000);
      setTimeout(() => {
        sfx.happy();
        float('🎾 +40');
        set((x) => ({ heartBurst: x.heartBurst + 1 }));
      }, tl.home * 1000);
    },

    throwCapture: (hit, x, z) => {
      const s = get().pet;
      const next = G.throwCapture(s, hit, { x, z });
      if (next === s) return;
      set({ pet: next });
      sfx.throwBall();
      const at = (sec: number, fn: () => void) => setTimeout(fn, sec * 1000);
      if (!hit) {
        at(CAPTURE.fly, () => sfx.nope());
        return;
      }
      const tl = captureTimeline(next.capture!.escapeAfter);
      const name = get().name;
      at(tl.hitAt, () => sfx.zap());
      tl.shakes.forEach((t0) => at(t0 + CAPTURE.shake * 0.5, () => sfx.click()));
      if (tl.successAt !== null) {
        at(tl.successAt, () => {
          sfx.success();
          float(`✨ 收服成功！`);
        });
        at(tl.releaseAt!, () => {
          sfx.poof();
          setTimeout(() => sfx.bark(), 350);
          set((x) => ({ heartBurst: x.heartBurst + 1 }));
        });
      } else {
        at(tl.breakAt!, () => {
          sfx.poof();
          sfx.huff();
          float(`${name}掙脫了！`);
        });
      }
    },

    returnAfterAway: (seconds) => {
      set({
        pet: G.resetForReturn(get().pet),
        welcome: `你離開了 ${formatDuration(seconds)}，${get().name}一直在等你！`,
      });
    },

    setName: (n) => {
      const name = n.trim().slice(0, 10) || DEFAULT_NAME;
      set({ name });
      writeSave({ name, sound: get().sound });
    },

    toggleSound: () => {
      const sound = !get().sound;
      setSoundEnabled(sound);
      set({ sound });
      writeSave({ name: get().name, sound });
    },

    dismissWelcome: () => set({ welcome: null }),
  };
});

function formatDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分鐘`;
  if (sec < 86400) return `${Math.round(sec / 3600)} 小時`;
  return `${Math.round(sec / 86400)} 天`;
}

// 網址加上 ?debug 時，可在 console 用 __game 操作（測試用）
if (typeof location !== 'undefined' && location.search.includes('debug')) {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}
