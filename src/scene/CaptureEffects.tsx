import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { petRuntime } from './petRuntime';
import { GEO, mat } from './materials';
import { CAPTURE, captureTimeline, type CaptureTimeline } from '../game/capture';
import { FETCH } from '../game/fetch';

const R = 0.13; // 寶可夢球半徑
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  active: boolean;
}

function makePool(n: number, geo: THREE.BufferGeometry, material: THREE.Material | (() => THREE.Material)) {
  return Array.from({ length: n }, () => {
    const m = new THREE.Mesh(geo, typeof material === 'function' ? material() : material);
    m.visible = false;
    return { mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, active: false } as Particle;
  });
}

/** 寶可夢球：上紅下白、中間白色腳掌印按鈕；收服動畫與特效 */
export function CaptureEffects() {
  const root = useRef<THREE.Group>(null!);
  const shakePivot = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Group>(null!);
  const lid = useRef<THREE.Group>(null!);
  const fx = useRef<THREE.Group>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const flash = useRef<THREE.Mesh>(null!);

  const m = useMemo(
    () => ({
      red: mat('#e8383d', { roughness: 0.35 }),
      white: mat('#fbfbf7', { roughness: 0.4 }),
      band: mat('#2b2422', { roughness: 0.5 }),
      paw: mat('#fbfbf7', { roughness: 0.35, emissive: '#ff6a6a', emissiveIntensity: 0 }),
      star: mat('#ffd54a', { emissive: '#ffcf33', emissiveIntensity: 0.9 }),
      beam: new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.55, depthWrite: false }),
      flash: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  );
  const geo = useMemo(
    () => ({
      top: new THREE.SphereGeometry(R, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2),
      bottom: new THREE.SphereGeometry(R * 0.995, 18, 9, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      band: new THREE.TorusGeometry(R * 1.0, R * 0.075, 6, 24),
      ring: new THREE.CylinderGeometry(R * 0.42, R * 0.42, R * 0.12, 16),
      star: new THREE.OctahedronGeometry(1, 0),
      beam: new THREE.CylinderGeometry(0.04, 0.09, 1, 8, 1, true),
    }),
    [],
  );

  const stars = useMemo(() => makePool(18, geo.star, m.star), [geo, m]);
  const smoke = useMemo(
    () =>
      makePool(16, GEO.fluffLow, () =>
        new THREE.MeshStandardMaterial({ color: '#efebe5', emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true, opacity: 0.9, roughness: 1, flatShading: true, depthWrite: false }),
      ),
    [],
  );

  useEffect(() => {
    stars.forEach((p) => fx.current.add(p.mesh));
    smoke.forEach((p) => fx.current.add(p.mesh));
  }, [stars, smoke]);

  const state = useRef({
    key: '',
    start: 0,
    tl: null as CaptureTimeline | null,
    fired: new Set<string>(),
    hover: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    floor: new THREE.Vector3(),
    rollDir: new THREE.Vector3(),
  });
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);

  const spawn = (pool: Particle[], at: THREE.Vector3, vel: THREE.Vector3, max: number) => {
    const p = pool.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.life = 0;
    p.max = max;
    p.mesh.position.copy(at);
    p.vel.copy(vel);
    p.mesh.visible = true;
  };

  const burstStars = (at: THREE.Vector3) => {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      v.b.set(Math.cos(ang) * (0.8 + Math.random() * 0.6), 0.9 + Math.random() * 0.9, Math.sin(ang) * 0.5);
      spawn(stars, at, v.b, 0.9 + Math.random() * 0.4);
    }
  };
  const burstSmoke = (at: THREE.Vector3, n: number) => {
    const center = at.clone(); // at 可能就是 v.a，先複製避免被覆蓋
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      // 煙霧從寵物周圍往外冒（太靠近會被毛蓋住）
      v.a.copy(center).add(v.b.set(Math.cos(ang) * 0.55, Math.random() * 0.5, Math.sin(ang) * 0.4 + 0.15));
      spawn(smoke, v.a, v.b.set(Math.cos(ang) * 1.1, 0.4 + Math.random() * 0.6, Math.sin(ang) * 0.7), 1.0 + Math.random() * 0.4);
    }
  };

  useFrame((three, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = three.clock.elapsedTime;
    const pet = useGameStore.getState().pet;
    const S = state.current;
    const active = (pet.activity === 'captured' || pet.activity === 'captureMiss') && pet.activityLeft > 0 && pet.capture;

    // 新的一次投擲
    const key = active ? `${pet.activity}:${pet.activityStartedAt}` : '';
    if (key !== S.key) {
      S.key = key;
      S.start = t;
      S.fired.clear();
      if (active) {
        const cap = pet.capture!;
        S.tl = cap.hit ? captureTimeline(cap.escapeAfter) : null;
        S.hit.copy(petRuntime.position).setY(0.65).add(v.a.set(0, 0, 0.25));
        S.hover.copy(S.hit).add(v.a.set(0, 0.55, 0.45));
        S.floor.set(petRuntime.position.x, R, petRuntime.position.z + 0.2);
        S.rollDir.set(cap.target.x - FETCH.origin.x, 0, cap.target.z - FETCH.origin.z).normalize();
      }
    }
    const once = (name: string, fn: () => void) => {
      if (!S.fired.has(name)) {
        S.fired.add(name);
        fn();
      }
    };

    const g = root.current;
    g.visible = !!active;
    beam.current.visible = false;
    let lidOpen = 0;
    let shakeZ = 0;
    let scale = 1;
    let glow = 0;
    let flashAt: THREE.Vector3 | null = null;

    if (active) {
      const at = t - S.start;
      const cap = pet.capture!;
      const C = CAPTURE;

      if (!cap.hit) {
        // ---- 沒丟中：飛到地板，滾一下後消失 ----
        const T = v.b.set(cap.target.x, R, cap.target.z);
        if (at < C.fly) {
          const q = at / C.fly;
          g.position.set(
            THREE.MathUtils.lerp(FETCH.origin.x, T.x, q),
            THREE.MathUtils.lerp(FETCH.origin.y, R, q) + Math.sin(q * Math.PI) * 0.6,
            THREE.MathUtils.lerp(FETCH.origin.z, T.z, q),
          );
          spin.current.rotation.x -= dt * 14;
        } else {
          const k = at - C.fly;
          const dist = 0.7 * (1 - Math.exp(-k * 3));
          g.position.copy(T).addScaledVector(S.rollDir, dist);
          g.position.y = R + Math.abs(Math.sin(k * 10)) * 0.18 * Math.exp(-k * 4);
          spin.current.rotation.x -= dt * 10 * Math.exp(-k * 2);
          scale = 1 - ease((k - (C.missRoll - 0.3)) / 0.3);
        }
      } else {
        const tl = S.tl!;
        if (at < tl.hitAt) {
          // ---- 丟出去 ----
          const q = at / tl.hitAt;
          g.position.lerpVectors(v.a.set(FETCH.origin.x, FETCH.origin.y, FETCH.origin.z), S.hit, q);
          g.position.y += Math.sin(q * Math.PI) * 0.5;
          spin.current.rotation.x -= dt * 16;
        } else if (at < tl.inBallAt) {
          // ---- 命中：彈開到空中、打開、紅光把寵物吸進去 ----
          const k = (at - tl.hitAt) / C.absorb;
          g.position.lerpVectors(S.hit, S.hover, ease(k / 0.25));
          spin.current.rotation.x = THREE.MathUtils.damp(spin.current.rotation.x, 0, 12, dt);
          lidOpen = k < 0.15 ? ease(k / 0.15) : k > 0.82 ? 1 - ease((k - 0.82) / 0.18) : 1;
          if (k > 0.12 && k < 0.85) {
            // 紅光：球 → 寵物
            const b = beam.current;
            b.visible = true;
            v.a.copy(petRuntime.position).setY(0.5 + petRuntime.position.y);
            v.b.copy(g.position).sub(v.a);
            const len = v.b.length();
            b.position.copy(v.a).addScaledVector(v.b, 0.5);
            b.scale.set(1, len, 1);
            b.quaternion.setFromUnitVectors(v.up, v.b.normalize());
            m.beam.opacity = 0.4 + Math.sin(t * 40) * 0.15;
          }
          once('flashIn', () => (flashAt = g.position));
        } else {
          // ---- 落地 ----
          spin.current.rotation.x = 0;
          if (at < tl.landed) {
            const q = (at - tl.inBallAt) / C.drop;
            if (q < 0.5) {
              const f = q / 0.5;
              g.position.lerpVectors(S.hover, S.floor, f);
              g.position.y = THREE.MathUtils.lerp(S.hover.y, R, f * f);
            } else {
              const f = (q - 0.5) / 0.5;
              g.position.copy(S.floor);
              g.position.y = R + Math.abs(Math.sin(f * Math.PI * 2)) * 0.12 * (1 - f);
            }
          } else {
            g.position.copy(S.floor);
          }
          // ---- 左右搖晃 ----
          for (const s0 of tl.shakes) {
            if (at >= s0 && at < s0 + C.shake) {
              shakeZ = Math.sin(((at - s0) / C.shake) * Math.PI * 2) * 0.45;
            }
            // 每搖完一下，按鈕閃一下
            const after = at - (s0 + C.shake);
            if (after >= 0 && after < 0.25) glow = Math.max(glow, 1 - after / 0.25);
          }
          if (tl.successAt !== null && at >= tl.successAt) {
            // ---- 收服成功：閃亮特效，按鈕持續發光 ----
            once('stars', () => burstStars(v.a.copy(g.position).setY(R * 1.6)));
            glow = Math.max(glow, 0.5 + Math.sin(t * 6) * 0.3);
            if (at >= tl.releaseAt!) {
              // ---- 3 秒後釋放：打開、白光、煙霧，球消失 ----
              const q = (at - tl.releaseAt!) / C.release;
              lidOpen = ease(q / 0.15);
              scale = 1 - ease((q - 0.3) / 0.35);
              once('release', () => {
                flashAt = petRuntime.position;
                burstSmoke(v.a.copy(petRuntime.position).setY(0.4), 14);
              });
            }
          }
          if (tl.breakAt !== null && at >= tl.breakAt) {
            // ---- 掙脫：球彈開、煙霧，球消失 ----
            const q = (at - tl.breakAt) / 0.4;
            lidOpen = ease(q / 0.3);
            scale = 1 - ease(q);
            g.position.y = R + Math.sin(Math.min(1, q) * Math.PI) * 0.15;
            once('break', () => {
              flashAt = g.position;
              burstSmoke(v.a.copy(petRuntime.position).setY(0.4), 9);
            });
          }
        }
      }

      // 按鈕朝向鏡頭
      g.rotation.y = Math.atan2(three.camera.position.x - g.position.x, three.camera.position.z - g.position.z);
    }

    shakePivot.current.rotation.z = shakeZ;
    lid.current.rotation.x = -lidOpen * 1.7;
    g.scale.setScalar(Math.max(0.0001, scale));
    m.paw.emissiveIntensity = glow * 1.2;

    // ---- 白光閃一下 ----
    const fl = flash.current;
    if (flashAt) {
      fl.userData.t = 0;
      fl.position.copy(flashAt).setY(Math.max(0.4, (flashAt as THREE.Vector3).y));
    }
    if (fl.userData.t !== undefined && fl.userData.t < 0.45) {
      fl.userData.t += dt;
      const k = fl.userData.t / 0.45;
      fl.visible = true;
      fl.scale.setScalar(0.2 + k * 0.9);
      m.flash.opacity = 0.85 * (1 - k);
    } else {
      fl.visible = false;
    }

    // ---- 粒子 ----
    for (const p of stars) {
      if (!p.active) continue;
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 2.5 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.y += dt * 8;
      p.mesh.scale.setScalar(0.045 * Math.sin(k * Math.PI) + 0.01);
    }
    for (const p of smoke) {
      if (!p.active) continue;
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(0.16 + k * 0.32);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.9 * (1 - k);
    }
  });

  return (
    <>
      <group ref={root} visible={false}>
        {/* 搖晃的支點在球底（地板接觸點） */}
        <group ref={shakePivot} position={[0, -R, 0]}>
          <group position={[0, R, 0]}>
            <group ref={spin}>
              <mesh geometry={geo.bottom} material={m.white} castShadow />
              <mesh geometry={geo.band} material={m.band} rotation={[Math.PI / 2, 0, 0]} />
              {/* 上蓋：以背面為軸打開 */}
              <group ref={lid} position={[0, 0, -R]}>
                <mesh geometry={geo.top} material={m.red} position={[0, 0, R]} castShadow />
              </group>
              {/* 中間按鈕：深色圓框＋白色腳掌印（搖晃、成功時會發光） */}
              <mesh geometry={geo.ring} material={m.band} position={[0, 0, R * 0.96]} rotation={[Math.PI / 2, 0, 0]} />
              <group position={[0, -R * 0.02, R * 1.03]}>
                <mesh geometry={GEO.ball} material={m.paw} position={[0, -R * 0.08, 0]} scale={[R * 0.16, R * 0.13, R * 0.03]} />
                {[
                  [-0.13, 0.06],
                  [-0.045, 0.13],
                  [0.045, 0.13],
                  [0.13, 0.06],
                ].map(([x, y], i) => (
                  <mesh key={i} geometry={GEO.ball} material={m.paw} position={[R * x * 1.2, R * y * 1.2, 0]} scale={[R * 0.065, R * 0.075, R * 0.03]} />
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
      <mesh ref={beam} geometry={geo.beam} material={m.beam} visible={false} />
      <mesh ref={flash} geometry={GEO.ball} material={m.flash} visible={false} />
      <group ref={fx} />
    </>
  );
}
