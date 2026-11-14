// 用 Web Audio 即時合成音效，不需要音檔。
// iOS 需要使用者第一次觸碰後才能發聲，因此在第一次 pointerdown 時解鎖。

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  // iOS 解鎖技巧：播放一段無聲音訊
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start(0);
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; slideTo?: number; vol?: number; delay?: number } = {}) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const v = opts.vol ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  bark() {
    tone(620, 0.12, { type: 'triangle', slideTo: 380, vol: 0.22 });
    tone(680, 0.12, { type: 'triangle', slideTo: 400, vol: 0.2, delay: 0.16 });
  },
  happy() {
    tone(660, 0.1, { type: 'triangle' });
    tone(880, 0.14, { type: 'triangle', delay: 0.09 });
  },
  munch() {
    for (let i = 0; i < 4; i++) tone(180 + Math.random() * 60, 0.07, { type: 'square', vol: 0.05, delay: i * 0.38 });
  },
  pop() {
    tone(900 + Math.random() * 500, 0.06, { slideTo: 1600, vol: 0.08 });
  },
  whine() {
    tone(720, 0.5, { type: 'sine', slideTo: 480, vol: 0.12 });
  },
  huff() {
    tone(240, 0.18, { type: 'sawtooth', slideTo: 160, vol: 0.06 });
  },
  throwBall() {
    tone(300, 0.25, { slideTo: 900, vol: 0.08 });
  },
  ding() {
    tone(1047, 0.25, { type: 'sine', vol: 0.12 });
    tone(1319, 0.35, { type: 'sine', vol: 0.1, delay: 0.1 });
  },
  sleep() {
    tone(520, 0.4, { slideTo: 260, vol: 0.08 });
  },
  nope() {
    tone(200, 0.12, { type: 'square', vol: 0.05 });
  },
};
