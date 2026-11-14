import * as THREE from 'three';

/** 3D 元件之間共享的即時資料（每幀更新，不經過 React） */
export const petRuntime = {
  /** 寵物在地板上的位置 */
  position: new THREE.Vector3(),
  /** 嘴巴的世界座標（叼球、吃藥用） */
  mouth: new THREE.Vector3(0, 0.7, 0.6),
  /** 頭頂的世界座標（愛心、Zzz 用） */
  headTop: new THREE.Vector3(0, 1.4, 0.3),
  /** 洗澡時要冒泡泡的位置佇列 */
  bubbleQueue: [] as THREE.Vector3[],
};
