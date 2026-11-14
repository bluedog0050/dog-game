import type { StatKey } from '../data/balance';

export type Stats = Record<StatKey, number>;

/** 寵物目前正在做的事（決定播放哪段動畫） */
export type Activity =
  | 'idle'
  | 'eating'
  | 'playing'
  | 'petHead'
  | 'petBody'
  | 'medicine'
  | 'refuse';

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
  /** 洗澡模式 */
  bathing: boolean;
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
