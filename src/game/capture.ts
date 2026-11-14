// 收服（寶可夢球）的時間軸：遊戲邏輯與 3D 動畫共用。

export const CAPTURE = {
  /** 丟中的機率之外：丟中後掙脫的機率 */
  escapeChance: 0.3,
  /** 球飛行秒數 */
  fly: 0.55,
  /** 球彈開、紅光把寵物吸進去 */
  absorb: 0.85,
  /** 球闔上落地、彈兩下 */
  drop: 0.7,
  /** 每次搖晃與搖晃之間的停頓 */
  shake: 0.4,
  pause: 0.5,
  /** 收服成功後幾秒自動釋放 */
  hold: 3,
  /** 釋放：煙霧中出現 */
  release: 1.0,
  /** 掙脫：球彈開、寵物跳出來甩頭 */
  escape: 1.2,
  /** 沒丟中：球落地滾一下後消失 */
  missRoll: 1.1,
  /** 點在寵物附近幾像素內也算丟中 */
  hitRadiusPx: 70,
};

export interface CaptureTimeline {
  hitAt: number;
  /** 寵物完全被吸進球裡 */
  inBallAt: number;
  landed: number;
  /** 每次搖晃開始的時間 */
  shakes: number[];
  /** 成功：閃亮特效 */
  successAt: number | null;
  /** 成功：釋放 */
  releaseAt: number | null;
  /** 失敗：球彈開 */
  breakAt: number | null;
  total: number;
}

/** escapeAfter：在第幾次搖晃後掙脫（null = 成功） */
export function captureTimeline(escapeAfter: 2 | 3 | null): CaptureTimeline {
  const C = CAPTURE;
  const hitAt = C.fly;
  const inBallAt = hitAt + C.absorb;
  const landed = inBallAt + C.drop;
  const count = escapeAfter ?? 3;
  const shakes = Array.from({ length: count }, (_, i) => landed + C.pause * 0.6 + i * (C.shake + C.pause));
  const lastShakeEnd = shakes[count - 1] + C.shake;
  if (escapeAfter) {
    const breakAt = lastShakeEnd + 0.25;
    return { hitAt, inBallAt, landed, shakes, successAt: null, releaseAt: null, breakAt, total: breakAt + C.escape };
  }
  const successAt = lastShakeEnd + 0.3;
  const releaseAt = successAt + C.hold;
  return { hitAt, inBallAt, landed, shakes, successAt, releaseAt, breakAt: null, total: releaseAt + C.release };
}

export const missDuration = () => CAPTURE.fly + CAPTURE.missRoll;
