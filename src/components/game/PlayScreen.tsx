import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, Lock, Play, Infinity as InfinityIcon, GraduationCap, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { WORLDS, worldForLevel } from '@/game/data';
import { Save } from '@/game/store';
import { audio } from '@/game/audio';
import { GameButton, fmt } from './ui';

export default function PlayScreen({ save, onPlay, onEndless, onTutorial }: { save: Save; onPlay: (n: number) => void; onEndless: () => void; onTutorial: () => void }) {
  const currentZone = Math.floor((save.maxLevel - 1) / 10);
  const [zone, setZone] = useState(currentZone);
  const totalZones = currentZone + 2; // unlimited: always one locked zone ahead
  const world = WORLDS[zone % WORLDS.length];
  const first = zone * 10 + 1;
  const levels = useMemo(() => Array.from({ length: 10 }, (_, i) => first + i), [first]);
  const locked = first > save.maxLevel;
  const totalStars = Object.values(save.levels).reduce((s, l) => s + l.stars, 0);
  const zoneStars = levels.reduce((s, n) => s + (save.levels[n]?.stars || 0), 0);
  const curRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [zone]);

  // winding path positions (percent x) for nodes, bottom (first) to top
  const xs = [50, 72, 80, 64, 40, 22, 30, 54, 76, 58];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-5 max-w-5xl mx-auto w-full">
      <div className="lg:w-80 shrink-0 flex flex-col gap-3">
        <div className="glass rounded-3xl p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-50" style={{ background: `linear-gradient(135deg, ${world.skyTop}, ${world.skyBottom})` }} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <button aria-label="Previous world" disabled={zone === 0} onClick={() => { audio.play('click'); setZone((z) => Math.max(0, z - 1)); }} className="btn-bounce btn-dark w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30"><ChevronLeft /></button>
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.25em] text-white/70">World {zone + 1}</div>
                <h2 className="font-display font-bold text-2xl text-white leading-tight">{world.name}</h2>
              </div>
              <button aria-label="Next world" disabled={zone >= totalZones - 1} onClick={() => { audio.play('click'); setZone((z) => z + 1); }} className="btn-bounce btn-dark w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30"><ChevronRight /></button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-white">
              <span className="flex items-center gap-1 font-display font-bold"><Star className="w-5 h-5 text-[#FFB800] fill-[#FFB800]" />{zoneStars}/30</span>
              <span className="text-white/70 text-sm">Levels {first}-{first + 9}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <button onClick={() => { audio.play('click'); onEndless(); }} className="btn-bounce glass rounded-3xl p-4 text-left relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-[#FF2E9E]/30 blur-2xl group-hover:bg-[#FF2E9E]/50 transition" />
            <InfinityIcon className="w-8 h-8 text-[#FF2E9E]" />
            <div className="font-display font-bold text-xl text-white mt-1">Endless Mode</div>
            <div className="text-sm text-[#a9b3d9]">Best: {fmt(save.endlessBest)} m</div>
          </button>
          <button onClick={() => { audio.play('click'); onTutorial(); }} className="btn-bounce glass rounded-3xl p-4 text-left relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-[#2EE6A6]/25 blur-2xl group-hover:bg-[#2EE6A6]/40 transition" />
            <GraduationCap className="w-8 h-8 text-[#2EE6A6]" />
            <div className="font-display font-bold text-xl text-white mt-1">Training</div>
            <div className="text-sm text-[#a9b3d9]">Learn every move</div>
          </button>
        </div>
        <div className="hidden lg:flex glass rounded-3xl p-4 items-center justify-between">
          <span className="text-[#a9b3d9]">Total stars</span>
          <span className="font-display font-bold text-2xl text-white flex items-center gap-1"><Star className="w-5 h-5 text-[#FFB800] fill-[#FFB800]" />{totalStars}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 glass rounded-3xl relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${world.nightTop} 0%, ${world.skyTop} 50%, ${world.skyBottom} 130%)`, opacity: 0.55 }} />
        <div className="absolute inset-0 scroll-y no-scrollbar">
          <div className="relative mx-auto" style={{ height: 10 * 104 + 120, maxWidth: 420 }}>
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 100 ${10 * 104 + 120}`} aria-hidden>
              <path d={levels.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${10 * 104 + 40 - i * 104}`).join(' ')} stroke={world.accent} strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="3 3" fill="none" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 6 }} />
            </svg>
            <div className="absolute left-0 right-0 top-4 text-center">
              <span className="glass rounded-full px-3 py-1 text-sm font-display text-white inline-flex items-center gap-1"><Flag className="w-4 h-4" style={{ color: world.accent }} />World {zone + 2}: {worldForLevel(first + 10).name}</span>
            </div>
            {levels.map((n, i) => {
              const rec = save.levels[n];
              const unlocked = n <= save.maxLevel;
              const current = n === save.maxLevel;
              return (
                <button key={n} ref={current ? curRef : undefined} disabled={!unlocked}
                  onClick={() => { audio.play('click'); onPlay(n); }}
                  aria-label={`Level ${n}${unlocked ? '' : ' locked'}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center btn-bounce ${!unlocked ? 'cursor-not-allowed' : ''}`}
                  style={{ left: `${xs[i]}%`, top: 10 * 104 + 40 - i * 104 }}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-2xl border-4 ${current ? 'pulse-glow scale-110' : ''}`}
                    style={unlocked ? { background: `linear-gradient(180deg, ${world.accent}, ${world.accent2})`, borderColor: '#ffffff', color: '#0B0E1A', boxShadow: `0 6px 0 rgba(0,0,0,0.35), 0 0 22px ${world.accent}88` } : { background: '#1a1f3d', borderColor: '#ffffff22', color: '#ffffff55' }}>
                    {unlocked ? n : <Lock className="w-6 h-6" />}
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    {[0, 1, 2].map((s) => <Star key={s} className={`w-4 h-4 ${rec && rec.stars > s ? 'text-[#FFB800] fill-[#FFB800]' : 'text-white/25'}`} />)}
                  </div>
                  {current && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white bg-[#FF2E9E] rounded-full px-2">Next</span>}
                </button>
              );
            })}
          </div>
        </div>
        {locked && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
            <Lock className="w-12 h-12 text-white/80 mb-2" />
            <div className="font-display font-bold text-2xl text-white">World locked</div>
            <p className="text-[#cfd6f5]">Clear level {first - 1} to unlock {world.name}.</p>
          </div>
        )}
        {!locked && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center px-3">
            <GameButton size="lg" className="w-full max-w-xs shadow-2xl" onClick={() => onPlay(Math.min(save.maxLevel, first + 9))}>
              <Play className="w-6 h-6 fill-current" />Play {Math.min(save.maxLevel, first + 9)}
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}
