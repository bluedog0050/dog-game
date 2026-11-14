// 所有遊戲數值集中在這裡，方便調整手感。

export type StatKey = 'hunger' | 'happiness' | 'energy' | 'cleanliness';

/** 每項數值從 100 掉到 0 所需秒數（彼此錯開，避免同時崩潰） */
export const SECONDS_TO_EMPTY: Record<StatKey, number> = {
  happiness: 90,
  hunger: 180,
  energy: 270,
  cleanliness: 360,
};

export const DECAY_PER_SEC: Record<StatKey, number> = {
  happiness: 100 / SECONDS_TO_EMPTY.happiness,
  hunger: 100 / SECONDS_TO_EMPTY.hunger,
  energy: 100 / SECONDS_TO_EMPTY.energy,
  cleanliness: 100 / SECONDS_TO_EMPTY.cleanliness,
};

export const BALANCE = {
  /** 每次開啟或離線回來時的起始數值 */
  startValue: 50,
  /** 切到背景超過幾秒就視為「離線重開」 */
  offlineResetSeconds: 10,
  /** 低於此值，狀態條變紅 */
  lowThreshold: 20,

  feed: { hunger: 50, duration: 2.4 },
  play: { happiness: 40, energy: -10 },
  pet: { happiness: 8, duration: 1.2 },
  bath: {
    /** 手指在寵物身上搓泡泡的累計秒數 */
    washSeconds: 3,
    /** 手指按住寵物吹乾的累計秒數 */
    drySeconds: 5,
    /** 洗完的快樂獎勵 */
    happinessBonus: 10,
    /** 甩乾身體的動畫秒數 */
    shakeDuration: 1.1,
  },
  medicine: { duration: 2.0 },

  sleep: {
    energyPerSec: 10,
    /** 睡覺時其他數值的下降倍率 */
    otherDecayMultiplier: 0.5,
    /** 被叫醒時快樂扣多少 */
    wakeHappinessPenalty: 10,
  },

  sulk: {
    /** 快樂歸零幾秒後開始鬧脾氣 */
    triggerAfter: 3,
    /** 需要摸幾下才會原諒你 */
    petsToForgive: 5,
    /** 原諒後快樂回到多少 */
    forgiveHappiness: 30,
  },

  sick: {
    /** 飽食或清潔歸零幾秒後生病 */
    triggerAfter: 10,
  },

  /** 丟球：球可以落地的範圍（房間地板） */
  ballArea: { minX: -3.1, maxX: 3.1, minZ: -2.6, maxZ: 2.4 },
  /** 球距離寵物至少這麼遠 */
  ballMinDistance: 0.6,

  /** 不能玩耍的最低體力 */
  minEnergyToPlay: 5,
} as const;
