import type { IssueKey } from '../game/types';

export const ISSUE_INFO: Record<IssueKey, { icon: string; lines: string[] }> = {
  sick: { icon: '💊', lines: ['我不舒服…想吃藥', '頭暈暈的…', '嗚…好難受'] },
  sulking: { icon: '😤', lines: ['哼！不理你了', '我生氣了！', '哼哼！'] },
  sleeping: { icon: '💤', lines: ['呼…呼…', 'Zzz…', '（睡得很香）'] },
  hungry: { icon: '🍖', lines: ['肚子好餓…', '想吃飯飯…', '咕嚕咕嚕…'] },
  tired: { icon: '🥱', lines: ['好睏喔…', '眼睛快閉上了…', '想睡覺…'] },
  dirty: { icon: '🫧', lines: ['身上癢癢的…', '我想洗澎澎', '好像有點臭臭的…'] },
  bored: { icon: '🎾', lines: ['陪我玩嘛～', '好無聊喔…', '來玩球好不好？'] },
};

export const HAPPY_LINES = [
  '今天好開心！',
  '最喜歡你了！',
  '汪！',
  '嘿嘿～',
  '尾巴停不下來～',
  '要不要一起玩？',
];

export const ACTIVITY_LINES: Partial<Record<string, string>> = {
  eating: '好好吃！嚼嚼嚼～',
  playing: '球球！我去撿！',
  petHead: '好舒服～',
  jump: '跳跳！',
  jumpSpin: '看我轉一圈！',
  nuzzle: '蹭蹭～',
  chaseTail: '尾巴別跑！',
  playBow: '來玩嘛來玩嘛！',
  medicine: '苦苦的…但好多了',
};
