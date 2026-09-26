import { useState } from 'react';
import { Package, Coins, Gem } from 'lucide-react';
import { CHESTS, ChestKind, RARITY_COLOR } from '@/game/data';
import { ChestResult, openChest } from '@/game/store';
import { audio, haptic } from '@/game/audio';
import { GameButton, Modal, RarityTag } from './ui';

export default function ChestOpen({ kind, onClose }: { kind: ChestKind | null; onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'open'>('idle');
  const [res, setRes] = useState<ChestResult | null>(null);
  if (!kind) return null;
  const def = CHESTS[kind];
  const start = () => {
    setPhase('shaking'); audio.play('tick');
    let n = 0;
    const iv = window.setInterval(() => { audio.play('tick'); haptic(8); if (++n > 6) clearInterval(iv); }, 150);
    window.setTimeout(() => {
      const r = openChest(kind);
      setRes(r); setPhase('open'); audio.play('chest'); haptic([20, 30, 60]);
    }, 1200);
  };
  const close = () => { setPhase('idle'); setRes(null); onClose(); };
  const color = res?.item && !res.duplicate ? RARITY_COLOR[res.item.rarity] : def.color;
  return (
    <Modal open={!!kind} onClose={phase === 'shaking' ? undefined : close} title={def.name}>
      <div className="flex flex-col items-center py-2">
        <div className="relative w-52 h-52 flex items-center justify-center">
          {phase === 'open' && <div className="absolute inset-0 rays" />}
          <div className={`relative w-32 h-32 rounded-3xl flex items-center justify-center ${phase === 'shaking' ? 'wobble' : phase === 'open' ? 'pop-in' : ''}`}
            style={{ background: `linear-gradient(160deg, ${color}, #12162B)`, boxShadow: `0 0 50px ${color}99, inset 0 2px 0 rgba(255,255,255,0.3)` }}>
            <Package className="w-16 h-16 text-white drop-shadow-lg" />
          </div>
        </div>
        {phase === 'open' && res ? (
          <div className="text-center slide-up">
            {res.item && !res.duplicate ? (
              <>
                <div className="text-sm uppercase tracking-widest text-[#a9b3d9]">New item</div>
                <div className="font-display font-bold text-3xl" style={{ color }}>{res.item.name}</div>
                <div className="my-1"><RarityTag r={res.item.rarity} /></div>
              </>
            ) : <div className="font-display text-xl text-white">Duplicate converted to bonus coins</div>}
            <div className="flex justify-center gap-4 mt-2 font-display font-bold text-lg">
              <span className="flex items-center gap-1 text-[#FFB800]"><Coins className="w-5 h-5" />+{res.coins}</span>
              {res.gems > 0 && <span className="flex items-center gap-1 text-[#FF2E9E]"><Gem className="w-5 h-5" />+{res.gems}</span>}
            </div>
            <GameButton className="mt-4 w-48" onClick={close}>Awesome</GameButton>
          </div>
        ) : (
          <GameButton size="lg" className="mt-2 w-56" disabled={phase !== 'idle'} onClick={start}>{phase === 'shaking' ? 'Opening...' : 'Open'}</GameButton>
        )}
      </div>
    </Modal>
  );
}
