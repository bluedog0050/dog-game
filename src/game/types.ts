import type { StatKey } from '../data/balance';

export type Stats = Record<StatKey, number>;

/** 寵物目前正在做的事（決定播放哪段動畫） */
export type Activity =
  | 'idle'
  | 'eating'
  | 'playing'
  | 'petHead' // 瞇眼歪頭
  | 'jump' // 原地跳躍
  | 'jumpSpin' // 跳高並在空中轉一圈
  | 'nuzzle' // 蹭蹭
  | 'chaseTail' // 追尾巴轉圈
  | 'playBow' // 伸懶腰
  | 'medicine'
  | 'refuse'
  | 'shake';

export type BathStage = 'wash' | 'dry';

/** 被摸時的隨機動作 */
export type PetMove = 'petHead' | 'jump' | 'nuzzle' | 'chaseTail' | 'playBow';

export interface PetState {
  stats: Stats;
  sleeping: boolean;
  sick: boolean;
  sulking: boolean;
  /** 鬧脾氣時已經摸了幾下 */
  sulkPets: number;
  /** 各數值連續歸零的秒數（判斷生病／鬧脾氣用） */
  zeroFor: { hunger: number; cleanliness: number; happiness: number };
  activity: Activity;
  /** 目前動作剩餘秒數 */
  activityLeft: number;
  /** 動作開始的遊戲時間（秒），讓 3D 動畫知道進度 */
  activityStartedAt: number;
  /** 洗澡流程進行中（搓泡泡 → 吹乾，完成前不能做其他事） */
  bathing: boolean;
  bathStage: BathStage;
  /** 已搓泡泡秒數 */
  washTime: number;
  /** 已吹乾秒數 */
  dryTime: number;
  /** 瞄準模式：等玩家點畫面丟球 */
  aiming: boolean;
  /** 球的落點（丟球動作進行中才有） */
  ballTarget: { x: number; z: number } | null;
  /** 上一次被摸時做的動作（避免連續重複） */
  lastPetMove: PetMove | null;
  /** 遊戲內經過的總秒數 */
  time: number;
}

export type IssueKey =
  | 'sick'
  | 'sulking'
  | 'hungry'
  | 'tired'
  | 'dirty'
  | 'bored'
  | 'sleeping';
