// 丟球撿球的時間軸：遊戲邏輯（決定動作多長）與 3D 動畫共用同一份計算。

export interface Point {
  x: number;
  z: number;
}

export const FETCH = {
  /** 球從手上飛到落點的秒數（依距離變長） */
  flightBase: 0.55,
  flightPerUnit: 0.12,
  /** 寵物在球丟出後多久開始跑 */
  reactDelay: 0.35,
  /** 跑步速度（每秒單位） */
  speed: 2.2,
  /** 停在球前多遠 */
  stopShort: 0.32,
  /** 叼球時間 */
  grab: 0.4,
  /** 轉身時間 */
  turn: 0.3,
  /** 回來後開心跳的時間 */
  celebrate: 0.8,
  /** 丟球的出手點（畫面前方、玩家的手） */
  origin: { x: 0, y: 1.5, z: 3.4 },
};

export interface FetchTimeline {
  target: Point;
  /** 寵物要停下來的點 */
  stop: Point;
  /** 球落地 */
  land: number;
  runStart: number;
  /** 抵達球旁邊 */
  arrive: number;
  grabEnd: number;
  /** 開始往回跑 */
  returnStart: number;
  /** 回到原位 */
  home: number;
  total: number;
}

/** 寵物從 home 出發去撿 target 的球 */
export function fetchTimeline(target: Point, home: Point = { x: 0, z: 0 }): FetchTimeline {
  const dx = target.x - home.x;
  const dz = target.z - home.z;
  const dist = Math.hypot(dx, dz);
  const runDist = Math.max(0, dist - FETCH.stopShort);
  const k = dist > 0 ? runDist / dist : 0;
  const stop = { x: home.x + dx * k, z: home.z + dz * k };

  const throwDist = Math.hypot(target.x - FETCH.origin.x, target.z - FETCH.origin.z);
  const land = FETCH.flightBase + throwDist * FETCH.flightPerUnit;
  const runTime = runDist / FETCH.speed;
  const runStart = FETCH.reactDelay;
  // 不會比球早到
  const arrive = Math.max(runStart + runTime, land + 0.15);
  const grabEnd = arrive + FETCH.grab;
  const returnStart = grabEnd + FETCH.turn;
  const home_ = returnStart + runTime;
  return {
    target,
    stop,
    land,
    runStart,
    arrive,
    grabEnd,
    returnStart,
    home: home_,
    total: home_ + FETCH.celebrate,
  };
}
