import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { petRuntime } from './petRuntime';
import { GEO, mat } from './materials';
import { BALANCE } from '../data/balance';

const FOAM_MAX = 60;
const DROP_MAX = 60;
const AIR_MAX = 14;

interface Drop {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  active: boolean;
}

/** 洗澡特效：身上的泡沫、水滴、吹風機與暖風 */
export function BathEffects() {
  const group = useRef<THREE.Group>(null!);
  const dryer = useRef<THREE.Group>(null!);

  const foamMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, emissive: '#eaf6ff', emissiveIntensity: 0.35, flatShading: true }),
    [],
  );
  const dropMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8fd3ff', transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#7cc8f5', emissiveIntensity: 0.3 }),
    [],
  );
  const airMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff1d6', transparent: true, opacity: 0.6, depthWrite: false }), []);
  const dryerMat = useMemo(() => mat('#ff9fb6'), []);
  const dryerDark = useMemo(() => mat('#5b4636'), []);

  const foam = useMemo(
    () =>
      Array.from({ length: FOAM_MAX }, () => {
        const m = new THREE.Mesh(GEO.fluffLow, foamMat);
        m.visible = false;
        return { mesh: m, size: 0, active: false };
      }),
    [foamMat],
  );
  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: DROP_MAX }, () => {
        const m = new THREE.Mesh(GEO.ball, dropMat);
        m.visible = false;
        return { mesh: m, vel: new THREE.Vector3(), life: 0, active: false };
      }),
    [dropMat],
  );
  const air = useMemo(
    () =>
      Array.from({ length: AIR_MAX }, () => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), airMat);
        m.visible = false;
        return { mesh: m, k: Math.random(), off: new THREE.Vector3() };
      }),
    [airMat],
  );

  useEffect(() => {
    const g = group.current;
    foam.forEach((f) => g.add(f.mesh));
    drops.forEach((d) => g.add(d.mesh));
    air.forEach((a) => g.add(a.mesh));
  }, [foam, drops, air]);

  const timers = useRef({ foam: 0, drop: 0, spray: 0 });
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), cam: new THREE.Vector3() }), []);

  const spawnDrop = (at: THREE.Vector3, vel: THREE.Vector3) => {
    const d = drops.find((x) => !x.active);
    if (!d) return;
    d.active = true;
    d.life = 0;
    d.mesh.position.copy(at);
    d.vel.copy(vel);
    d.mesh.visible = true;
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const pet = useGameStore.getState().pet;
    const bath = petRuntime.bath;
    const washing = pet.bathing && pet.bathStage === 'wash';
    const drying = pet.bathing && pet.bathStage === 'dry';
    const tm = timers.current;

    // ---- 泡沫：搓的地方越來越多，吹乾時慢慢消失 ----
    if (washing && bath.touching && t > tm.foam) {
      tm.foam = t + 0.06;
      const f = foam.find((x) => !x.active);
      if (f) {
        f.active = true;
        f.size = 0;
        // 稍微往外推，貼在毛的表面
        v.a.copy(bath.point).sub(petRuntime.position).setY(0).normalize().multiplyScalar(0.04);
        f.mesh.position.copy(bath.point).add(v.a).add(v.b.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12));
        f.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        f.mesh.visible = true;
      }
    }
    const foamLeft = drying ? Math.max(0, 1 - (pet.dryTime / BALANCE.bath.drySeconds) * 1.6) : pet.bathing ? 1 : 0;
    for (const f of foam) {
      if (!f.active) continue;
      f.size = Math.min(1, f.size + dt * 6);
      const sc = 0.055 * f.size * foamLeft * (1 + Math.sin(t * 3 + f.mesh.position.x * 20) * 0.08);
      f.mesh.scale.setScalar(sc);
      if (foamLeft <= 0.001) {
        f.active = false;
        f.mesh.visible = false;
      }
    }

    // ---- 水滴：搓泡泡時從上方淋下來 ----
    if (washing && bath.touching && t > tm.drop) {
      tm.drop = t + 0.05;
      v.a.copy(bath.point).add(v.b.set((Math.random() - 0.5) * 0.4, 0.55 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
      spawnDrop(v.a, v.b.set(0, -0.5, 0));
    }
    // 甩身體：往四周噴水
    if (petRuntime.shaking && petRuntime.wet > 0.15 && t > tm.spray) {
      tm.spray = t + 0.03;
      const ang = Math.random() * Math.PI * 2;
      v.a.set(petRuntime.position.x + Math.cos(ang) * 0.4, 0.55 + Math.random() * 0.4, petRuntime.position.z + Math.sin(ang) * 0.4);
      spawnDrop(v.a, v.b.set(Math.cos(ang) * 2.2, 1 + Math.random(), Math.sin(ang) * 2.2));
    }
    for (const d of drops) {
      if (!d.active) continue;
      d.life += dt;
      d.vel.y -= 9 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.scale.set(0.022, 0.034, 0.022);
      if (d.mesh.position.y < 0.02 || d.life > 1.5) {
        d.active = false;
        d.mesh.visible = false;
      }
    }

    // ---- 吹風機與暖風 ----
    const showDryer = drying && bath.touching;
    const dg = dryer.current;
    dg.visible = showDryer;
    if (showDryer) {
      // 吹風機放在手指那一側的斜前方，側面朝向鏡頭，不會擋住臉
      const side = bath.point.x >= petRuntime.position.x ? 1 : -1;
      v.cam.copy(state.camera.position).sub(bath.point).normalize();
      v.a.copy(bath.point).addScaledVector(v.cam, 0.2).add(v.b.set(side * 0.55, 0.12, 0));
      dg.position.lerp(v.a, Math.min(1, dt * 20));
      dg.lookAt(bath.point);
      dg.rotation.z += Math.sin(t * 30) * 0.01;
    }
    for (const a of air) {
      a.mesh.visible = showDryer;
      if (!showDryer) continue;
      a.k += dt * 2.6;
      if (a.k > 1) {
        a.k -= 1;
        a.off.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, 0);
      }
      // 從噴嘴往寵物飛
      v.a.copy(dg.position).lerp(bath.point, a.k).add(v.b.copy(a.off).multiplyScalar(1 + a.k * 2));
      a.mesh.position.copy(v.a);
      a.mesh.lookAt(bath.point);
      (a.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6;
      a.mesh.scale.setScalar(1 - a.k * 0.5);
    }
  });

  return (
    <>
      <group ref={group} />
      {/* 低多邊形吹風機：lookAt 會讓 +Z 朝向寵物，所以噴嘴放在 +Z */}
      <group ref={dryer} visible={false}>
        <mesh material={dryerMat} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.26, 8]} />
        </mesh>
        <mesh material={dryerDark} position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.075, 0.08, 8]} />
        </mesh>
        <mesh material={dryerMat} position={[0, 0, -0.135]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.02, 8]} />
        </mesh>
        <mesh material={dryerMat} position={[0, -0.14, -0.04]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.22, 0.07]} />
        </mesh>
      </group>
    </>
  );
}
