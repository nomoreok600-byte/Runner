import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Shirt, Target, ShoppingBag, User, Map, Infinity as InfinityIcon, Gift, Disc3, Maximize, Volume2, VolumeX, Package, ChevronLeft, Star, Zap } from 'lucide-react';
import { useSave, ensureDaily, claimableCount, loginStatus, claimLogin, canSpin, describeReward, setSettings } from '@/game/store';
import { detectQuality, QualityLevel } from '@/game/env';
import { audio } from '@/game/audio';
import { LOGIN_REWARDS, worldForLevel, ChestKind } from '@/game/data';
import PreviewCanvas from './game/PreviewCanvas';
import GameView from './game/GameView';
import PlayScreen from './game/PlayScreen';
import Locker from './game/Locker';
import Missions, { SpinWheel } from './game/Missions';
import Shop from './game/Shop';
import Profile from './game/Profile';
import ChestOpen from './game/ChestOpen';
import { CurrencyPill, GameButton, IconButton, Modal, RewardChips, XpBadge } from './game/ui';

type Tab = 'play' | 'locker' | 'missions' | 'shop' | 'profile';
type Run = { level: number; endless: boolean; key: number } | null;

export default function AppLayout() {
  const save = useSave();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>('play');
  const [mapOpen, setMapOpen] = useState(false);
  const [run, setRun] = useState<Run>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [chest, setChest] = useState<ChestKind | null>(null);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const quality: QualityLevel = useMemo(() => (save.settings.quality === 'auto' ? detectQuality() : save.settings.quality), [save.settings.quality]);
  const look = useMemo(() => ({ equip: save.equip, colors: save.colors }), [save.equip, save.colors]);

  useEffect(() => {
    ensureDaily();
    audio.musicOn = save.settings.music; audio.sfxOn = save.settings.sfx;
    (window as any).__skyrushHaptics = save.settings.haptics;
    const bip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', bip);
    const midnight = window.setInterval(() => ensureDaily(), 30000);
    const block = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    const gs = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', gs);
    return () => { window.removeEventListener('beforeinstallprompt', bip); clearInterval(midnight); document.removeEventListener('touchmove', block); document.removeEventListener('gesturestart', gs); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!run && !splash) audio.startMusic('menu'); }, [run, splash]);

  const startRun = useCallback((level: number, endless = false) => {
    audio.ensure(); audio.stopMusic();
    setMapOpen(false);
    setRun({ level, endless, key: Date.now() });
  }, []);

  const enterFromSplash = () => {
    audio.ensure();
    setSplash(false);
    if (!save.tutorialDone) { startRun(0); return; }
    audio.startMusic('menu');
    if (!loginStatus(save).claimedToday) window.setTimeout(() => setLoginOpen(true), 500);
  };

  const fullscreen = () => {
    const d = document as any;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    else { const el = document.documentElement as any; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); }
  };
  const install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); };

  const toggleSound = () => {
    const on = !(save.settings.music || save.settings.sfx);
    setSettings({ music: on, sfx: on }); audio.setMusic(on); audio.setSfx(on);
  };

  if (splash) return <Splash onStart={enterFromSplash} />;

  if (run) {
    return (
      <GameView key={run.key} level={run.level} endless={run.endless} look={look} quality={quality} settings={save.settings}
        onExit={() => setRun(null)}
        onRetry={() => setRun({ ...run, key: Date.now() })}
        onPlayLevel={(n) => setRun({ level: n, endless: false, key: Date.now() })} />
    );
  }

  const badge = claimableCount(save);
  const nextLevel = save.maxLevel;
  const world = worldForLevel(nextLevel);
  const nav: { id: Tab; label: string; icon: typeof Play; badge?: number }[] = [
    { id: 'play', label: 'Play', icon: Play }, { id: 'locker', label: 'Locker', icon: Shirt }, { id: 'missions', label: 'Missions', icon: Target, badge },
    { id: 'shop', label: 'Shop', icon: ShoppingBag, badge: Object.values(save.chests).reduce((a, b) => a + b, 0) || undefined }, { id: 'profile', label: 'Profile', icon: User },
  ];
  const chestTotal = Object.values(save.chests).reduce((a, b) => a + b, 0);
  const firstChest = (Object.keys(save.chests) as ChestKind[]).find((k) => save.chests[k] > 0) || null;
  const ls = loginStatus(save);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0B0E1A] text-white overflow-hidden">
      {/* 3D rooftop backdrop on home */}
      {tab === 'play' && !mapOpen && <PreviewCanvas look={look} mode="menu" quality={quality} className="absolute inset-0" />}
      {(tab !== 'play' || mapOpen) && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1d2352_0%,#0B0E1A_60%)]" />}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0B0E1A]/70 via-transparent to-[#0B0E1A]/85" />

      {/* top bar */}
      <header className="relative z-10 safe-top safe-x px-3 sm:px-5">
        <div className="flex items-center gap-2 py-1">
          <XpBadge save={save} />
          <div className="flex-1" />
          <CurrencyPill kind="coins" value={save.coins} onClick={() => setTab('shop')} />
          <CurrencyPill kind="gems" value={save.gems} onClick={() => setTab('shop')} />
          <IconButton label={save.settings.music || save.settings.sfx ? 'Mute' : 'Unmute'} onClick={toggleSound} className="hidden sm:flex">{save.settings.music || save.settings.sfx ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</IconButton>
          <IconButton label="Fullscreen" onClick={fullscreen} className="hidden sm:flex"><Maximize className="w-5 h-5" /></IconButton>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 safe-x px-3 sm:px-5 pt-2 pb-2">
        {tab === 'play' && !mapOpen && (
          <div className="h-full flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="slide-up">
                <h1 className="font-display font-bold leading-[0.9] logo-shimmer balance" style={{ fontSize: 'clamp(40px, 9vw, 84px)' }}>SKYRUSH</h1>
                <div className="font-display text-[#cfd6f5] tracking-[0.35em] text-xs sm:text-sm uppercase mt-1">Parkour Legends</div>
              </div>
              <div className="flex flex-col gap-2">
                <IconButton label="Daily login reward" onClick={() => setLoginOpen(true)} badge={ls.claimedToday ? 0 : 1}><Gift className="w-5 h-5 text-[#FFB800]" /></IconButton>
                <IconButton label="Lucky spin" onClick={() => setSpinOpen(true)} badge={canSpin(save) ? 1 : 0}><Disc3 className="w-5 h-5 text-[#FF2E9E]" /></IconButton>
                <IconButton label="Open chest" onClick={() => firstChest ? setChest(firstChest) : setTab('shop')} badge={chestTotal}><Package className="w-5 h-5 text-[#B45CFF]" /></IconButton>
              </div>
            </div>
            <div className="flex-1" />
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto space-y-2 slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="glass rounded-2xl px-4 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: world.accent }}>{world.name}</div>
                  <div className="font-display font-bold text-xl">Level {nextLevel}</div>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#cfd6f5]">
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-[#FFB800] fill-[#FFB800]" />{Object.values(save.levels).reduce((a, l) => a + l.stars, 0)}</span>
                  <span className="flex items-center gap-1"><Zap className="w-4 h-4 text-[#00F0FF]" />x{save.stats.bestCombo || 0}</span>
                </div>
              </div>
              <GameButton size="lg" className="w-full h-[72px] text-3xl" onClick={() => { window.supercool?.track?.('cta_click', { cta: 'play_level' }); startRun(nextLevel); }}>
                <Play className="w-8 h-8 fill-current" />Play
              </GameButton>
              <div className="grid grid-cols-2 gap-2">
                <GameButton variant="dark" onClick={() => setMapOpen(true)}><Map className="w-5 h-5" />World map</GameButton>
                <GameButton variant="pink" onClick={() => startRun(0, true)}><InfinityIcon className="w-5 h-5" />Endless</GameButton>
              </div>
            </div>
          </div>
        )}
        {tab === 'play' && mapOpen && (
          <div className="h-full flex flex-col">
            <button onClick={() => { audio.play('click'); setMapOpen(false); }} className="btn-bounce self-start mb-2 flex items-center gap-1 font-display text-[#cfd6f5] hover:text-white"><ChevronLeft className="w-5 h-5" />Back</button>
            <div className="flex-1 min-h-0"><PlayScreen save={save} onPlay={(n) => startRun(n)} onEndless={() => startRun(0, true)} onTutorial={() => startRun(0)} /></div>
          </div>
        )}
        {tab === 'locker' && <Locker save={save} quality={quality} />}
        {tab === 'missions' && <Missions save={save} />}
        {tab === 'shop' && <Shop save={save} />}
        {tab === 'profile' && <Profile save={save} onTutorial={() => startRun(0)} onInstall={install} canInstall={!!installEvt} onFullscreen={fullscreen} />}
      </main>

      {/* bottom nav */}
      <nav className="relative z-10 safe-bottom safe-x px-2 sm:px-5" aria-label="Main">
        <div className="glass rounded-3xl flex items-stretch justify-around max-w-2xl mx-auto p-1.5 mb-1">
          {nav.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => { audio.play('click'); setTab(n.id); if (n.id === 'play') setMapOpen(false); }} aria-current={active ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all btn-bounce ${active ? 'bg-gradient-to-b from-[#00F0FF]/30 to-[#00F0FF]/5 text-white' : 'text-[#8f9ac4] hover:text-white'}`}>
                <n.icon className={`w-6 h-6 ${active ? 'text-[#00F0FF] drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] -translate-y-0.5' : ''} transition-transform`} />
                <span className="text-[11px] font-display font-semibold uppercase tracking-wide">{n.label}</span>
                {!!n.badge && <span className="absolute top-0.5 right-[22%] min-w-4 h-4 px-1 rounded-full bg-[#FF2E9E] text-[10px] font-bold flex items-center justify-center">{n.badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Daily Login" wide>
        <p className="text-[#a9b3d9] mb-3">Log in every day to keep your streak. Day 7 grants the Legendary Golden Crown.</p>
        <div className="grid grid-cols-4 gap-2">
          {LOGIN_REWARDS.map((r, i) => {
            const claimed = ls.claimedToday ? i <= ls.dayIndex : i < ls.dayIndex;
            const today = i === ls.dayIndex && !ls.claimedToday;
            return (
              <div key={i} className={`rounded-2xl p-2 text-center border-2 ${i === 6 ? 'col-span-2' : ''} ${today ? 'border-[#FFB800] bg-[#FFB800]/15 pulse-glow' : claimed ? 'border-[#2EE6A6]/50 bg-[#2EE6A6]/10' : 'border-white/10 bg-black/25'}`}>
                <div className="text-[11px] uppercase tracking-wider text-[#a9b3d9]">Day {i + 1}</div>
                <div className="text-xs mt-1 min-h-[32px] flex items-center justify-center"><RewardChips r={r} /></div>
              </div>
            );
          })}
        </div>
        {claimMsg && <div className="text-center text-[#FFB800] font-display mt-3 pop-in">{claimMsg}</div>}
        <GameButton variant="gold" size="lg" className="w-full mt-4" disabled={ls.claimedToday} onClick={() => { const r = claimLogin(); if (r) { audio.play('claim'); setClaimMsg(`Claimed: ${describeReward(r)}`); window.setTimeout(() => { setClaimMsg(null); setLoginOpen(false); }, 1600); } }}>
          <Gift className="w-6 h-6" />{ls.claimedToday ? 'Claimed today' : 'Claim'}
        </GameButton>
      </Modal>
      <SpinWheel open={spinOpen} onClose={() => setSpinOpen(false)} save={save} />
      <ChestOpen kind={chest} onClose={() => setChest(null)} />
    </div>
  );
}

function Splash({ onStart }: { onStart: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setReady(true), 900); return () => clearTimeout(id); }, []);
  return (
    <button onClick={() => ready && onStart()} className="fixed inset-0 w-full flex flex-col items-center justify-center bg-[#0B0E1A] overflow-hidden text-center safe-top safe-bottom" aria-label="Tap to start">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,#3a1060_0%,#0B0E1A_65%)]" />
      <div className="absolute bottom-0 inset-x-0 h-[40%] opacity-70" style={{ background: 'repeating-linear-gradient(90deg, #12162B 0 38px, #0f1224 38px 70px, #151a35 70px 120px)', maskImage: 'linear-gradient(to top, black 30%, transparent)', WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent)' }} />
      <div className="absolute bottom-[38%] inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00F0FF] to-transparent shadow-[0_0_20px_#00F0FF]" />
      <div className="absolute w-[120vmax] h-[120vmax] rays opacity-20" />
      <div className="relative pop-in">
        <img src="https://d38kszyerljeoa.cloudfront.net/posts/scb_5733b160393c036a21a5f9f6/42dedc913f9443b3.png" alt="SKYRUSH emblem" className="w-28 h-28 sm:w-36 sm:h-36 mx-auto rounded-[28%] shadow-[0_0_60px_rgba(0,240,255,0.5)] mb-4 object-cover" />
        <h1 className="font-display font-bold logo-shimmer leading-none balance" style={{ fontSize: 'clamp(56px, 15vw, 140px)' }}>SKYRUSH</h1>
        <div className="font-display text-[#cfd6f5] tracking-[0.5em] uppercase text-sm sm:text-lg mt-2">Parkour Legends</div>
      </div>
      <div className={`relative mt-14 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}>
        <div className="font-display font-bold text-2xl text-white animate-pulse">Tap to run</div>
        <div className="text-xs text-[#7f8ab5] mt-2">Swipe on mobile · WASD / arrows + Space + Shift on desktop</div>
      </div>
    </button>
  );
}
