import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

/**
 * 瞄準模式：點畫面任何地方，依點擊方向把球丟到地板上。
 * 點到地板就丟到那個位置；點到牆或天空就沿那個方向丟到最遠。
 */
export function AimHandler() {
  const { camera, gl } = useThree();
  const tools = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      floor: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      const st = useGameStore.getState();
      if (!st.pet.aiming) return;
      const rect = el.getBoundingClientRect();
      tools.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      const { origin, direction } = tools.ray.ray;
      let x: number;
      let z: number;
      if (direction.y < -0.02 && tools.ray.ray.intersectPlane(tools.floor, tools.hit)) {
        x = tools.hit.x;
        z = tools.hit.z;
      } else {
        // 往上點：沿水平方向丟到房間深處（之後會被限制在地板範圍內）
        const len = Math.hypot(direction.x, direction.z) || 1;
        x = origin.x + (direction.x / len) * 10;
        z = origin.z + (direction.z / len) * 10;
      }
      st.throwBall(x, z);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [camera, gl, tools]);

  return null;
}
