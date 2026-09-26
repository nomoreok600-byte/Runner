import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Home, Coins, Gem, Star, Magnet, Shield, Timer, ChevronsUp, Zap, Heart, Tv, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Hand, Trophy, SkipForward, Volume2, VolumeX, Music } from 'lucide-react';
import { Engine, Hud, Input, RunResult, PowerKind } from '@/game/engine';
import { Look } from '@/game/runner';
import { QualityLevel } from '@/game/env';
import { audio, haptic } from '@/game/audio';
import { worldForLevel, levelUpReward } from '@/game/data';
import { Settings, addCurrency, addXp, recordEndless, recordLevel, recordRunStats, spendGems, update, getSave, LevelUp, setSettings } from '@/game/store';
import { GameButton, RewardChips, fmt } from './ui';

interface Props {
  level: number; endless: boolean; look: Look; quality: QualityLevel; settings: Settings;
  onExit: () => void; onPlayLevel: (n: number) => void; onRetry: () => void;
}
interface Popup { id: number; text: string; color: string; big?: boolean; x: number; }

const REVIVE_GEMS = 10;
const POWER_ICON: Record<PowerKind, typeof Magnet> = { magnet: Magnet, shield: Shield, slowmo: Timer, double: Coins, superjump: ChevronsUp };
const POWER_COLOR: Record<PowerKind, string> = { magnet: '#ff4d6d', shield: '#3b9cff', slowmo: '#b45cff', double: '#ffb800', superjump: '#2ee6a6' };
const POWER_MAX: Record<PowerKind, number> = { magnet: 9, shield: 20, slowmo: 5, double: 10, superjump: 8 };

export default function GameView({ level, endless, look, quality, settings, onExit, onPlayLevel, onRetry }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [paused, setPaused] = useState(false);
  const [death, setDeath] = useState<{ canRevive: boolean } | null>(null);
  const [adT, setAdT] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ups, setUps] = useState<LevelUp[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popId = useRef(0);
  const tutorial = level === 0 && !endless;
  const world = worldForLevel(Math.max(1, level));

  const finishRun = useCallback((r: RunResult) => {
    audio.stopMusic();
    recordRunStats(r.stats);
    addCurrency(r.coins, r.gems);
    if (r.mode === 'endless') recordEndless(r.distance);
    if (r.completed && r.mode !== 'endless') recordLevel(r.level, r.stars, r.time, r.tokens);
    if (r.mode === 'tutorial') update((s) => { if (!s.tutorialDone && r.completed) s.coins += 300; s.tutorialDone = true; });
    const lu = addXp(r.xp);
    setUps(lu);
    setDeath(null);
    setResult(r);
    if (r.completed) window.supercool?.track?.('level_complete', { level: r.level, stars: r.stars, mode: r.mode });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    let e: Engine;
    try {
      e = new Engine({ canvas: canvasRef.current, level, endless, look, quality }, {
        onHud: setHud,
        onPopup: (text, color, big) => {
          const id = ++popId.current;
          setPopups((p) => [...p.slice(-3), { id, text, color, big, x: 50 + (Math.random() - 0.5) * 16 }]);
          window.setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1300);
        },
        onDeath: (canRevive) => setDeath({ canRevive }),
        onEnd: finishRun,
        onHint: (t) => { setHint(t); window.setTimeout(() => setHint((h) => (h === t ? null : h)), 4200); },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    engine.current = e;
    audio.startMusic('game');
    window.supercool?.track?.('run_start', { level, mode: endless ? 'endless' : tutorial ? 'tutorial' : 'level' });
    return () => { e.dispose(); engine.current = null; audio.stopMusic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((i: Input) => engine.current?.input(i), []);
  const doPause = useCallback((p: boolean) => {
    if (!engine.current || result || death) return;
    engine.current.setPaused(p); setPaused(p);
    if (p) audio.stopMusic(); else audio.startMusic('game');
  }, [result, death]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') { doPause(!paused); return; }
      if (paused || result || death) return;
      const map: Record<string, Input> = { arrowup: 'jump', w: 'jump', ' ': 'jump', arrowdown: 'slide', s: 'slide', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', shift: 'dash', e: 'tap', enter: 'tap' };
      const i = map[k];
      if (i) { e.preventDefault(); send(i); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [send, doPause, paused, result, death]);

  // auto-pause when tab hidden
  useEffect(() => {
    const v = () => { if (document.hidden) doPause(true); };
    document.addEventListener('visibilitychange', v);
    return () => document.removeEventListener('visibilitychange', v);
  }, [doPause]);

  // swipe controls
  const touch = useRef<{ x: number; y: number; t: number; fired: boolean } | null>(null);
  const lastTap = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    audio.ensure();
    touch.current = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const t = touch.current; if (!t || t.fired) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    const th = 28 / Math.max(0.4, settings.sensitivity);
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    t.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) send(dx > 0 ? 'right' : 'left'); else send(dy < 0 ? 'jump' : 'slide');
  };
  const onPointerUp = () => {
    const t = touch.current; touch.current = null;
    if (!t || t.fired) return;
    const now = performance.now();
    if (now - t.t < 300) {
      if (now - lastTap.current < 300) { send('dash'); lastTap.current = 0; }
      else { send('tap'); lastTap.current = now; }
    }
  };

  // simulated reward countdown
  useEffect(() => {
    if (adT == null) return;
    if (adT <= 0) { setAdT(null); setDeath(null); engine.current?.revive(); return; }
    const id = window.setTimeout(() => { setAdT((a) => (a == null ? null : a - 1)); audio.play('tick'); }, 1000);
    return () => clearTimeout(id);
  }, [adT]);

  const reviveGems = () => {
    if (!spendGems(REVIVE_GEMS)) return;
    setDeath(null); engine.current?.revive(); haptic(20);
  };

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#0B0E1A]">
        <h2 className="font-display text-3xl text-white">3D graphics unavailable</h2>
        <p className="text-[#a9b3d9] max-w-sm">Your browser could not start WebGL: {error}. Try enabling hardware acceleration or switching Graphics to Low in Settings.</p>
        <GameButton onClick={onExit}>Back to menu</GameButton>
      </div>
    );
  }

  const pct = hud ? hud.progress * 100 : 0;
  const tokens = hud?.tokens || [false, false, false];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* gesture layer */}
      <div
        className="absolute inset-0"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (touch.current = null)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Swipe to control the runner"
      />

      {/* HUD */}
      <div className="absolute inset-x-0 top-0 safe-top safe-x px-3 pointer-events-none">
        <div className="flex items-start gap-2">
          <button aria-label="Pause" onClick={() => doPause(true)} className="pointer-events-auto btn-bounce glass rounded-2xl w-11 h-11 flex items-center justify-center text-white shrink-0"><Pause className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            {endless ? (
              <div className="glass rounded-2xl px-3 h-11 flex items-center justify-between">
                <span className="font-display font-bold text-2xl text-white tabular-nums">{fmt(Math.floor(hud?.distance || 0))}<span className="text-sm text-[#a9b3d9] ml-1">m</span></span>
                <span className="text-xs text-[#a9b3d9] uppercase tracking-wider">Best {fmt(getSave().endlessBest)} m</span>
              </div>
            ) : (
              <div className="glass rounded-2xl px-3 py-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#cfd6f5]">
                  <span className="font-display font-bold" style={{ color: world.accent }}>{tutorial ? 'Tutorial' : `Level ${level}`}</span>
                  <span className="tabular-nums">{(hud?.time || 0).toFixed(1)}s</span>
                </div>
                <div className="relative h-2 mt-1 rounded-full bg-black/50 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${world.accent}, #fff)` }} />
                  {[33.3, 66.6].map((c) => <span key={c} className="absolute top-0 w-0.5 h-full bg-white/60" style={{ left: `${c}%` }} />)}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="glass rounded-full h-8 pl-1 pr-2.5 flex items-center gap-1"><span className="w-6 h-6 rounded-full bg-gradient-to-b from-[#ffd24a] to-[#ff9f00] flex items-center justify-center"><Coins className="w-3.5 h-3.5 text-[#5a3300]" /></span><span className="font-display font-bold text-white tabular-nums">{hud?.coins || 0}</span></div>
            <div className="glass rounded-full h-7 pl-1 pr-2 flex items-center gap-1"><Gem className="w-4 h-4 text-[#FF2E9E] ml-0.5" /><span className="font-display font-bold text-white text-sm tabular-nums">{hud?.gems || 0}</span></div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          {!endless ? (
            <div className="flex gap-1" aria-label="Golden tokens">
              {tokens.map((t, i) => (
                <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${t ? 'bg-gradient-to-b from-[#ffe27a] to-[#ffb800] border-white pop-in' : 'bg-black/40 border-white/20'}`}>
                  <Star className={`w-4 h-4 ${t ? 'text-[#7a4a00] fill-[#7a4a00]' : 'text-white/30'}`} />
                </span>
              ))}
            </div>
          ) : <div className="font-display text-white/80 text-sm glass rounded-full px-3 py-1 tabular-nums">Score {fmt(hud?.score || 0)}</div>}
          <div className="flex gap-1.5">
            {hud && (Object.keys(hud.powers) as PowerKind[]).filter((k) => hud.powers[k] > 0).map((k) => {
              const I = POWER_ICON[k];
              const frac = hud.powers[k] / POWER_MAX[k];
              return (
                <div key={k} className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(${POWER_COLOR[k]} ${frac * 360}deg, rgba(0,0,0,0.5) 0deg)` }}>
                  <div className="w-7 h-7 rounded-full bg-[#0B0E1A] flex items-center justify-center"><I className="w-4 h-4" style={{ color: POWER_COLOR[k] }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        {hud && hud.combo > 1 && (
          <div className="mt-2 flex justify-center">
            <div className="glass rounded-2xl px-4 py-1 text-center pop-in" key={hud.combo}>
              <div className="font-display font-bold text-3xl leading-none logo-shimmer">x{hud.combo}</div>
              <div className="w-20 h-1 mt-1 rounded-full bg-black/40 overflow-hidden"><div className="h-full bg-[#FFB800]" style={{ width: `${(hud.comboT / 3) * 100}%` }} /></div>
            </div>
          </div>
        )}
      </div>

      {/* popups */}
      <div className="absolute inset-x-0 top-[38%] pointer-events-none">
        {popups.map((p) => (
          <div key={p.id} className="absolute combo-pop font-display font-bold whitespace-nowrap" style={{ left: `${p.x}%`, color: p.color, fontSize: p.big ? 'clamp(26px, 7vw, 44px)' : 'clamp(20px, 5vw, 30px)', textShadow: `0 3px 0 rgba(0,0,0,0.6), 0 0 18px ${p.color}` }}>
            {p.text}
          </div>
        ))}
      </div>

      {/* tutorial hint */}
      {hint && !paused && !death && !result && (
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center px-4 pointer-events-none">
          <div className="glass rounded-2xl px-5 py-3 text-center slide-up max-w-md border-[#00F0FF]/40">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#00F0FF] font-bold">Parkour tip</div>
            <div className="font-display text-xl text-white balance">{hint}</div>
          </div>
        </div>
      )}

      {/* on-screen buttons */}
      {settings.controls === 'buttons' && !paused && !death && !result && (
        <div className="absolute inset-x-0 bottom-0 safe-bottom safe-x px-3 pb-2 flex items-end justify-between pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <CtrlBtn label="Left" onPress={() => send('left')}><ArrowLeft /></CtrlBtn>
            <CtrlBtn label="Right" onPress={() => send('right')}><ArrowRight /></CtrlBtn>
          </div>
          <div className="grid grid-cols-2 gap-2 pointer-events-auto">
            <CtrlBtn label="Vault" onPress={() => send('tap')} small><Hand className="w-5 h-5" /></CtrlBtn>
            <CtrlBtn label="Dash" onPress={() => send('dash')} small><Zap className="w-5 h-5" /></CtrlBtn>
            <CtrlBtn label="Slide" onPress={() => send('slide')}><ArrowDown /></CtrlBtn>
            <CtrlBtn label="Jump" onPress={() => send('jump')} accent><ArrowUp /></CtrlBtn>
          </div>
        </div>
      )}

      {/* pause */}
      {paused && (
        <Overlay>
          <h2 className="font-display font-bold text-5xl text-white mb-1">Paused</h2>
          <p className="text-[#a9b3d9] mb-6">{endless ? 'Endless run' : tutorial ? 'Tutorial' : `Level ${level} · ${world.name}`}</p>
          <div className="flex flex-col gap-3 w-64">
            <GameButton size="lg" onClick={() => doPause(false)}><Play className="w-6 h-6" />Resume</GameButton>
            <GameButton variant="dark" onClick={onRetry}><RotateCcw className="w-5 h-5" />Restart</GameButton>
            <div className="flex gap-3">
              <GameButton variant="dark" className="flex-1" ariaLabel="Toggle music" onClick={() => { setSettings({ music: !settings.music }); audio.setMusic(!settings.music); }}>{settings.music ? <Music className="w-5 h-5" /> : <Music className="w-5 h-5 opacity-40" />}</GameButton>
              <GameButton variant="dark" className="flex-1" ariaLabel="Toggle sound effects" onClick={() => { setSettings({ sfx: !settings.sfx }); audio.setSfx(!settings.sfx); }}>{settings.sfx ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</GameButton>
            </div>
            <GameButton variant="pink" onClick={() => { engine.current?.setPaused(false); setPaused(false); engine.current?.giveUp(); }}><Home className="w-5 h-5" />Quit run</GameButton>
          </div>
          <div className="mt-6 text-xs text-[#7f8ab5] text-center max-w-xs">Swipe up jump · down slide/roll · left/right lanes & wall-run · tap vault · double-tap dash. Keys: WASD/arrows, Space, Shift, E.</div>
        </Overlay>
      )}

      {/* death / revive */}
      {death && !result && (
        <Overlay>
          {adT != null ? (
            <>
              <div className="text-[#a9b3d9] uppercase tracking-[0.3em] text-sm mb-2">Reward break</div>
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute inset-0 rays opacity-70" />
                <div className="font-display font-bold text-7xl text-white">{adT}</div>
              </div>
              <p className="text-[#cfd6f5] mt-3 text-center max-w-xs">Catch your breath. You will revive in a moment.</p>
            </>
          ) : (
            <>
              <Heart className="w-14 h-14 text-[#FF2E9E] mb-2 wobble" />
              <h2 className="font-display font-bold text-4xl text-white">Wipeout!</h2>
              <p className="text-[#a9b3d9] mb-5">{Math.floor(hud?.distance || 0)} m · {hud?.coins || 0} coins</p>
              <div className="flex flex-col gap-3 w-64">
                {tutorial ? (
                  <GameButton size="lg" onClick={() => { setDeath(null); engine.current?.revive(); }}><RotateCcw className="w-6 h-6" />Try again</GameButton>
                ) : death.canRevive ? (
                  <>
                    <GameButton variant="pink" disabled={getSave().gems < REVIVE_GEMS} onClick={reviveGems}><Gem className="w-5 h-5" />Revive · {REVIVE_GEMS} gems</GameButton>
                    <GameButton onClick={() => setAdT(5)}><Tv className="w-5 h-5" />Free revive (5s)</GameButton>
                  </>
                ) : <p className="text-center text-[#cfd6f5]">Revive already used this run.</p>}
                <GameButton variant="dark" onClick={() => engine.current?.giveUp()}>{tutorial ? 'Skip tutorial' : 'End run'}</GameButton>
              </div>
            </>
          )}
        </Overlay>
      )}

      {result && <Results r={result} ups={ups} onHome={onExit} onRetry={onRetry} onNext={() => onPlayLevel(result.level + 1)} />}
    </div>
  );
}

function CtrlBtn({ children, onPress, label, accent, small }: { children: React.ReactNode; onPress: () => void; label: string; accent?: boolean; small?: boolean }) {
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); audio.ensure(); onPress(); }}
      className={`${small ? 'w-12 h-12' : 'w-16 h-16'} rounded-full flex items-center justify-center text-white active:scale-90 transition-transform ${accent ? 'bg-[#00F0FF]/40 border-2 border-[#00F0FF]' : 'glass'}`}
    >{children}</button>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0B0E1A]/75 backdrop-blur-md p-6 safe-top safe-bottom pop-in">{children}</div>;
}

function useCountUp(target: number, delay = 600, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now() + delay; let lastTick = 0;
    const f = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - start) / dur));
      const val = Math.round(target * (1 - Math.pow(1 - k, 3)));
      setV(val);
      if (k > 0 && k < 1 && t - lastTick > 60) { audio.play('tick'); lastTick = t; }
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, dur]);
  return v;
}

function Results({ r, ups, onHome, onRetry, onNext }: { r: RunResult; ups: LevelUp[]; onHome: () => void; onRetry: () => void; onNext: () => void }) {
  const [shown, setShown] = useState(0);
  const coins = useCountUp(r.coins);
  const xp = useCountUp(r.xp, 900);
  useEffect(() => {
    if (r.mode === 'endless' || !r.completed) return;
    const ids = [0, 1, 2].map((i) => window.setTimeout(() => { if (r.starFlags[i] || i < r.stars) { setShown(i + 1); audio.play('star'); haptic(15); } }, 500 + i * 450));
    return () => ids.forEach(clearTimeout);
  }, [r]);
  const labels = ['Beat par time', 'Collect 55% coins', 'No falls'];
  const earned = r.starFlags.map((f, i) => f || (i === 0 && r.stars >= 1 && !r.starFlags.some(Boolean)));
  const best = r.mode === 'endless' && r.distance >= getSave().endlessBest;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0B0E1A]/80 backdrop-blur-md p-4 safe-top safe-bottom overflow-y-auto">
      <div className="glass rounded-3xl w-full max-w-md p-5 sm:p-6 text-center pop-in">
        <div className="text-xs uppercase tracking-[0.3em] text-[#a9b3d9]">{r.mode === 'endless' ? 'Endless run' : r.mode === 'tutorial' ? 'Tutorial' : `Level ${r.level}`}</div>
        <h2 className="font-display font-bold text-4xl sm:text-5xl mt-1 logo-shimmer">
          {r.mode === 'endless' ? (best ? 'New Record!' : 'Run Over') : r.completed ? (r.mode === 'tutorial' ? 'Training Complete!' : 'Level Clear!') : 'Run Ended'}
        </h2>
        {r.mode !== 'endless' && r.completed && r.mode !== 'tutorial' && (
          <div className="flex justify-center gap-2 my-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 w-24">
                <Star className={`transition-all duration-300 ${i === 1 ? 'w-16 h-16 -mt-2' : 'w-12 h-12'} ${shown > i && earned[i] ? 'text-[#FFB800] fill-[#FFB800] pop-in drop-shadow-[0_0_14px_rgba(255,184,0,0.8)]' : 'text-white/20'}`} />
                <span className={`text-[11px] leading-tight ${earned[i] ? 'text-[#ffe08a]' : 'text-white/40'}`}>{labels[i]}</span>
              </div>
            ))}
          </div>
        )}
        {r.mode === 'endless' && (
          <div className="my-4">
            <div className="font-display font-bold text-6xl text-white tabular-nums">{fmt(r.distance)}<span className="text-2xl text-[#a9b3d9]"> m</span></div>
            <div className="text-[#a9b3d9]">Score {fmt(r.score)}</div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 my-3">
          <Stat icon={<Coins className="w-5 h-5 text-[#FFB800]" />} label="Coins" value={`+${coins}`} />
          <Stat icon={<Gem className="w-5 h-5 text-[#FF2E9E]" />} label="Gems" value={`+${r.gems}`} />
          <Stat icon={<Zap className="w-5 h-5 text-[#00F0FF]" />} label="XP" value={`+${xp}`} />
          <Stat icon={<Trophy className="w-5 h-5 text-[#B45CFF]" />} label="Best combo" value={`x${r.bestCombo}`} />
          <Stat icon={<Timer className="w-5 h-5 text-[#2EE6A6]" />} label="Time" value={`${r.time.toFixed(1)}s`} />
          <Stat icon={<Star className="w-5 h-5 text-[#FFB800]" />} label="Tokens" value={`${r.tokens.filter(Boolean).length}/3`} />
        </div>
        {ups.map((u) => (
          <div key={u.level} className="rounded-2xl p-3 my-2 bg-gradient-to-r from-[#00F0FF]/20 to-[#FF2E9E]/20 border border-white/10 pop-in">
            <div className="font-display font-bold text-xl text-white">Level up! You are now level {u.level}</div>
            <RewardChips r={levelUpReward(u.level)} />
          </div>
        ))}
        <div className="flex gap-2 mt-4">
          <GameButton variant="dark" className="flex-1" onClick={onHome} ariaLabel="Home"><Home className="w-5 h-5" /></GameButton>
          <GameButton variant="dark" className="flex-1" onClick={onRetry} ariaLabel="Retry"><RotateCcw className="w-5 h-5" /></GameButton>
          {r.mode === 'level' && r.completed && <GameButton className="flex-[2]" onClick={onNext}>Next<SkipForward className="w-5 h-5" /></GameButton>}
          {r.mode === 'tutorial' && <GameButton className="flex-[2]" onClick={() => onNext()}>Level 1<SkipForward className="w-5 h-5" /></GameButton>}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/5 py-2 px-1 flex flex-col items-center">
      {icon}
      <div className="font-display font-bold text-white text-lg tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-[#8f9ac4]">{label}</div>
    </div>
  );
}
