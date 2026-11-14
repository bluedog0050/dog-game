import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { petRuntime } from './petRuntime';
import { GEO, mat } from './materials';

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.35, -0.6, -0.1, -0.6, 0.2);
  s.bezierCurveTo(-0.6, 0.5, -0.2, 0.6, 0, 0.3);
  s.bezierCurveTo(0.2, 0.6, 0.6, 0.5, 0.6, 0.2);
  s.bezierCurveTo(0.6, -0.1, 0.1, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false, curveSegments: 4 });
  g.center();
  return g;
}

function zTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a88c9';
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Z', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Particle {
  mesh: THREE.Object3D;
  life: number;
  max: number;
  vel: THREE.Vector3;
  active: boolean;
}

function usePool(count: number, make: () => THREE.Object3D) {
  return useMemo(
    () =>
      Array.from({ length: count }, () => {
        const mesh = make();
        mesh.visible = false;
        return { mesh, life: 0, max: 1, vel: new THREE.Vector3(), active: false } as Particle;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

function spawn(pool: Particle[], at: THREE.Vector3, vel: THREE.Vector3, max: number) {
  const p = pool.find((x) => !x.active);
  if (!p) return;
  p.active = true;
  p.life = 0;
  p.max = max;
  p.mesh.position.copy(at);
  p.vel.copy(vel);
  p.mesh.visible = true;
}

export function Effects() {
  const group = useRef<THREE.Group>(null!);
  const heartGeo = useMemo(heartGeometry, []);
  const heartMat = useMemo(() => mat('#ff6f91', { emissive: '#ff6f91', emissiveIntensity: 0.25 }), []);
  const bubbleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.75, roughness: 0.1, emissive: '#bfe6ff', emissiveIntensity: 0.3 }),
    [],
  );
  const zMat = useMemo(() => new THREE.SpriteMaterial({ map: zTexture(), transparent: true }), []);
  const flyMat = useMemo(() => mat('#3a3a3a'), []);

  const hearts = usePool(10, () => {
    const m = new THREE.Mesh(heartGeo, heartMat);
    return m;
  });
  const bubbles = usePool(40, () => new THREE.Mesh(GEO.ball, bubbleMat));
  const zs = usePool(4, () => new THREE.Sprite(zMat));
  const flies = useMemo(() => [0, 1].map(() => new THREE.Mesh(GEO.ball, flyMat)), [flyMat]);

  useEffect(() => {
    const g = group.current;
    [...hearts, ...bubbles, ...zs].forEach((p) => g.add(p.mesh));
    flies.forEach((f) => g.add(f));
    flies.forEach((f) => f.scale.setScalar(0.025));
  }, [hearts, bubbles, zs, flies]);

  // 愛心爆發
  const lastBurst = useRef(useGameStore.getState().heartBurst);
  const nextZ = useRef(0);
  const nextIdleBubble = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const st = useGameStore.getState();
    const pet = st.pet;

    if (st.heartBurst !== lastBurst.current) {
      lastBurst.current = st.heartBurst;
      for (let i = 0; i < 4; i++) {
        tmp.copy(petRuntime.headTop).add(tmpV.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.3));
        spawn(hearts, tmp, tmpV.set((Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.4, 0), 1.2);
      }
    }

    // 搓泡泡時飄起來的泡泡
    if (pet.bathing && petRuntime.bath.touching && pet.bathStage === 'wash' && t > nextIdleBubble.current) {
      nextIdleBubble.current = t + 0.12;
      tmp.copy(petRuntime.bath.point).add(tmpV.set((Math.random() - 0.5) * 0.2, 0.05, (Math.random() - 0.5) * 0.2));
      spawn(bubbles, tmp, tmpV.set((Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2), 1.4);
    }

    // 睡覺 Zzz
    if (pet.sleeping && t > nextZ.current) {
      nextZ.current = t + 1.1;
      spawn(zs, tmp.copy(petRuntime.headTop).add(tmpV.set(0.2, 0, 0)), tmpV.set(0.15, 0.35, 0), 2.6);
    }

    const step = (pool: Particle[], kind: 'heart' | 'bubble' | 'z') => {
      for (const p of pool) {
        if (!p.active) continue;
        p.life += dt;
        const k = p.life / p.max;
        if (k >= 1) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        p.mesh.position.addScaledVector(p.vel, dt);
        if (kind === 'heart') {
          p.mesh.scale.setScalar(0.18 * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k * 0.5));
          p.mesh.rotation.y = Math.sin(t * 4 + p.vel.x * 10) * 0.6;
        } else if (kind === 'bubble') {
          p.mesh.scale.setScalar(0.06 + k * 0.05);
          p.mesh.position.x += Math.sin(t * 5 + p.vel.z * 20) * 0.003;
        } else {
          p.mesh.position.x += Math.sin(t * 2 + p.life) * 0.004;
          const sc = 0.12 + k * 0.18;
          p.mesh.scale.set(sc, sc, sc);
          (p.mesh as THREE.Sprite).material.opacity = 1 - k;
        }
      }
    };
    step(hearts, 'heart');
    step(bubbles, 'bubble');
    step(zs, 'z');

    // 髒髒時蒼蠅繞著飛
    const dirty = pet.stats.cleanliness <= 15 && !pet.bathing;
    flies.forEach((f, i) => {
      f.visible = dirty;
      if (!dirty) return;
      const ang = t * (3 + i) + i * Math.PI;
      f.position.set(
        petRuntime.position.x + Math.cos(ang) * 0.55,
        1.05 + Math.sin(t * 7 + i) * 0.15,
        petRuntime.position.z + Math.sin(ang) * 0.45,
      );
    });
  });

  return <group ref={group} />;
}
