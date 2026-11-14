// 純遊戲邏輯：不依賴 React、3D 或瀏覽器，可單獨測試。
import { BALANCE, DECAY_PER_SEC, type StatKey } from '../data/balance';
import type { Activity, IssueKey, PetMove, PetState } from './types';
import { fetchTimeline, type Point } from './fetch';
import { CAPTURE, captureTimeline, missDuration } from './capture';

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const KEYS: StatKey[] = ['hunger', 'happiness', 'energy', 'cleanliness'];

export function createPet(): PetState {
  const v = BALANCE.startValue;
  return {
    stats: { hunger: v, happiness: v, energy: v, cleanliness: v },
    sleeping: false,
    sick: false,
    sulking: false,
    sulkPets: 0,
    zeroFor: { hunger: 0, cleanliness: 0, happiness: 0 },
    activity: 'idle',
    activityLeft: 0,
    activityStartedAt: 0,
    bathing: false,
    bathStage: 'wash',
    washTime: 0,
    dryTime: 0,
    aiming: false,
    aimKind: 'ball',
    capture: null,
    ballTarget: null,
    lastPetMove: null,
    time: 0,
  };
}

/** 離線重開：數值回到 50、清除所有異常狀態 */
export function resetForReturn(prev: PetState): PetState {
  return { ...createPet(), time: prev.time };
}

/** 時間前進 dt 秒 */
export function tick(s: PetState, dt: number): PetState {
  if (dt <= 0) return s;
  const stats = { ...s.stats };
  const zeroFor = { ...s.zeroFor };
  let { sleeping, sick, sulking, activity, activityLeft, aiming, aimKind } = s;
  let happinessFloor = 0;

  // 動作計時
  if (activityLeft > 0) {
    activityLeft = Math.max(0, activityLeft - dt);
    if (activityLeft === 0) {
      // 寶可夢球結束：沒丟中就回到瞄準；收服成功放出來後就不生氣了
      if (activity === 'captureMiss') {
        aiming = true;
        aimKind = 'capture';
      } else if (activity === 'captured' && s.capture && !s.capture.escapeAfter && sulking) {
        sulking = false;
        happinessFloor = BALANCE.sulk.forgiveHappiness;
      }
      activity = 'idle';
    }
  }
  const ballTarget = activity === 'playing' ? s.ballTarget : null;
  const capture = activity === 'captured' || activity === 'captureMiss' ? s.capture : null;
  if (happinessFloor) stats.happiness = Math.max(stats.happiness, happinessFloor);

  // 生病時所有數值暫停下降，給玩家時間餵藥；在寶可夢球裡也暫停
  if (!sick && activity !== 'captured') {
    for (const k of KEYS) {
      let rate = DECAY_PER_SEC[k];
      if (sleeping && k !== 'energy') rate *= BALANCE.sleep.otherDecayMultiplier;
      if (k === 'energy' && sleeping) {
        stats.energy = clamp(stats.energy + BALANCE.sleep.energyPerSec * dt);
        continue;
      }
      // 洗澡、吃飯中不會掉對應數值
      if (k === 'cleanliness' && s.bathing) continue;
      if (k === 'hunger' && activity === 'eating') continue;
      if (k === 'happiness' && sulking) continue;
      stats[k] = clamp(stats[k] - rate * dt);
    }
  }

  // 睡飽自動醒
  if (sleeping && stats.energy >= 100) sleeping = false;

  // 歸零計時
  zeroFor.hunger = stats.hunger <= 0 ? zeroFor.hunger + dt : 0;
  zeroFor.cleanliness = stats.cleanliness <= 0 ? zeroFor.cleanliness + dt : 0;
  zeroFor.happiness = stats.happiness <= 0 ? zeroFor.happiness + dt : 0;

  if (
    !sick &&
    (zeroFor.hunger >= BALANCE.sick.triggerAfter ||
      zeroFor.cleanliness >= BALANCE.sick.triggerAfter)
  ) {
    sick = true;
    sleeping = false;
  }
  if (!sulking && !sick && !sleeping && activity !== 'captured' && zeroFor.happiness >= BALANCE.sulk.triggerAfter) {
    sulking = true;
  }

  return {
    ...s,
    stats,
    sleeping,
    sick,
    sulking,
    sulkPets: sulking ? s.sulkPets : 0,
    // 生病、睡著時取消瞄準；鬧脾氣不能玩球，但可以丟寶可夢球
    aiming: aiming && !sick && !sleeping && !(sulking && aimKind === 'ball'),
    aimKind,
    capture,
    ballTarget,
    zeroFor: happinessFloor ? { ...zeroFor, happiness: 0 } : zeroFor,
    activity,
    activityLeft,
    time: s.time + dt,
  };
}

function startActivity(s: PetState, activity: Activity, duration: number): PetState {
  return { ...s, activity, activityLeft: duration, activityStartedAt: s.time };
}

/** 被摸的動作可以隨時被打斷（再點一下就換下一個動作） */
const PET_ACTIVITIES: Activity[] = ['petHead', 'jump', 'jumpSpin', 'nuzzle', 'chaseTail', 'playBow'];
export const isPetActivity = (a: Activity) => PET_ACTIVITIES.includes(a);

export const isBusy = (s: PetState) => s.activityLeft > 0 && !isPetActivity(s.activity);

/** 從清單中隨機挑一個動作，不會跟上一次一樣 */
export function pickPetMove(
  part: 'head' | 'body',
  last: PetMove | null,
  rand: () => number = Math.random,
): { move: PetMove; activity: Activity } {
  const pool = (part === 'head' ? BALANCE.pet.headMoves : BALANCE.pet.bodyMoves) as readonly PetMove[];
  const choices = pool.filter((m) => m !== last);
  const move = choices[Math.floor(rand() * choices.length)] ?? pool[0];
  const activity: Activity = move === 'jump' && rand() < BALANCE.pet.spinChance ? 'jumpSpin' : move;
  return { move, activity };
}

// ---------- 可執行動作 ----------

export type ActionKey = 'feed' | 'play' | 'bath' | 'sleep' | 'medicine' | 'capture';

/** 回傳 null 代表可以做；回傳字串代表不能做的原因 */
export function canDo(s: PetState, a: ActionKey): string | null {
  // 洗澡流程中只能繼續洗（生病時仍可餵藥）
  if (s.bathing && a !== 'bath' && !(a === 'medicine' && s.sick)) {
    return s.bathStage === 'wash' ? '先幫牠把泡泡搓完' : '先幫牠吹乾吧';
  }
  if (isBusy(s)) return '牠正在忙喔';
  if (s.sleeping && a !== 'sleep') return '牠在睡覺，先叫醒牠吧';
  switch (a) {
    case 'feed':
      if (s.stats.hunger >= 100) return '牠吃不下了';
      return null;
    case 'play':
      if (s.sick) return '生病了，不能玩';
      if (s.sulking) return '牠在生氣，先摸摸牠';
      if (s.stats.energy < BALANCE.minEnergyToPlay) return '牠太累了，讓牠睡一下';
      return null;
    case 'bath':
      return null;
    case 'sleep':
      if (s.sick) return '先餵藥再睡吧';
      if (!s.sleeping && s.stats.energy >= 100) return '牠還不睏';
      return null;
    case 'medicine':
      if (!s.sick) return '牠沒有生病';
      return null;
    case 'capture':
      if (s.sick) return '生病了，先餵藥吧';
      return null;
  }
}

export function feed(s: PetState): PetState {
  if (canDo(s, 'feed')) return s;
  const next = startActivity(s, 'eating', BALANCE.feed.duration);
  return {
    ...next,
    stats: { ...s.stats, hunger: clamp(s.stats.hunger + BALANCE.feed.hunger) },
    zeroFor: { ...s.zeroFor, hunger: 0 },
  };
}

/** 進入瞄準模式，等玩家點畫面決定丟球方向 */
export function startAiming(s: PetState): PetState {
  if (canDo(s, 'play')) return s;
  return { ...s, aiming: true, aimKind: 'ball', bathing: false };
}

/** 進入寶可夢球的瞄準模式 */
export function startCaptureAim(s: PetState): PetState {
  if (canDo(s, 'capture')) return s;
  return { ...s, aiming: true, aimKind: 'capture' };
}

/**
 * 丟出寶可夢球。
 * hit：有沒有丟中寵物；丟中後有 30% 機率在第 2 或第 3 次搖晃後掙脫。
 */
export function throwCapture(s: PetState, hit: boolean, target: Point, rand: () => number = Math.random): PetState {
  if (!s.aiming || s.aimKind !== 'capture' || canDo(s, 'capture')) return s;
  const t = clampBallTarget(target);
  if (!hit) {
    return {
      ...startActivity(s, 'captureMiss', missDuration()),
      aiming: false,
      capture: { hit: false, target: t, escapeAfter: null },
    };
  }
  const escapeAfter = rand() < CAPTURE.escapeChance ? (rand() < 0.5 ? 2 : 3) : null;
  return {
    ...startActivity(s, 'captured', captureTimeline(escapeAfter).total),
    aiming: false,
    capture: { hit: true, target: t, escapeAfter },
  };
}

export function cancelAiming(s: PetState): PetState {
  return { ...s, aiming: false };
}

/** 把落點限制在房間地板內，且不會離寵物太近 */
export function clampBallTarget(p: Point): Point {
  const A = BALANCE.ballArea;
  let x = Math.max(A.minX, Math.min(A.maxX, p.x));
  let z = Math.max(A.minZ, Math.min(A.maxZ, p.z));
  const d = Math.hypot(x, z);
  if (d < BALANCE.ballMinDistance) {
    // 太近：往同方向推遠一點（點在正中間就往後丟）
    const k = d > 0.001 ? BALANCE.ballMinDistance / d : 0;
    if (k) {
      x *= k;
      z *= k;
    } else {
      z = -BALANCE.ballMinDistance;
    }
  }
  return { x, z };
}

/** 丟球：寵物會跑去撿回來 */
export function throwBall(s: PetState, target: Point): PetState {
  if (!s.aiming || s.aimKind !== 'ball' || canDo(s, 'play')) return s;
  const t = clampBallTarget(target);
  const tl = fetchTimeline(t);
  const next = startActivity(s, 'playing', tl.total);
  return {
    ...next,
    aiming: false,
    ballTarget: t,
    stats: {
      ...s.stats,
      happiness: clamp(s.stats.happiness + BALANCE.play.happiness),
      energy: clamp(s.stats.energy + BALANCE.play.energy),
    },
    zeroFor: { ...s.zeroFor, happiness: 0 },
  };
}

export function toggleSleep(s: PetState): PetState {
  if (s.sleeping) return wake(s);
  if (canDo(s, 'sleep')) return s;
  return { ...s, sleeping: true, bathing: false, aiming: false, activity: 'idle', activityLeft: 0 };
}

/** 被叫醒會有點不開心 */
export function wake(s: PetState): PetState {
  if (!s.sleeping) return s;
  return {
    ...s,
    sleeping: false,
    stats: {
      ...s.stats,
      happiness: clamp(s.stats.happiness - BALANCE.sleep.wakeHappinessPenalty),
    },
  };
}

export function giveMedicine(s: PetState): PetState {
  if (canDo(s, 'medicine')) return s;
  const next = startActivity(s, 'medicine', BALANCE.medicine.duration);
  return { ...next, sick: false, zeroFor: { ...s.zeroFor, hunger: 0, cleanliness: 0 } };
}

/** 開始洗澡：進入搓泡泡階段 */
export function startBath(s: PetState): PetState {
  if (s.bathing || canDo(s, 'bath')) return s;
  return { ...s, bathing: true, bathStage: 'wash', washTime: 0, dryTime: 0, aiming: false };
}

export type BathEvent = 'none' | 'washDone' | 'finished';

/**
 * 手指按在寵物身上 dt 秒。
 * 搓泡泡：3 秒內清潔度升到 100，滿 3 秒換吹乾。
 * 吹乾：滿 5 秒完成，快樂 +10，然後甩一甩身體。
 */
export function bathTouch(s: PetState, dt: number): { state: PetState; event: BathEvent } {
  if (!s.bathing || dt <= 0) return { state: s, event: 'none' };
  const B = BALANCE.bath;

  if (s.bathStage === 'wash') {
    const remaining = Math.max(0, B.washSeconds - s.washTime);
    const step = Math.min(dt, remaining);
    const k = remaining > 0 ? step / remaining : 1;
    const cleanliness = clamp(s.stats.cleanliness + (100 - s.stats.cleanliness) * k);
    const washTime = s.washTime + step;
    const done = washTime >= B.washSeconds - 1e-9;
    return {
      state: {
        ...s,
        washTime,
        bathStage: done ? 'dry' : 'wash',
        stats: { ...s.stats, cleanliness: done ? 100 : cleanliness },
        zeroFor: { ...s.zeroFor, cleanliness: 0 },
      },
      event: done ? 'washDone' : 'none',
    };
  }

  const dryTime = Math.min(B.drySeconds, s.dryTime + dt);
  if (dryTime < B.drySeconds) return { state: { ...s, dryTime }, event: 'none' };

  const next = startActivity(s, 'shake', B.shakeDuration);
  return {
    state: {
      ...next,
      bathing: false,
      bathStage: 'wash',
      washTime: 0,
      dryTime: 0,
      stats: { ...s.stats, happiness: clamp(s.stats.happiness + B.happinessBonus) },
      zeroFor: { ...s.zeroFor, happiness: 0 },
    },
    event: 'finished',
  };
}

/** 濕度 0~1：搓泡泡時越來越濕，吹乾時越來越乾 */
export function wetness(s: PetState): number {
  if (!s.bathing) return 0;
  const B = BALANCE.bath;
  if (s.bathStage === 'wash') return Math.min(1, s.washTime / B.washSeconds);
  return 1 - Math.min(1, s.dryTime / B.drySeconds);
}

/** 摸摸：head = 摸頭，否則摸身體 */
export function petPet(
  s: PetState,
  part: 'head' | 'body',
  rand: () => number = Math.random,
): { state: PetState; gained: number } {
  if (s.sleeping) return { state: wake(s), gained: 0 };
  if (s.bathing || s.aiming || isBusy(s)) return { state: s, gained: 0 };

  if (s.sulking) {
    const sulkPets = s.sulkPets + 1;
    if (sulkPets >= BALANCE.sulk.petsToForgive) {
      const next = startActivity(s, 'jump', BALANCE.pet.durations.jump);
      return {
        state: {
          ...next,
          sulking: false,
          sulkPets: 0,
          zeroFor: { ...s.zeroFor, happiness: 0 },
          stats: { ...s.stats, happiness: BALANCE.sulk.forgiveHappiness },
        },
        gained: BALANCE.sulk.forgiveHappiness,
      };
    }
    return { state: startActivity({ ...s, sulkPets }, 'refuse', 0.6), gained: 0 };
  }

  if (s.sick) return { state: s, gained: 0 };

  const { move, activity } = pickPetMove(part, s.lastPetMove, rand);
  const next = startActivity(s, activity, BALANCE.pet.durations[activity as keyof typeof BALANCE.pet.durations]);
  return {
    state: {
      ...next,
      lastPetMove: move,
      stats: { ...s.stats, happiness: clamp(s.stats.happiness + BALANCE.pet.happiness) },
      zeroFor: { ...s.zeroFor, happiness: 0 },
    },
    gained: BALANCE.pet.happiness,
  };
}

// ---------- 狀態判斷（給泡泡文字與動畫用） ----------

/** 依優先順序列出目前所有問題 */
export function getIssues(s: PetState): IssueKey[] {
  const list: IssueKey[] = [];
  if (s.sick) list.push('sick');
  if (s.sulking) list.push('sulking');
  if (s.sleeping) list.push('sleeping');
  if (s.stats.hunger <= 0) list.push('hungry');
  if (s.stats.energy <= 0) list.push('tired');
  if (s.stats.cleanliness <= 0) list.push('dirty');
  if (!s.sulking && s.stats.happiness < BALANCE.lowThreshold) list.push('bored');
  return list;
}
