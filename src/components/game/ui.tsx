import { ReactNode, useEffect } from 'react';
import { Coins, Gem, X, Star, Package } from 'lucide-react';
import { audio } from '@/game/audio';
import { RARITY_COLOR, Rarity, Reward, CHESTS, itemById, xpForLevel } from '@/game/data';
import { Save } from '@/game/store';

export const fmt = (n: number) => (n >= 100000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString());

export function GameButton({ children, onClick, variant = 'primary', className = '', disabled, size = 'md', ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'pink' | 'gold' | 'dark'; className?: string; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; ariaLabel?: string;
}) {
  const sz = size === 'lg' ? 'h-16 px-8 text-2xl' : size === 'sm' ? 'h-9 px-3 text-sm' : 'h-12 px-5 text-lg';
  return (
    <button
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => { audio.play('click'); onClick?.(); }}
      className={`btn-bounce btn-${variant} font-display font-bold rounded-2xl inline-flex items-center justify-center gap-2 uppercase tracking-wide ${sz} disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, label, className = '', badge }: { children: ReactNode; onClick: () => void; label: string; className?: string; badge?: number }) {
  return (
    <button aria-label={label} onClick={() => { audio.play('click'); onClick(); }} className={`relative btn-bounce glass rounded-2xl w-11 h-11 flex items-center justify-center text-white ${className}`}>
      {children}
      {!!badge && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF2E9E] text-[11px] font-bold flex items-center justify-center pulse-glow">{badge}</span>}
    </button>
  );
}

export function CurrencyPill({ kind, value, onClick }: { kind: 'coins' | 'gems'; value: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="glass btn-bounce rounded-full pl-1 pr-3 h-9 flex items-center gap-1.5" aria-label={`${value} ${kind}`}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center ${kind === 'coins' ? 'bg-gradient-to-b from-[#ffd24a] to-[#ff9f00]' : 'bg-gradient-to-b from-[#ff6fc0] to-[#c0107a]'}`}>
        {kind === 'coins' ? <Coins className="w-4 h-4 text-[#5a3300]" /> : <Gem className="w-4 h-4 text-white" />}
      </span>
      <span className="font-display font-bold text-white text-base tabular-nums">{fmt(value)}</span>
    </button>
  );
}

export function XpBadge({ save }: { save: Save }) {
  const need = xpForLevel(save.playerLevel);
  const pct = Math.min(100, (save.xp / need) * 100);
  return (
    <div className="flex items-center gap-2 glass rounded-full pl-1 pr-3 h-9" aria-label={`Level ${save.playerLevel}`}>
      <span className="w-7 h-7 rounded-full bg-gradient-to-b from-[#3ff6ff] to-[#0090b0] font-display font-bold text-[#04121c] text-sm flex items-center justify-center">{save.playerLevel}</span>
      <div className="w-14 sm:w-20 h-2 rounded-full bg-black/40 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#00F0FF] to-[#7df9ff] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm safe-top safe-bottom" role="dialog" aria-modal="true">
      <div className={`glass rounded-3xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} max-h-[88vh] flex flex-col pop-in`}>
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-display font-bold text-2xl text-white">{title}</h2>
            {onClose && <button aria-label="Close" onClick={() => { audio.play('click'); onClose(); }} className="btn-bounce w-9 h-9 rounded-xl btn-dark flex items-center justify-center"><X className="w-5 h-5" /></button>}
          </div>
        )}
        <div className="px-5 pb-5 scroll-y no-scrollbar">{children}</div>
      </div>
    </div>
  );
}

export function RarityTag({ r }: { r: Rarity }) {
  return <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: RARITY_COLOR[r] + '33', color: RARITY_COLOR[r] }}>{r}</span>;
}

export function RewardChips({ r }: { r: Reward }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {!!r.coins && <span className="flex items-center gap-1 text-[#FFB800] font-display font-bold"><Coins className="w-4 h-4" />{fmt(r.coins)}</span>}
      {!!r.gems && <span className="flex items-center gap-1 text-[#FF2E9E] font-display font-bold"><Gem className="w-4 h-4" />{r.gems}</span>}
      {r.chest && <span className="flex items-center gap-1 font-display font-bold" style={{ color: CHESTS[r.chest].color }}><Package className="w-4 h-4" />{CHESTS[r.chest].name}</span>}
      {r.item && (() => { const it = itemById(r.item); return it ? <span className="flex items-center gap-1 font-display font-bold" style={{ color: RARITY_COLOR[it.rarity] }}><Star className="w-4 h-4" />{it.name}</span> : null; })()}
    </div>
  );
}

export function Progress({ value, max, color = '#00F0FF' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: `linear-gradient(90deg, ${color}, #ffffff)` }} />
    </div>
  );
}

export function ScreenTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="font-display font-bold text-3xl sm:text-4xl text-white drop-shadow">{children}</h1>
      {sub && <p className="text-[#a9b3d9] text-base">{sub}</p>}
    </div>
  );
}

export function useCountdown(msFn: () => number) {
  // simple re-render every second handled by caller via useNow
  return msFn();
}
export const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
};
