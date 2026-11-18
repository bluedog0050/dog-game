# CLAUDE.md

給 Claude Code 的專案說明。使用者以繁體中文溝通，commit 訊息、註解、介面文字也都用繁體中文。

## 專案是什麼

「狐狸犬電子寵物」：手機網頁 3D 電子寵物。白色狐狸犬是 low-poly 程式建模，沒有外部模型檔，預設名字是 YUKI。
玩法、數值和互動規則寫在 `README.md`，**修改玩法或數值時要同步更新 README**。

## 指令

```bash
npm install
npm run dev      # vite --host，手機連同網段可測試
npm test         # vitest run（tests/pet.test.ts）
npm run build    # tsc -b && vite build → dist/
```

- 改完要跑 `npm test` 和 `npx tsc -b`。tsconfig 開了 `strict`、`noUnusedLocals`、`noUnusedParameters`，沒用到的變數會讓 build 失敗。
- 推送到 `main` 後，`.github/workflows/deploy.yml` 會跑 `npm ci` → 測試 → build，然後發布到 GitHub Pages。
- `vite.config.ts` 設了 `base: './'`，因為網站放在子路徑 `/dog-game/`，資源路徑要用相對路徑。
- 網址加上 `?debug`，可以在 console 用 `__game`（就是 zustand store）直接操作狀態。

## 技術

React 18 + TypeScript + Vite 5、three.js + @react-three/fiber（沒有用 drei）、zustand、vitest。音效用 Web Audio 即時合成，沒有音檔。

## 架構（`src/`）

- `data/balance.ts`：**所有數值平衡都在這裡**（衰減時間 `SECONDS_TO_EMPTY`、各動作加多少、生病和鬧脾氣的門檻、收服機率等）。調整手感只改這個檔
- `data/messages.ts`：台詞
- `game/`：**純遊戲邏輯**，不依賴 React 和 three，可以單獨測試
  - `types.ts`：`PetState`、`Activity`（決定播放哪段動畫）、`BathStage` 等型別
  - `pet.ts`：`createPet`、`tick`、`feed`、`throwBall`、`petPet`、`toggleSleep`、`giveMedicine`、`startBath`/`bathTouch`、`throwCapture`、`canDo` 等。都是 `(state, ...) → 新 state` 的純函式
  - `fetch.ts`、`capture.ts`：玩球撿球、寶可夢球收服的時間軸（`fetchTimeline`、`captureTimeline`）
- `store/useGameStore.ts`：zustand 全域狀態，包住 `game/` 的函式，處理 toast、飄字、愛心特效、音效、存檔
- `hooks/useGameLoop.ts`：每 0.1 秒呼叫 `step(dt)`，單次最多推進 0.5 秒。切到背景時暫停，離開超過 `offlineResetSeconds` 會重置數值
- `persistence/storage.ts`：localStorage（key `dog-game-save`，有 `VERSION` 和遷移邏輯）。**只存名字和音效設定**，寵物數值每次開啟都從 50 開始
- `scene/`：3D
  - `PetScene.tsx` 是 Canvas 根，另外有 `Room`、`Pet`（模型和動畫）、`Effects`、`BathEffects`、`CaptureEffects`
  - `GestureController.tsx`：單指旋轉（有慣性）、雙指縮放、點擊判定
  - `BathController.tsx`：洗澡時的觸控
  - `petRuntime.ts`、`viewRuntime.ts`：**每幀更新的共享可變資料**（位置、嘴巴和頭頂座標、hit targets、旋轉角度和縮放等）。刻意不放進 React 或 zustand，避免每幀 re-render
  - `materials.ts`：共用材質
- `ui/`：2D 介面（`TopBar` 數值列和改名、`ActionBar` 動作按鈕、`CaptureButton`、`SpeechBubble`、`Overlays`）
- `audio/sfx.ts`：合成音效

## 開發慣例

- 新玩法的規則和狀態轉換寫在 `game/`，並在 `tests/pet.test.ts` 加測試；數值放 `data/balance.ts`；`store` 負責串接；`scene/`、`ui/` 只負責顯示和輸入
- 每幀會變的 3D 資料放在 `petRuntime`／`viewRuntime`，不要用 React state
- 主要目標是手機觸控，修改互動時要考慮觸控手勢，不能只考慮滑鼠
- `public/` 放 PWA 圖示和 `manifest.webmanifest`
