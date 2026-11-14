import { useGameStore } from '../store/useGameStore';
import { canDo, type ActionKey } from '../game/pet';

export function ActionBar() {
  const pet = useGameStore((s) => s.pet);
  const doAction = useGameStore((s) => s.doAction);

  const buttons: { key: ActionKey; icon: string; label: string }[] = [
    { key: 'feed', icon: '🍖', label: '餵食' },
    { key: 'play', icon: '🎾', label: '玩球' },
    { key: 'bath', icon: pet.bathing ? '✅' : '🛁', label: pet.bathing ? '洗好了' : '洗澡' },
    { key: 'sleep', icon: pet.sleeping ? '☀️' : '💤', label: pet.sleeping ? '叫醒' : '睡覺' },
    { key: 'medicine', icon: '💊', label: '餵藥' },
  ];

  return (
    <nav className="actionbar">
      {buttons.map((b) => {
        const special = (b.key === 'sleep' && pet.sleeping) || (b.key === 'bath' && pet.bathing);
        const disabled = !special && canDo(pet, b.key) !== null;
        const urgent = b.key === 'medicine' && pet.sick;
        return (
          <button
            key={b.key}
            className={`action${disabled ? ' dim' : ''}${urgent ? ' urgent' : ''}${special ? ' active' : ''}`}
            onClick={() => doAction(b.key)}
          >
            <span className="action-icon">{b.icon}</span>
            <span className="action-label">{b.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
