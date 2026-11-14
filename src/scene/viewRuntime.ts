import { create } from 'zustand';

/** 視角的即時狀態（每幀更新，不經過 React） */
export const viewRuntime = {
  /** 玩家滑動造成的寵物旋轉角度（弧度，不限範圍） */
  yaw: 0,
  /** 放開手指後的旋轉速度（弧度/秒），用來做慣性 */
  vel: 0,
  /** 鏡頭距離倍率：小於 1 拉近，大於 1 拉遠 */
  zoom: 1,
  /** 手指正在旋轉 */
  dragging: false,
  /** 正在平滑轉回正面 */
  resetting: false,
};

export const VIEW = {
  /** 每滑 1 像素轉幾度（弧度） */
  radPerPixel: 0.012,
  /** 慣性衰減（越大停越快） */
  friction: 3.5,
  /** 最近：看清楚臉；最遠：看到整個房間 */
  minZoom: 0.6,
  maxZoom: 1.55,
  /** 手指移動超過這個距離才算「滑動」，否則是「點一下」 */
  tapSlop: 10,
};

/** 把角度換算到 -π ~ π */
export const wrapAngle = (a: number) => {
  const T = Math.PI * 2;
  return ((((a + Math.PI) % T) + T) % T) - Math.PI;
};

/** 介面只需要知道「目前是不是偏離正面」，用來顯示「切回視角」按鈕 */
export const useViewStore = create<{ offFront: boolean; requestReset: () => void }>(() => ({
  offFront: false,
  requestReset: () => {
    viewRuntime.resetting = true;
    viewRuntime.vel = 0;
  },
}));

export function syncOffFront() {
  const off = Math.abs(wrapAngle(viewRuntime.yaw)) > 0.05 || Math.abs(viewRuntime.zoom - 1) > 0.03;
  if (off !== useViewStore.getState().offFront) useViewStore.setState({ offFront: off });
}
