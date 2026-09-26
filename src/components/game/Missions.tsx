import { useEffect, useRef, useState } from 'react';
import { Check, Gift, CalendarDays, Target, Trophy, Crown, Lock, Package, Clock, Disc3 } from 'lucide-react';
import { ACHIEVEMENTS, LOGIN_REWARDS, SEASON_TIERS, SPIN_SEGMENTS, XP_PER_TIER } from '@/game/data';
import { Save, achProgress, canSpin, claimAchievement, claimLogin, claimMission, claimMissionChest, claimSeason, doSpin, loginStatus, missionProgress, msToMidnight, seasonTier, describeReward } from '@/game/store';
import { audio, haptic } from '@/game/audio';
import { GameButton, Progress, RewardChips, fmtDur, fmt, Modal } from './ui';

type Tab = 'daily' | 'season' | 'trophies';

export default function Missions({ save }: { save: Save }) {
  const [tab, setTab] = useState<Tab>('daily');
  const [, force] = useState(0);
  useEffect(() => { const id = window.setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const tabs: { id: Tab; label: string; icon: typeof Target }[] = [
    { id: 'daily', label: 'Daily', icon: Target }, { id: 'season', label: 'Season', icon: Crown }, { id: 'trophies', label: 'Trophies', icon: Trophy },
  ];
  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      <div className="flex gap-2 mb-3 shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { audio.play('click'); setTab(t.id); }} className={`btn-bounce flex-1 h-11 rounded-2xl font-display font-bold flex items-center justify-center gap-2 ${tab === t.id ? 'btn-primary' : 'btn-dark'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 scroll-y no-scrollbar pb-4">
        {tab === 'daily' && <Daily save={save} />}
        {tab === 'season' && <Season save={save} />}
        {tab === 'trophies' && <Trophies save={save} />}
      </div>
    </div>
  );
}

function Daily({ save }: { save: Save }) {
  const [spinOpen, setSpinOpen] = useState(false);
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const ls = loginStatus(save);
  const allClaimed = save.daily.missions.length > 0 && save.daily.missions.every((m) => m.claimed);
  return (
    <div className="space-y-4">
      <section className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2"><Target className="w-5 h-5 text-[#00F0FF]" />Daily Missions</h2>
          <span className="text-xs text-[#a9b3d9] flex items-center gap-1 tabular-nums"><Clock className="w-3.5 h-3.5" />New in {fmtDur(msToMidnight())}</span>
        </div>
        <div className="space-y-2.5">
          {save.daily.missions.map((m, i) => {
            const p = missionProgress(save, m);
            const done = p >= m.goal;
            return (
              <div key={m.tid} className="rounded-2xl bg-black/25 border border-white/5 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-white text-lg leading-tight">{m.text}</div>
                  <div className="flex items-center gap-2 mt-1.5"><div className="flex-1"><Progress value={p} max={m.goal} color={done ? '#2EE6A6' : '#00F0FF'} /></div><span className="text-xs text-[#a9b3d9] tabular-nums w-20 text-right">{fmt(p)}/{fmt(m.goal)}</span></div>
                  <div className="text-xs text-[#FFB800] mt-1">{m.coins} coins · {m.xp} XP</div>
                </div>
                {m.claimed ? <span className="w-12 h-12 rounded-2xl bg-[#2EE6A6]/20 flex items-center justify-center"><Check className="w-6 h-6 text-[#2EE6A6]" /></span>
                  : <GameButton size="sm" variant={done ? 'gold' : 'dark'} disabled={!done} onClick={() => { claimMission(i); audio.play('claim'); haptic(15); }}>Claim</GameButton>}
              </div>
            );
          })}
        </div>
        <div className={`mt-3 rounded-2xl p-3 flex items-center gap-3 ${allClaimed && !save.daily.chestClaimed ? 'bg-gradient-to-r from-[#B45CFF]/30 to-[#FF2E9E]/30 pulse-glow' : 'bg-black/25'}`}>
          <Package className={`w-10 h-10 text-[#B45CFF] ${allClaimed && !save.daily.chestClaimed ? 'wobble' : ''}`} />
          <div className="flex-1"><div className="font-display font-bold text-white">Bonus Chest</div><div className="text-xs text-[#a9b3d9]">Complete all 3 missions: Neon Chest + 10 gems</div></div>
          <GameButton size="sm" variant="pink" disabled={!allClaimed || save.daily.chestClaimed} onClick={() => { claimMissionChest(); audio.play('chest'); }}>{save.daily.chestClaimed ? 'Done' : 'Open'}</GameButton>
        </div>
      </section>

      <section className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#FFB800]" />Login Streak</h2>
          <span className="text-xs text-[#a9b3d9]">Day 7 = Legendary</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {LOGIN_REWARDS.map((r, i) => {
            const claimed = ls.claimedToday ? i <= ls.dayIndex : i < ls.dayIndex;
            const today = i === ls.dayIndex && !ls.claimedToday;
            return (
              <div key={i} className={`rounded-2xl p-2 text-center border-2 ${i === 6 ? 'col-span-2 sm:col-span-1' : ''} ${today ? 'border-[#FFB800] bg-[#FFB800]/15 pulse-glow' : claimed ? 'border-[#2EE6A6]/50 bg-[#2EE6A6]/10' : 'border-white/10 bg-black/25'}`}>
                <div className="text-[11px] uppercase tracking-wider text-[#a9b3d9]">Day {i + 1}</div>
                <div className="my-1 min-h-[34px] flex items-center justify-center text-xs"><RewardChips r={r} /></div>
                {claimed && <Check className="w-4 h-4 text-[#2EE6A6] mx-auto" />}
              </div>
            );
          })}
        </div>
        <GameButton variant="gold" className="w-full mt-3" disabled={ls.claimedToday} onClick={() => { const r = claimLogin(); if (r) { audio.play('claim'); setLoginMsg(`Claimed ${describeReward(r)}`); window.setTimeout(() => setLoginMsg(null), 2500); } }}>
          <Gift className="w-5 h-5" />{ls.claimedToday ? `Come back in ${fmtDur(msToMidnight())}` : `Claim day ${ls.dayIndex + 1}`}
        </GameButton>
        {loginMsg && <div className="text-center text-sm text-[#FFB800] mt-2 pop-in">{loginMsg}</div>}
      </section>

      <section className="glass rounded-3xl p-4 flex items-center gap-4">
        <Disc3 className={`w-14 h-14 text-[#FF2E9E] ${canSpin(save) ? 'animate-spin [animation-duration:4s]' : 'opacity-50'}`} />
        <div className="flex-1"><h2 className="font-display font-bold text-xl text-white">Lucky Spin</h2><p className="text-sm text-[#a9b3d9]">{canSpin(save) ? 'Your free daily spin is ready!' : `Next free spin in ${fmtDur(msToMidnight())}`}</p></div>
        <GameButton variant="pink" onClick={() => setSpinOpen(true)}>Spin</GameButton>
      </section>
      <SpinWheel open={spinOpen} onClose={() => setSpinOpen(false)} save={save} />
    </div>
  );
}

export function SpinWheel({ open, onClose, save }: { open: boolean; onClose: () => void; save: Save }) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const n = SPIN_SEGMENTS.length;
  const seg = 360 / n;
  const spin = () => {
    if (!canSpin(save) || spinning) return;
    const idx = doSpin();
    const target = rot + 360 * 6 + (360 - (idx * seg + seg / 2)) - (rot % 360);
    setSpinning(true); setWon(null); setRot(target);
    let k = 0;
    tickRef.current = window.setInterval(() => { audio.play('tick'); if (++k > 30) { clearInterval(tickRef.current!); } }, 120);
    window.setTimeout(() => { setSpinning(false); setWon(idx); audio.play('claim'); haptic([20, 40, 20]); }, 4200);
  };
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);
  const grad = SPIN_SEGMENTS.map((s, i) => `${s.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
  return (
    <Modal open={open} onClose={spinning ? undefined : onClose} title="Lucky Spin">
      <div className="flex flex-col items-center">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-2">
          <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-white drop-shadow" />
          <div className="w-full h-full rounded-full border-[6px] border-white/80 shadow-[0_0_40px_rgba(255,46,158,0.5)] relative overflow-hidden"
            style={{ background: `conic-gradient(${grad})`, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(.12,.8,.18,1)' : 'none' }}>
            {SPIN_SEGMENTS.map((s, i) => (
              <div key={i} className="absolute left-1/2 top-1/2 origin-[0_0] font-display font-bold text-white text-sm drop-shadow" style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg) translate(62px, -8px)` }}>
                {s.label}{s.reward.gems ? ' gems' : s.reward.coins ? '' : ''}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 m-auto w-14 h-14 rounded-full btn-gold flex items-center justify-center font-display font-bold">GO</div>
        </div>
        {won != null ? (
          <div className="text-center pop-in"><div className="text-sm text-[#a9b3d9] uppercase tracking-widest">You won</div><RewardChips r={SPIN_SEGMENTS[won].reward} /></div>
        ) : <p className="text-sm text-[#a9b3d9] text-center">Coins, gems and chests. One free spin every day.</p>}
        <GameButton variant="pink" size="lg" className="mt-3 w-56" disabled={!canSpin(save) || spinning} onClick={spin}>{spinning ? 'Spinning...' : canSpin(save) ? 'Spin free' : 'Come back tomorrow'}</GameButton>
      </div>
    </Modal>
  );
}

function Season({ save }: { save: Save }) {
  const tier = seasonTier(save);
  const into = save.seasonXp - tier * XP_PER_TIER;
  return (
    <div>
      <div className="glass rounded-3xl p-4 mb-3">
        <div className="flex items-center justify-between">
          <div><h2 className="font-display font-bold text-2xl text-white">Season 1: Skyline Rising</h2><p className="text-sm text-[#a9b3d9]">Free reward track · earn XP by running</p></div>
          <div className="text-right"><div className="font-display font-bold text-4xl text-[#FFB800]">{tier}</div><div className="text-xs text-[#a9b3d9]">/ 30</div></div>
        </div>
        {tier < 30 && <div className="mt-3"><Progress value={into} max={XP_PER_TIER} color="#FFB800" /><div className="text-xs text-[#a9b3d9] mt-1 tabular-nums">{into} / {XP_PER_TIER} XP to tier {tier + 1}</div></div>}
      </div>
      <div className="space-y-2">
        {SEASON_TIERS.map((r, i) => {
          const t = i + 1;
          const unlocked = t <= tier;
          const claimed = save.seasonClaimed.includes(t);
          const big = !!r.item;
          return (
            <div key={t} className={`rounded-2xl p-3 flex items-center gap-3 border ${big ? 'bg-gradient-to-r from-[#FFB800]/15 to-transparent border-[#FFB800]/40' : 'bg-black/25 border-white/5'}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-lg ${unlocked ? 'btn-gold' : 'btn-dark'}`}>{t}</div>
              <div className="flex-1 min-w-0 flex justify-start"><RewardChips r={r} /></div>
              {claimed ? <Check className="w-6 h-6 text-[#2EE6A6]" /> : unlocked ? <GameButton size="sm" variant="gold" onClick={() => { claimSeason(t); audio.play('claim'); }}>Claim</GameButton> : <Lock className="w-5 h-5 text-white/30" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Trophies({ save }: { save: Save }) {
  const done = ACHIEVEMENTS.filter((a) => save.achClaimed.includes(a.id)).length;
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const s = (x: typeof a) => (save.achClaimed.includes(x.id) ? 2 : achProgress(save, x.stat) >= x.goal ? 0 : 1);
    return s(a) - s(b);
  });
  return (
    <div>
      <div className="glass rounded-3xl p-4 mb-3 flex items-center gap-3">
        <Trophy className="w-10 h-10 text-[#FFB800]" />
        <div className="flex-1"><h2 className="font-display font-bold text-2xl text-white">Trophies</h2><Progress value={done} max={ACHIEVEMENTS.length} color="#FFB800" /></div>
        <span className="font-display font-bold text-xl text-white tabular-nums">{done}/{ACHIEVEMENTS.length}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {sorted.map((a) => {
          const p = achProgress(save, a.stat);
          const claimed = save.achClaimed.includes(a.id);
          const ready = !claimed && p >= a.goal;
          return (
            <div key={a.id} className={`rounded-2xl p-3 border flex gap-3 items-center ${claimed ? 'bg-[#FFB800]/10 border-[#FFB800]/30' : ready ? 'bg-[#2EE6A6]/10 border-[#2EE6A6]/40' : 'bg-black/25 border-white/5'}`}>
              <Trophy className={`w-8 h-8 shrink-0 ${claimed ? 'text-[#FFB800]' : ready ? 'text-[#2EE6A6]' : 'text-white/25'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-white leading-tight">{a.name}</div>
                <div className="text-xs text-[#a9b3d9]">{a.desc}</div>
                {!claimed && <div className="mt-1"><Progress value={p} max={a.goal} color="#2EE6A6" /></div>}
                <div className="text-[11px] text-[#FFB800] mt-0.5">{fmt(a.coins)} coins{a.gems ? ` · ${a.gems} gems` : ''}</div>
              </div>
              {claimed ? <Check className="w-5 h-5 text-[#FFB800]" /> : <GameButton size="sm" variant="gold" disabled={!ready} onClick={() => { claimAchievement(a.id); audio.play('claim'); haptic(15); }}>Claim</GameButton>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
