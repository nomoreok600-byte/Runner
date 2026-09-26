import { useState } from 'react';
import { Package, Coins, Gem, Sparkles, ShoppingBag } from 'lucide-react';
import { CHESTS, ChestKind, GEM_TO_COIN_PACKS, ALL_ITEMS, RARITY_COLOR, todayKeyFree } from './shopData';
import { Save, buyChest, gemsToCoins, buyItem, mulberry32 } from '@/game/store';
import { audio } from '@/game/audio';
import { GameButton, RarityTag, fmt } from './ui';
import ChestOpen from './ChestOpen';

export default function Shop({ save }: { save: Save }) {
  const [opening, setOpening] = useState<ChestKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2200); };

  // daily featured offers (deterministic per day)
  const rng = mulberry32(todayKeyFree());
  const pool = ALL_ITEMS.filter((i) => (i.coins || i.gems) && !save.owned.includes(i.id));
  const featured = [...pool].sort(() => rng() - 0.5).slice(0, 4);

  return (
    <div className="h-full scroll-y no-scrollbar pb-4 max-w-4xl mx-auto w-full">
      {msg && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 glass rounded-2xl px-4 py-2 font-display text-[#FFB800] pop-in">{msg}</div>}
      <section className="mb-5">
        <h2 className="font-display font-bold text-2xl text-white mb-2 flex items-center gap-2"><Package className="w-6 h-6 text-[#B45CFF]" />Mystery Chests</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(CHESTS) as ChestKind[]).map((k) => {
            const c = CHESTS[k];
            const have = save.chests[k] || 0;
            return (
              <div key={k} className="glass rounded-3xl p-4 flex sm:flex-col items-center gap-3 text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-40" style={{ background: c.color }} />
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(160deg, ${c.color}, #12162B)`, boxShadow: `0 0 30px ${c.color}77` }}><Package className="w-10 h-10 text-white" /></div>
                <div className="flex-1 text-left sm:text-center">
                  <div className="font-display font-bold text-xl text-white">{c.name}</div>
                  <div className="text-xs text-[#a9b3d9]">Legendary {c.weights.Legendary}% · Epic {c.weights.Epic}%</div>
                  <div className="text-sm text-white mt-1">Owned: <span className="font-bold">{have}</span></div>
                </div>
                <div className="flex flex-col gap-2 w-32 sm:w-full">
                  <GameButton size="sm" disabled={have < 1} onClick={() => setOpening(k)}>Open</GameButton>
                  <GameButton size="sm" variant={c.coins ? 'gold' : 'pink'} disabled={c.coins ? save.coins < c.coins : save.gems < c.gems}
                    onClick={() => { if (buyChest(k)) { audio.play('claim'); flash(`${c.name} added`); window.supercool?.track?.('chest_bought', { chest: k }); } }}>
                    {c.coins ? <><Coins className="w-4 h-4" />{fmt(c.coins)}</> : <><Gem className="w-4 h-4" />{c.gems}</>}
                  </GameButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="font-display font-bold text-2xl text-white mb-2 flex items-center gap-2"><Sparkles className="w-6 h-6 text-[#FFB800]" />Today's Featured</h2>
        {featured.length === 0 ? <div className="glass rounded-2xl p-4 text-[#a9b3d9]">You own every store item. Legendary!</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featured.map((it) => (
              <div key={it.id} className="rounded-3xl p-3 flex flex-col items-center text-center" style={{ background: `linear-gradient(160deg, ${RARITY_COLOR[it.rarity]}44, rgba(18,22,43,0.92) 60%)`, border: `2px solid ${RARITY_COLOR[it.rarity]}99` }}>
                <div className="w-14 h-14 rounded-2xl mb-2 flex items-center justify-center" style={{ background: `radial-gradient(circle, ${it.color}88, transparent 70%)` }}><ShoppingBag className="w-7 h-7 text-white" /></div>
                <div className="font-display font-bold text-white leading-tight">{it.name}</div>
                <div className="text-[11px] text-[#a9b3d9] capitalize mb-1">{it.slot === 'character' ? 'Runner' : it.slot}</div>
                <RarityTag r={it.rarity} />
                <GameButton size="sm" className="mt-2 w-full" variant={it.coins ? 'gold' : 'pink'} disabled={it.coins ? save.coins < it.coins : save.gems < (it.gems || 0)}
                  onClick={() => { if (buyItem(it.id)) { audio.play('claim'); flash(`${it.name} unlocked! Equip it in the Locker.`); } }}>
                  {it.coins ? <><Coins className="w-4 h-4" />{fmt(it.coins)}</> : <><Gem className="w-4 h-4" />{it.gems}</>}
                </GameButton>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display font-bold text-2xl text-white mb-2 flex items-center gap-2"><Coins className="w-6 h-6 text-[#FFB800]" />Coin Exchange</h2>
        <p className="text-sm text-[#a9b3d9] mb-2">Trade gems you have earned in runs for coins. No real money, ever.</p>
        <div className="grid grid-cols-3 gap-3">
          {GEM_TO_COIN_PACKS.map((p, i) => (
            <div key={i} className="glass rounded-3xl p-3 text-center">
              <div className="flex justify-center -space-x-2 mb-1">{Array.from({ length: i + 1 }).map((_, j) => <span key={j} className="w-8 h-8 rounded-full bg-gradient-to-b from-[#ffd24a] to-[#ff9f00] border-2 border-[#12162B] flex items-center justify-center"><Coins className="w-4 h-4 text-[#5a3300]" /></span>)}</div>
              <div className="font-display font-bold text-xl text-[#FFB800]">{fmt(p.coins)}</div>
              <GameButton size="sm" variant="pink" className="w-full mt-1" disabled={save.gems < p.gems} onClick={() => { if (gemsToCoins(p.gems, p.coins)) { audio.play('coin'); flash(`+${fmt(p.coins)} coins`); } }}><Gem className="w-4 h-4" />{p.gems}</GameButton>
            </div>
          ))}
        </div>
      </section>
      <ChestOpen kind={opening} onClose={() => setOpening(null)} />
    </div>
  );
}
