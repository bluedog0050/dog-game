import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getIssues } from '../game/pet';
import { ACTIVITY_LINES, HAPPY_LINES, ISSUE_INFO } from '../data/messages';
import { BALANCE } from '../data/balance';
import { captureTimeline } from '../game/capture';
import type { PetState } from '../game/types';

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/** 寶可夢球每個階段的台詞（依已經過的時間判斷） */
function captureLine(pet: PetState): string {
  const cap = pet.capture!;
  if (!cap.hit) return '沒丟中～再試一次！';
  const tl = captureTimeline(cap.escapeAfter);
  const at = tl.total - pet.activityLeft;
  if (at < tl.hitAt) return '咦？那是什麼？';
  if (at < tl.landed) return '哇啊啊——';
  if (tl.breakAt !== null && at >= tl.breakAt) return '哼！才不會被抓住！';
  if (tl.releaseAt !== null && at >= tl.releaseAt) return '我回來了！';
  if (tl.successAt !== null && at >= tl.successAt) return '✨ 收服成功！';
  const shaken = tl.shakes.filter((s0) => at >= s0).length;
  return ['……', '搖…', '搖…搖…', '搖…搖…搖…'][shaken];
}

/** 寵物下方的狀態泡泡：顯示最急的事，旁邊用小圖示列出其他問題 */
export function SpeechBubble() {
  const pet = useGameStore((s) => s.pet);
  const issues = getIssues(pet);
  const top = issues[0];
  const busy = pet.activityLeft > 0 ? pet.activity : null;

  // 每 6 秒換一句，或狀態改變時換
  const [rot, setRot] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRot((r) => r + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const key = pet.bathing ? 'bath' : pet.aiming ? 'aim' : busy && ACTIVITY_LINES[busy] ? `act:${busy}` : top ?? 'happy';
  const text = useMemo(() => {
    if (key === 'bath' || key === 'aim') return '';
    if (key.startsWith('act:')) return ACTIVITY_LINES[key.slice(4)]!;
    if (key === 'happy') return pick(HAPPY_LINES);
    return pick(ISSUE_INFO[top!].lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rot]);

  let line = text;
  if (pet.bathing) {
    const B = BALANCE.bath;
    if (pet.bathStage === 'wash') {
      const pct = Math.floor((pet.washTime / B.washSeconds) * 100);
      line = pct === 0 ? '用手指在我身上搓泡泡～' : `搓泡泡中… ${pct}%`;
    } else {
      const pct = Math.floor((pet.dryTime / B.drySeconds) * 100);
      line = pct === 0 ? '濕答答的…按住我吹乾' : `吹乾中… ${pct}%`;
    }
  } else if (pet.capture && pet.activityLeft > 0) {
    line = captureLine(pet);
  } else if (pet.aiming && pet.aimKind === 'capture') {
    line = '要收服我嗎？（點我丟寶可夢球）';
  } else if (pet.aiming) {
    line = '快丟！快丟！（點畫面丟球）';
  } else if (key === 'sulking') {
    line = `${text}（再摸 ${BALANCE.sulk.petsToForgive - pet.sulkPets} 下）`;
  }

  const capturing = !!pet.capture && pet.activityLeft > 0;
  const icon = pet.bathing ? (pet.bathStage === 'wash' ? '🫧' : '💨') : capturing ? '' : pet.aiming ? (pet.aimKind === 'capture' ? '🔴' : '🎾') : key.startsWith('act:') || key === 'happy' ? '' : ISSUE_INFO[top!].icon;
  const others = issues.slice(1).filter((k) => k !== 'sleeping');
  const tone = top === 'sick' ? 'danger' : top === 'sulking' ? 'warn' : top && top !== 'sleeping' ? 'need' : 'ok';

  return (
    <div className={`bubble-wrap`}>
      <div key={line} className={`bubble tone-${tone}`}>
        {icon && <span className="bubble-icon">{icon}</span>}
        <span>{line}</span>
      </div>
      {others.length > 0 && !pet.bathing && !pet.aiming && !capturing && (
        <div className="other-issues" aria-label="其他需要照顧的事">
          {others.map((k) => (
            <span key={k} className="issue-chip">{ISSUE_INFO[k].icon}</span>
          ))}
        </div>
      )}
    </div>
  );
}
