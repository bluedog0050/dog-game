// 只需要保存名字與設定；寵物數值每次開啟都從 50 開始。
const KEY = 'dog-game-save';
const VERSION = 1;

export interface SaveData {
  version: number;
  name: string;
  sound: boolean;
}

const DEFAULTS: SaveData = { version: VERSION, name: '小白', sound: true };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw) as Partial<SaveData>;
    // 之後若改存檔結構，在這裡依 data.version 做遷移
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
