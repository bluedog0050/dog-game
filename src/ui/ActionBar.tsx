import { useGameStore } from '../store/useGameStore';
import { canDo, type ActionKey } from '../game/pet';

export function ActionBar() {
  const pet = useGameStore((s) => s.pet);
  const doAction = useGameStore((s) => s.doAction);

  const buttons: { key: ActionKey; icon: string; label: string }[] = [
    { key: 'feed', icon: '🍖', label: '餵食' },
    { key: 'play', icon: pet.aiming ? '✖️' : '🎾', label: pet.aiming ? '取消' : '玩球' },
    {
      key: 'bath',
      icon: !pet.bathing ? '🛁' : pet.bathStage === 'wash' ? '🫧' : '💨',
      label: !pet.bathing ? '洗澡' : pet.bathStage === 'wash' ? '搓泡泡' : '吹乾',
    },
    { key: 'sleep', icon: pet.sleeping ? '☀️' : '💤', label: pet.sleeping ? '叫醒' : '睡覺' },
    { key: 'medicine', icon: '💊', label: '餵藥' },
  ];

  return (
    <nav className="actionbar">
      {buttons.map((b) => {
        const special =
          (b.key === 'sleep' && pet.sleeping) || (b.key === 'bath' && pet.bathing) || (b.key === 'play' && pet.aiming);
        const disabled = !special && canDo(pet, b.key) !== null;
        const urgent = b.key === 'medicine' && pet.sick;
        // 換到吹乾階段、還沒開始吹之前，按鈕輕輕彈跳提示
        const bounce = b.key === 'bath' && pet.bathing && pet.bathStage === 'dry' && pet.dryTime === 0;
        return (
          <button
            key={b.key}
            className={`action${disabled ? ' dim' : ''}${urgent ? ' urgent' : ''}${special ? ' active' : ''}${bounce ? ' bounce' : ''}`}
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
