// 只需要保存名字與設定；寵物數值每次開啟都從 50 開始。
const KEY = 'dog-game-save';
const VERSION = 2;
export const DEFAULT_NAME = 'YUKI';

export interface SaveData {
  version: number;
  name: string;
  sound: boolean;
}

const DEFAULTS: SaveData = { version: VERSION, name: DEFAULT_NAME, sound: true };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw) as Partial<SaveData>;
    // 存檔遷移：v1 的預設名字是「小白」，沒改過名的話換成新預設「YUKI」
    if ((data.version ?? 1) < 2 && data.name === '小白') data.name = DEFAULT_NAME;
    return { ...DEFAULTS, ...data, version: VERSION };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSave(data: Omit<SaveData, 'version'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
  } catch {
    // 私密瀏覽等情況可能無法寫入，忽略即可
  }
}
