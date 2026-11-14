import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { petRuntime } from './petRuntime';
import { VIEW, syncOffFront, viewRuntime, wrapAngle } from './viewRuntime';
import { CAPTURE } from '../game/capture';

/**
 * 所有畫面觸控都在這裡分辨：
 * - 點一下（移動 < 10px）：摸寵物，或瞄準時丟球
 * - 單指滑動：寵物原地旋轉（有慣性）
 * - 雙指：縮放鏡頭
 * - 洗澡時從寵物身上開始的觸控：交給 BathController（搓泡泡、吹乾）
 */
export const gesture = {
  down: false,
  x: 0,
  y: 0,
  mode: 'none' as 'none' | 'pending' | 'rotate' | 'bath' | 'pinch' | 'done',
};

export function GestureController() {
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
    const pts = new Map<number, { x: number; y: number }>();
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let pinchStartDist = 1;
    let pinchStartZoom = 1;

    const castFrom = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      tools.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      return tools.ray;
    };

    const hitPet = (x: number, y: number) => {
      if (!petRuntime.hitTargets.length) return null;
      return castFrom(x, y).intersectObjects(petRuntime.hitTargets, true)[0] ?? null;
    };

    const partOf = (o: THREE.Object3D | null): 'head' | 'body' => {
      while (o) {
        if (o.userData.part) return o.userData.part;
        o = o.parent;
      }
      return 'body';
    };

    /** 點擊位置對應到地板上的點 */
    const floorPoint = (x: number, y: number) => {
      const { origin, direction } = castFrom(x, y).ray;
      let tx: number;
      let tz: number;
      if (direction.y < -0.02 && tools.ray.ray.intersectPlane(tools.floor, tools.hit)) {
        tx = tools.hit.x;
        tz = tools.hit.z;
      } else {
        const len = Math.hypot(direction.x, direction.z) || 1;
        tx = origin.x + (direction.x / len) * 10;
        tz = origin.z + (direction.z / len) * 10;
      }
      return { x: tx, z: tz };
    };

    /** 寶可夢球：點在寵物身上，或離寵物中心夠近，都算丟中 */
    const isCaptureHit = (x: number, y: number) => {
      if (hitPet(x, y)) return true;
      const rect = el.getBoundingClientRect();
      const c = tools.hit.copy(petRuntime.position).setY(0.6).project(camera);
      const sx = rect.left + ((c.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - c.y) / 2) * rect.height;
      return Math.hypot(sx - x, sy - y) < CAPTURE.hitRadiusPx;
    };

    const pinchDist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        // 第二根手指放下：改成縮放
        gesture.mode = 'pinch';
        viewRuntime.dragging = false;
        pinchStartDist = pinchDist();
        pinchStartZoom = viewRuntime.zoom;
        viewRuntime.resetting = false;
        return;
      }
      if (pts.size > 2) return;
      gesture.down = true;
      gesture.x = startX = lastX = e.clientX;
      gesture.y = startY = e.clientY;
      lastT = performance.now();
      viewRuntime.vel = 0; // 按住會停下慣性
      const pet = useGameStore.getState().pet;
      gesture.mode = pet.bathing && hitPet(e.clientX, e.clientY) ? 'bath' : 'pending';
    };

    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      gesture.x = e.clientX;
      gesture.y = e.clientY;

      if (gesture.mode === 'pinch' && pts.size >= 2) {
        const z = pinchStartZoom * (pinchStartDist / pinchDist());
        viewRuntime.zoom = THREE.MathUtils.clamp(z, VIEW.minZoom, VIEW.maxZoom);
        syncOffFront();
        return;
      }
      if (gesture.mode === 'pending' && Math.hypot(e.clientX - startX, e.clientY - startY) > VIEW.tapSlop) {
        gesture.mode = 'rotate';
        viewRuntime.dragging = true;
        viewRuntime.resetting = false;
      }
      if (gesture.mode === 'rotate') {
        const now = performance.now();
        const dx = e.clientX - lastX;
        const d = dx * VIEW.radPerPixel;
        viewRuntime.yaw += d;
        const dts = Math.max(0.008, (now - lastT) / 1000);
        // 平滑估計滑動速度，作為放開後的慣性
        viewRuntime.vel = viewRuntime.vel * 0.6 + (d / dts) * 0.4;
        lastX = e.clientX;
        lastT = now;
        syncOffFront();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (gesture.mode === 'pinch') {
        // 縮放結束後，剩下的手指不再觸發任何動作
        if (pts.size === 0) {
          gesture.mode = 'none';
          gesture.down = false;
        } else {
          gesture.mode = 'done';
        }
        return;
      }
      if (pts.size > 0) return;
      gesture.down = false;

      if (gesture.mode === 'pending' && e.type === 'pointerup') {
        // 點一下
        const st = useGameStore.getState();
        if (st.pet.aiming && st.pet.aimKind === 'capture') {
          const hit = isCaptureHit(e.clientX, e.clientY);
          const f = floorPoint(e.clientX, e.clientY);
          st.throwCapture(hit, f.x, f.z);
        } else if (st.pet.aiming) {
          const f = floorPoint(e.clientX, e.clientY);
          st.throwBall(f.x, f.z);
        } else if (!st.pet.bathing) {
          const hit = hitPet(e.clientX, e.clientY);
          if (hit) st.touchPet(partOf(hit.object));
        }
      } else if (gesture.mode === 'rotate') {
        // 太久沒移動就不要慣性
        if (performance.now() - lastT > 80) viewRuntime.vel = 0;
      }
      viewRuntime.dragging = false;
      gesture.mode = 'none';
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [camera, gl, tools]);

  // 慣性與「切回視角」動畫
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const v = viewRuntime;
    if (v.resetting) {
      const target = Math.round(v.yaw / (Math.PI * 2)) * Math.PI * 2; // 最近的正面
      v.yaw = THREE.MathUtils.damp(v.yaw, target, 6, dt);
      v.zoom = THREE.MathUtils.damp(v.zoom, 1, 6, dt);
      if (Math.abs(v.yaw - target) < 0.002 && Math.abs(v.zoom - 1) < 0.002) {
        v.yaw = 0;
        v.zoom = 1;
        v.resetting = false;
      }
      syncOffFront();
    } else if (!v.dragging && Math.abs(v.vel) > 0.01) {
      v.yaw += v.vel * dt;
      v.vel *= Math.exp(-VIEW.friction * dt);
      syncOffFront();
    }
    // 避免數字無限變大（保留在 ±2π 附近，對畫面沒有影響）
    if (!v.resetting && Math.abs(v.yaw) > Math.PI * 4) v.yaw = wrapAngle(v.yaw);
  });

  return null;
}
