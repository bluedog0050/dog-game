import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { petRuntime } from './petRuntime';
import { loops, sfx } from '../audio/sfx';
import { gesture } from './GestureController';

/**
 * 洗澡的觸控：每一幀檢查手指是否「按在寵物身上」。
 * 按著（或滑動）時累計時間，不需要一直移動；手指離開寵物就暫停。
 */
export function BathController() {
  const { camera, gl } = useThree();
  // 搓完泡泡時手指還按著，要先放開再按才開始吹乾
  const mustRelease = useRef(false);
  const prevStage = useRef<string>('');
  const acc = useRef(0);
  const nextPop = useRef(0);
  const tools = useMemo(() => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const store = useGameStore.getState();
    const pet = store.pet;
    const bath = petRuntime.bath;
    const p = gesture;
    if (!p.down) mustRelease.current = false;

    const stageKey = pet.bathing ? pet.bathStage : '';
    if (prevStage.current === 'wash' && stageKey === 'dry' && p.down) mustRelease.current = true;
    prevStage.current = stageKey;

    // 只有「從寵物身上開始」的觸控才算洗澡（從空白處開始滑是旋轉視角）
    let touching = false;
    if (pet.bathing && p.down && p.mode === 'bath' && !mustRelease.current && petRuntime.hitTargets.length) {
      const rect = gl.domElement.getBoundingClientRect();
      tools.ndc.set(((p.x - rect.left) / rect.width) * 2 - 1, -((p.y - rect.top) / rect.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      const hit = tools.ray.intersectObjects(petRuntime.hitTargets, true)[0];
      if (hit) {
        touching = true;
        bath.point.copy(hit.point);
        bath.lastTouch = t;
      }
    }
    bath.touching = touching;

    // 聲音
    if (touching && pet.bathStage === 'wash') {
      loops.water.start();
      loops.dryer.stop();
      if (t > nextPop.current) {
        sfx.pop();
        nextPop.current = t + 0.25 + Math.random() * 0.3;
      }
    } else if (touching && pet.bathStage === 'dry') {
      loops.dryer.start();
      loops.water.stop();
    } else {
      loops.stopAll();
    }

    // 每 0.1 秒把累計時間交給遊戲邏輯，避免每幀重繪介面
    if (touching) acc.current += dt;
    if (acc.current >= 0.1 || (!touching && acc.current > 0)) {
      store.bathTouch(acc.current);
      acc.current = 0;
    }
  });

  useEffect(() => () => loops.stopAll(), []);
  return null;
}
