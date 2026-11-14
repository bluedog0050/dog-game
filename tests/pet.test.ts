import { describe, expect, it } from 'vitest';
import {
  createPet, tick, feed, startAiming, throwBall, clampBallTarget, petPet, giveMedicine, toggleSleep, 
  getIssues, resetForReturn, startBath, bathTouch, wetness, canDo,
} from '../src/game/pet';
import { BALANCE, SECONDS_TO_EMPTY } from '../src/data/balance';
import { fetchTimeline } from '../src/game/fetch';

const run = (s: ReturnType<typeof createPet>, seconds: number, step = 0.1) => {
  for (let t = 0; t < seconds; t += step) s = tick(s, step);
  return s;
};

describe('pet logic', () => {
  it('starts every stat at 50', () => {
    const p = createPet();
    expect(Object.values(p.stats)).toEqual([50, 50, 50, 50]);
  });

  it('decays each stat at its own speed (3x slower than v0.1)', () => {
    expect(SECONDS_TO_EMPTY).toEqual({ happiness: 90, hunger: 180, energy: 270, cleanliness: 360 });
    const p = run(createPet(), 45);
    expect(p.stats.happiness).toBeCloseTo(0, 0); // 90 秒歸零 → 50 用 45 秒
    expect(p.stats.hunger).toBeCloseTo(25, 0);
    expect(p.stats.energy).toBeCloseTo(50 - 45 * (100 / 270), 0);
    expect(p.stats.cleanliness).toBeCloseTo(50 - 45 * (100 / 360), 0);
  });

  it('sulks 3 seconds after happiness hits zero, and 5 pets forgive', () => {
    let p = run(createPet(), 49);
    expect(p.sulking).toBe(true);
    for (let i = 0; i < BALANCE.sulk.petsToForgive; i++) {
      p = petPet(p, 'head').state;
      p = run(p, 0.7);
    }
    expect(p.sulking).toBe(false);
    expect(p.stats.happiness).toBeGreaterThan(20);
  });

  it('gets sick when hungry for 10s, freezes decay, medicine cures', () => {
    let p = createPet();
    p = { ...p, stats: { ...p.stats, hunger: 0 } };
    p = run(p, 10.5);
    expect(p.sick).toBe(true);
    const frozen = p.stats.cleanliness;
    p = run(p, 5);
    expect(p.stats.cleanliness).toBe(frozen);
    p = giveMedicine(p);
    expect(p.sick).toBe(false);
  });

  it('feeding and playing restore stats', () => {
    let p = feed(createPet());
    expect(p.stats.hunger).toBe(100);
    p = run(p, 3);
    expect(throwBall(p, { x: 1, z: -1 })).toBe(p); // 沒進瞄準模式不能丟
    p = startAiming(p);
    expect(p.aiming).toBe(true);
    p = throwBall(p, { x: 1, z: -1 });
    expect(p.aiming).toBe(false);
    expect(p.activity).toBe('playing');
    expect(p.ballTarget).toEqual({ x: 1, z: -1 });
    expect(p.stats.happiness).toBeGreaterThan(70);
    p = run(p, p.activityLeft + 0.2);
    expect(p.activity).toBe('idle');
    expect(p.ballTarget).toBeNull();
  });

  it('sleep restores energy and auto-wakes', () => {
    let p = toggleSleep(createPet());
    expect(p.sleeping).toBe(true);
    p = run(p, 6);
    expect(p.sleeping).toBe(false);
    expect(p.stats.energy).toBeGreaterThan(95);
  });

  it('bath: 3s of washing fills cleanliness, then 10s of drying finishes', () => {
    let p = startBath(createPet());
    expect(p.bathing).toBe(true);
    expect(p.bathStage).toBe('wash');
    expect(canDo(p, 'feed')).not.toBeNull(); // 洗澡中不能做別的事

    let ev = 'none';
    for (let i = 0; i < 15; i++) ({ state: p, event: ev } = bathTouch(p, 0.1));
    expect(p.washTime).toBeCloseTo(1.5);
    expect(p.stats.cleanliness).toBeCloseTo(75, 0); // 50 → 100 的一半
    expect(wetness(p)).toBeCloseTo(0.5);

    for (let i = 0; i < 15; i++) ({ state: p, event: ev } = bathTouch(p, 0.1));
    expect(ev).toBe('washDone');
    expect(p.bathStage).toBe('dry');
    expect(p.stats.cleanliness).toBe(100);

    // 手指沒按著，時間過去不會乾
    p = run(p, 5);
    expect(p.bathing).toBe(true);
    expect(p.dryTime).toBe(0);

    for (let i = 0; i < 99; i++) ({ state: p } = bathTouch(p, 0.1));
    expect(p.bathing).toBe(true);
    const happyBefore = p.stats.happiness;
    ({ state: p, event: ev } = bathTouch(p, 0.2));
    expect(ev).toBe('finished');
    expect(p.bathing).toBe(false);
    expect(p.activity).toBe('shake');
    expect(p.stats.happiness).toBeCloseTo(happyBefore + 10);
    expect(wetness(p)).toBe(0);
  });

  it('ball target is clamped to the room and away from the pet', () => {
    expect(clampBallTarget({ x: 99, z: -99 })).toEqual({ x: BALANCE.ballArea.maxX, z: BALANCE.ballArea.minZ });
    const near = clampBallTarget({ x: 0.1, z: 0 });
    expect(Math.hypot(near.x, near.z)).toBeCloseTo(BALANCE.ballMinDistance);
  });

  it('fetch timeline: farther throws take longer, pet never beats the ball', () => {
    const near = fetchTimeline({ x: 0, z: -1 });
    const far = fetchTimeline({ x: 3, z: -2.5 });
    expect(far.total).toBeGreaterThan(near.total);
    expect(near.arrive).toBeGreaterThan(near.land);
  });

  it('issues are ordered by priority', () => {
    let p = createPet();
    p = { ...p, sick: true, stats: { hunger: 0, happiness: 0, energy: 0, cleanliness: 0 } };
    expect(getIssues(p)[0]).toBe('sick');
    expect(getIssues(resetForReturn(p))).toEqual([]);
  });
});
