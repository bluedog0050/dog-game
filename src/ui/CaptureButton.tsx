import { useGameStore } from '../store/useGameStore';
import { canDo } from '../game/pet';

/** 右側的圓形浮動按鈕：寶可夢球（上紅下白，中間白色腳掌印） */
export function CaptureButton() {
  const pet = useGameStore((s) => s.pet);
  const doAction = useGameStore((s) => s.doAction);
  const aiming = pet.aiming && pet.aimKind === 'capture';
  const disabled = !aiming && canDo(pet, 'capture') !== null;

  return (
    <button
      className={`capture-btn${aiming ? ' aiming' : ''}${disabled ? ' dim' : ''}`}
      onClick={() => doAction('capture')}
      aria-label={aiming ? '取消收服' : '收服：丟出寶可夢球'}
    >
      <span className="capture-ball" aria-hidden>
        {aiming ? (
          <span className="capture-x">✕</span>
        ) : (
          <svg viewBox="0 0 24 24" className="capture-paw">
            <ellipse cx="12" cy="15" rx="4.6" ry="3.8" />
            <ellipse cx="6.6" cy="10.2" rx="1.7" ry="2.1" />
            <ellipse cx="10" cy="7.4" rx="1.7" ry="2.2" />
            <ellipse cx="14" cy="7.4" rx="1.7" ry="2.2" />
            <ellipse cx="17.4" cy="10.2" rx="1.7" ry="2.1" />
          </svg>
        )}
      </span>
      <span className="capture-label">{aiming ? '取消' : '寶可夢球'}</span>
    </button>
  );
}
