import { describe, expect, it } from 'vitest';
import {
  createPet, tick, feed, play, petPet, giveMedicine, toggleSleep, scrub, setBathing,
  getIssues, resetForReturn,
} from '../src/game/pet';
import { BALANCE } from '../src/data/balance';

const run = (s: ReturnType<typeof createPet>, seconds: number, step = 0.1) => {
  for (let t = 0; t < seconds; t += step) s = tick(s, step);
  return s;
};

describe('pet logic', () => {
  it('starts every stat at 50', () => {
    const p = createPet();
    expect(Object.values(p.stats)).toEqual([50, 50, 50, 50]);
  });

  it('decays each stat at its own speed', () => {
    const p = run(createPet(), 15);
    expect(p.stats.happiness).toBeCloseTo(0, 0); // 30 秒歸零 → 50 用 15 秒
    expect(p.stats.hunger).toBeCloseTo(25, 0);
    expect(p.stats.energy).toBeCloseTo(50 - 15 * (100 / 90), 0);
    expect(p.stats.cleanliness).toBeCloseTo(50 - 15 * (100 / 120), 0);
  });

  it('sulks 3 seconds after happiness hits zero, and 5 pets forgive', () => {
    let p = run(createPet(), 19);
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
    p = play(p);
    expect(p.stats.happiness).toBeGreaterThan(70);
  });

  it('sleep restores energy and auto-wakes', () => {
    let p = toggleSleep(createPet());
    expect(p.sleeping).toBe(true);
    p = run(p, 6);
    expect(p.sleeping).toBe(false);
    expect(p.stats.energy).toBeGreaterThan(95);
  });

  it('bath scrubbing reaches 100 and ends bathing', () => {
    let p = setBathing(createPet(), true);
    p = scrub(p, 1000);
    expect(p.stats.cleanliness).toBe(100);
    expect(p.bathing).toBe(false);
  });

  it('issues are ordered by priority', () => {
    let p = createPet();
    p = { ...p, sick: true, stats: { hunger: 0, happiness: 0, energy: 0, cleanliness: 0 } };
    expect(getIssues(p)[0]).toBe('sick');
    expect(getIssues(resetForReturn(p))).toEqual([]);
  });
});
