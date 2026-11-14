import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { BALANCE, type StatKey } from '../data/balance';
import { useViewStore } from '../scene/viewRuntime';

const STATS: { key: StatKey; icon: string; label: string; color: string }[] = [
  { key: 'hunger', icon: '🍖', label: '飽食', color: 'var(--c-hunger)' },
  { key: 'happiness', icon: '💗', label: '快樂', color: 'var(--c-happy)' },
  { key: 'energy', icon: '⚡', label: '體力', color: 'var(--c-energy)' },
  { key: 'cleanliness', icon: '🫧', label: '清潔', color: 'var(--c-clean)' },
];

function NameEditor() {
  const name = useGameStore((s) => s.name);
  const setName = useGameStore((s) => s.setName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    setName(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        className="name-form"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          ref={input}
          className="name-input"
          value={draft}
          maxLength={10}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          enterKeyHint="done"
          aria-label="寵物名字"
        />
      </form>
    );
  }
  return (
    <button
      className="name-btn"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      aria-label="編輯名字"
    >
      <span className="name-text">{name}</span>
      <span className="name-pen">✎</span>
    </button>
  );
}

export function TopBar() {
  const stats = useGameStore((s) => s.pet.stats);
  const sound = useGameStore((s) => s.sound);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const offFront = useViewStore((s) => s.offFront);
  const requestReset = useViewStore((s) => s.requestReset);

  return (
    <header className="topbar">
      <div className="topbar-row">
        <span className="paw">🐾</span>
        <NameEditor />
        {offFront && (
          <button className="reset-view" onClick={requestReset}>
            <span aria-hidden>⟲</span> 切回視角
          </button>
        )}
        <button className="icon-btn" onClick={toggleSound} aria-label={sound ? '關閉音效' : '開啟音效'}>
          {sound ? '🔊' : '🔇'}
        </button>
      </div>
      <div className="stats">
        {STATS.map((st) => {
          const v = stats[st.key];
          const low = v < BALANCE.lowThreshold;
          const zero = v <= 0;
          return (
            <div key={st.key} className={`stat${low ? ' low' : ''}${zero ? ' zero' : ''}`}>
              <span className="stat-icon" aria-hidden>{st.icon}</span>
              <span className="stat-label">{st.label}</span>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${v}%`, background: low ? 'var(--c-danger)' : st.color }} />
              </div>
              <span className="stat-num">{Math.ceil(v)}</span>
            </div>
          );
        })}
      </div>
    </header>
  );
}
