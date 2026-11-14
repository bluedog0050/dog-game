import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getIssues } from '../game/pet';
import { ACTIVITY_LINES, HAPPY_LINES, ISSUE_INFO } from '../data/messages';
import { BALANCE } from '../data/balance';

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

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

  const key = pet.bathing ? 'bath' : busy && ACTIVITY_LINES[busy] ? `act:${busy}` : top ?? 'happy';
  const text = useMemo(() => {
    if (key === 'bath') return '';
    if (key.startsWith('act:')) return ACTIVITY_LINES[key.slice(4)]!;
    if (key === 'happy') return pick(HAPPY_LINES);
    return pick(ISSUE_INFO[top!].lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rot]);

  let line = text;
  if (pet.bathing) {
    line = `搓搓搓～ ${Math.floor(pet.stats.cleanliness)}%`;
  } else if (key === 'sulking') {
    line = `${text}（再摸 ${BALANCE.sulk.petsToForgive - pet.sulkPets} 下）`;
  }

  const icon = pet.bathing ? '🧼' : key.startsWith('act:') || key === 'happy' ? '' : ISSUE_INFO[top!].icon;
  const others = issues.slice(1).filter((k) => k !== 'sleeping');
  const tone = top === 'sick' ? 'danger' : top === 'sulking' ? 'warn' : top && top !== 'sleeping' ? 'need' : 'ok';

  return (
    <div className={`bubble-wrap`}>
      <div key={line} className={`bubble tone-${tone}`}>
        {icon && <span className="bubble-icon">{icon}</span>}
        <span>{line}</span>
      </div>
      {others.length > 0 && !pet.bathing && (
        <div className="other-issues" aria-label="其他需要照顧的事">
          {others.map((k) => (
            <span key={k} className="issue-chip">{ISSUE_INFO[k].icon}</span>
          ))}
        </div>
      )}
    </div>
  );
}
