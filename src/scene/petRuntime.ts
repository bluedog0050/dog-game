import * as THREE from 'three';

/** 3D 元件之間共享的即時資料（每幀更新，不經過 React） */
export const petRuntime = {
  /** 寵物在地板上的位置 */
  position: new THREE.Vector3(),
  /** 嘴巴的世界座標（叼球、吃藥用） */
  mouth: new THREE.Vector3(0, 0.7, 0.6),
  /** 頭頂的世界座標（愛心、Zzz 用） */
  headTop: new THREE.Vector3(0, 1.4, 0.3),
  /** 寵物目前的朝向（含玩家旋轉），泡沫要黏在身上一起轉 */
  rootYaw: 0,
  /** 可被觸控判定的寵物部位（身體、頭） */
  hitTargets: [] as THREE.Object3D[],
  /** 洗澡時手指的狀態 */
  bath: {
    touching: false,
    point: new THREE.Vector3(),
    /** 最後一次觸碰的時間（clock 秒） */
    lastTouch: -100,
  },
  /** 濕度 0~1（平滑後） */
  wet: 0,
  /** 正在甩身體（特效噴水用） */
  shaking: false,
};
