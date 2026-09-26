import { useMemo, useRef, useState } from 'react';
import { Lock, Check, Coins, Gem, Palette, Sparkles, RotateCcw } from 'lucide-react';
import { ALL_ITEMS, CHARACTERS, COLORABLE, RARITY_COLOR, SLOT_LABEL, SWATCHES, Slot, Item, charById } from '@/game/data';
import { Save, buyItem, equipItem, setColor, isUnlockMet, unlockText } from '@/game/store';
import { QualityLevel } from '@/game/env';
import { audio } from '@/game/audio';
import PreviewCanvas, { PreviewHandle } from './PreviewCanvas';
import { GameButton, Modal, RarityTag, fmt } from './ui';

const SLOTS: Slot[] = ['character', 'top', 'pants', 'shoes', 'hat', 'mask', 'backpack', 'trail', 'emote', 'landing'];

export default function Locker({ save, quality }: { save: Save; quality: QualityLevel }) {
  const [slot, setSlot] = useState<Slot>('character');
  const [preview, setPreview] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pv = useRef<PreviewHandle>(null);
  const items = useMemo(() => ALL_ITEMS.filter((i) => i.slot === slot), [slot]);
  const look = useMemo(() => ({ equip: { ...save.equip, ...(preview ? { [slot]: preview } : {}) }, colors: save.colors }), [save.equip, save.colors, preview, slot]);
  const selected = ALL_ITEMS.find((i) => i.id === (preview || save.equip[slot]))!;
  const owned = save.owned.includes(selected.id);
  const equipped = save.equip[slot] === selected.id;
  const canUnlock = !owned && isUnlockMet(save, selected);

  const buy = () => {
    if (buyItem(selected.id)) {
      audio.play('claim'); equipItem(slot, selected.id); setPreview(null); setMsg(`${selected.name} unlocked!`);
      window.supercool?.track?.('item_unlocked', { item: selected.id, rarity: selected.rarity });
      if (slot === 'emote') pv.current?.emote();
    } else { audio.play('fail'); setMsg('Not enough currency yet. Keep running!'); }
    window.setTimeout(() => setMsg(null), 2200);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-6">
      <div className="relative lg:flex-1 h-[36vh] min-h-[220px] lg:h-full rounded-3xl overflow-hidden glass shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(0,240,255,0.18),transparent_65%)]" />
        <PreviewCanvas ref={pv} look={look} mode="locker" quality={quality} className="absolute inset-0" />
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          <div>
            <div className="font-display font-bold text-2xl text-white drop-shadow">{charById(look.equip.character).name}</div>
            <div className="text-sm text-[#a9b3d9] max-w-[200px]">{charById(look.equip.character).bio}</div>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button aria-label="Play emote" onClick={() => { audio.play('click'); pv.current?.emote(); }} className="btn-bounce glass rounded-xl w-10 h-10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-[#FFB800]" /></button>
          </div>
        </div>
        <div className="absolute bottom-2 inset-x-0 text-center text-[11px] text-white/50 pointer-events-none">Drag to rotate</div>
      </div>

      <div className="flex-1 lg:max-w-xl flex flex-col min-h-0">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 shrink-0">
          {SLOTS.map((s) => (
            <button key={s} onClick={() => { audio.play('click'); setSlot(s); setPreview(null); }}
              className={`btn-bounce shrink-0 px-3 h-9 rounded-xl font-display font-semibold text-sm ${slot === s ? 'btn-primary' : 'btn-dark'}`}>{SLOT_LABEL[s]}</button>
          ))}
        </div>

        <div className="glass rounded-2xl p-3 mb-2 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><span className="font-display font-bold text-lg text-white truncate">{selected.name}</span><RarityTag r={selected.rarity} /></div>
            <div className="text-xs text-[#a9b3d9] truncate">
              {owned ? (equipped ? 'Equipped' : 'Owned') : selected.coins ? `${fmt(selected.coins)} coins` : selected.gems ? `${selected.gems} gems` : unlockText(selected)}
            </div>
          </div>
          {COLORABLE.includes(slot) && owned && selected.style !== 'none' && (
            <button aria-label="Color picker" onClick={() => { audio.play('click'); setColorOpen(true); }} className="btn-bounce btn-dark rounded-xl w-10 h-10 flex items-center justify-center"><Palette className="w-5 h-5" style={{ color: save.colors[slot] || '#fff' }} /></button>
          )}
          {owned ? (
            <GameButton size="sm" disabled={equipped} onClick={() => { equipItem(slot, selected.id); setPreview(null); if (slot === 'emote') pv.current?.emote(); }}>{equipped ? <><Check className="w-4 h-4" />On</> : 'Equip'}</GameButton>
          ) : selected.coins ? (
            <GameButton size="sm" variant="gold" disabled={save.coins < selected.coins} onClick={buy}><Coins className="w-4 h-4" />{fmt(selected.coins)}</GameButton>
          ) : selected.gems ? (
            <GameButton size="sm" variant="pink" disabled={save.gems < selected.gems} onClick={buy}><Gem className="w-4 h-4" />{selected.gems}</GameButton>
          ) : (
            <GameButton size="sm" disabled={!canUnlock} onClick={buy}>{canUnlock ? 'Claim' : <Lock className="w-4 h-4" />}</GameButton>
          )}
        </div>
        {msg && <div className="text-center text-sm font-display text-[#FFB800] mb-2 pop-in">{msg}</div>}

        <div className="flex-1 min-h-0 scroll-y no-scrollbar pb-2">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {items.map((it) => <ItemCard key={it.id} it={it} save={save} active={(preview || save.equip[slot]) === it.id} equipped={save.equip[slot] === it.id}
              onClick={() => { audio.play('click'); setPreview(it.id === save.equip[slot] ? null : it.id); if (slot === 'emote') window.setTimeout(() => pv.current?.emote(), 50); }} />)}
          </div>
        </div>
      </div>

      <Modal open={colorOpen} onClose={() => setColorOpen(false)} title={`${SLOT_LABEL[slot]} color`}>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {SWATCHES.map((c) => (
            <button key={c} aria-label={`Color ${c}`} onClick={() => { audio.play('click'); setColor(slot, c); }}
              className={`btn-bounce aspect-square rounded-xl border-2 ${save.colors[slot] === c ? 'border-white scale-110' : 'border-white/10'}`} style={{ background: c }} />
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 glass rounded-xl p-3 mb-3">
          <span className="font-display text-white">Custom color</span>
          <input type="color" aria-label="Custom color" value={save.colors[slot] || '#ffffff'} onChange={(e) => setColor(slot, e.target.value)} className="w-12 h-9 bg-transparent rounded cursor-pointer" />
        </label>
        <GameButton variant="dark" className="w-full" onClick={() => setColor(slot, null)}><RotateCcw className="w-4 h-4" />Default color</GameButton>
      </Modal>
    </div>
  );
}

function ItemCard({ it, save, active, equipped, onClick }: { it: Item; save: Save; active: boolean; equipped: boolean; onClick: () => void }) {
  const owned = save.owned.includes(it.id);
  const c = RARITY_COLOR[it.rarity];
  const isChar = it.slot === 'character';
  const swatch = isChar ? CHARACTERS.find((x) => x.id === it.id)!.color : it.color;
  return (
    <button onClick={onClick} aria-label={it.name}
      className={`btn-bounce relative rounded-2xl p-2 flex flex-col items-center text-center ${active ? 'ring-2 ring-white' : ''}`}
      style={{ background: `linear-gradient(160deg, ${c}40, rgba(18,22,43,0.9) 65%)`, border: `2px solid ${c}${owned ? 'cc' : '55'}` }}>
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-1 relative" style={{ background: `radial-gradient(circle, ${swatch}55, transparent 70%)` }}>
        <ItemGlyph it={it} color={swatch} />
        {!owned && <span className="absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center"><Lock className="w-5 h-5 text-white/80" /></span>}
      </div>
      <div className="text-[12px] font-semibold text-white leading-tight line-clamp-2 min-h-[28px]">{it.name}</div>
      {equipped && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#2EE6A6] flex items-center justify-center"><Check className="w-3.5 h-3.5 text-[#04121c]" /></span>}
      {!owned && (it.coins || it.gems) ? (
        <div className="text-[11px] font-display font-bold flex items-center gap-0.5" style={{ color: it.coins ? '#FFB800' : '#FF2E9E' }}>
          {it.coins ? <Coins className="w-3 h-3" /> : <Gem className="w-3 h-3" />}{fmt(it.coins || it.gems || 0)}
        </div>
      ) : !owned ? <div className="text-[10px] text-[#a9b3d9] leading-tight">{unlockText(it)}</div> : <div className="text-[10px]" style={{ color: c }}>{it.rarity}</div>}
    </button>
  );
}

function ItemGlyph({ it, color }: { it: Item; color: string }) {
  if (it.slot === 'character') {
    const ch = CHARACTERS.find((x) => x.id === it.id)!;
    return (
      <svg viewBox="0 0 40 40" className="w-11 h-11" aria-hidden>
        <circle cx="20" cy="12" r="7" fill={ch.skin} />
        <path d="M13 11 a7 7 0 0 1 14 0 z" fill={ch.hair} />
        <rect x="12" y="19" width="16" height="13" rx="4" fill={ch.topColor} />
        <rect x="14" y="31" width="5" height="8" rx="2" fill={ch.pantsColor} />
        <rect x="21" y="31" width="5" height="8" rx="2" fill={ch.pantsColor} />
        <path d="M17 19 q3 3 6 0 l6 10" stroke={ch.scarf} strokeWidth="2.5" fill="none" />
      </svg>
    );
  }
  const shapes: Record<string, JSX.Element> = {
    top: <path d="M10 12 l6-4 h8 l6 4 l-3 6 h-2 v14 h-14 v-14 h-2 z" fill={color} />,
    pants: <path d="M12 8 h16 l2 26 h-6 l-4-16 l-4 16 h-6 z" fill={color} />,
    shoes: <path d="M6 24 h12 l6 4 h10 v6 h-28 z" fill={color} />,
    hat: <path d="M8 26 a12 12 0 0 1 24 0 z M6 26 h28 v3 h-28 z" fill={color} />,
    mask: <path d="M8 16 q12-8 24 0 v6 q-12 10-24 0 z" fill={color} />,
    backpack: <rect x="11" y="9" width="18" height="24" rx="5" fill={color} />,
    trail: <path d="M6 30 q10-4 14-12 t14-10" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />,
    emote: <path d="M20 6 l4 10 l10 1 l-8 7 l3 10 l-9-6 l-9 6 l3-10 l-8-7 l10-1 z" fill={color} />,
    landing: <g fill={color}><circle cx="20" cy="30" r="4" /><circle cx="10" cy="26" r="3" /><circle cx="30" cy="26" r="3" /><circle cx="14" cy="18" r="2" /><circle cx="26" cy="18" r="2" /></g>,
  };
  if (it.style === 'none') return <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden><circle cx="20" cy="20" r="11" stroke="#ffffff55" strokeWidth="3" fill="none" /><path d="M12 28 L28 12" stroke="#ffffff55" strokeWidth="3" /></svg>;
  return <svg viewBox="0 0 40 40" className="w-10 h-10" aria-hidden>{shapes[it.slot]}</svg>;
}
