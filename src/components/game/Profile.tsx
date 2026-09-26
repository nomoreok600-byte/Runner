import { useState } from 'react';
import { Settings as SettingsIcon, BarChart3, Music, Volume2, Smartphone, Gauge, Hand, Trash2, Maximize, Download, GraduationCap } from 'lucide-react';
import { Save, setSettings, resetProgress, Quality } from '@/game/store';
import { charById, xpForLevel, ACHIEVEMENTS } from '@/game/data';
import { audio } from '@/game/audio';
import { GameButton, Modal, Progress, fmt } from './ui';

export default function Profile({ save, onTutorial, onInstall, canInstall, onFullscreen }: { save: Save; onTutorial: () => void; onInstall: () => void; canInstall: boolean; onFullscreen: () => void }) {
  const [tab, setTab] = useState<'stats' | 'settings'>('stats');
  const [confirm, setConfirm] = useState(false);
  const s = save.stats;
  const ch = charById(save.equip.character);
  const stars = Object.values(save.levels).reduce((a, l) => a + l.stars, 0);
  const stats: [string, string][] = [
    ['Total distance', `${fmt(Math.floor(s.distance || 0))} m`], ['Levels cleared', fmt(s.levelsCleared || 0)], ['Highest level', fmt(save.maxLevel - 1)],
    ['Stars earned', fmt(stars)], ['Best combo', `x${s.bestCombo || 0}`], ['Endless best', `${fmt(save.endlessBest)} m`],
    ['Runs', fmt(s.runs || 0)], ['Jumps', fmt(s.jumps || 0)], ['Double jumps', fmt(s.doubleJumps || 0)], ['Wall-runs', fmt(s.wallRuns || 0)],
    ['Wall-jumps', fmt(s.wallJumps || 0)], ['Vaults', fmt(s.vaults || 0)], ['Slides', fmt(s.slides || 0)], ['Perfect rolls', fmt(s.perfectRolls || 0)],
    ['Ledge grabs', fmt(s.ledgeGrabs || 0)], ['Zip lines', fmt(s.ziplines || 0)], ['Bar swings', fmt(s.swings || 0)], ['Dashes', fmt(s.dashes || 0)],
    ['Drones smashed', fmt(s.dronesSmashed || 0)], ['Coins collected', fmt(s.coins || 0)], ['Golden tokens', fmt(s.tokens || 0)], ['Chests opened', fmt(s.chestsOpened || 0)],
  ];
  const st = save.settings;
  const Toggle = ({ on, onChange, label, icon: I }: { on: boolean; onChange: (v: boolean) => void; label: string; icon: typeof Music }) => (
    <label className="flex items-center justify-between glass rounded-2xl p-3 cursor-pointer">
      <span className="flex items-center gap-2 font-display text-white text-lg"><I className="w-5 h-5 text-[#00F0FF]" />{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => { audio.play('click'); onChange(!on); }} className={`w-14 h-8 rounded-full relative transition ${on ? 'bg-[#00F0FF]' : 'bg-white/15'}`}>
        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </label>
  );
  const Seg = <T extends string>({ value, options, onChange, label, icon: I }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; icon: typeof Music }) => (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 font-display text-white text-lg mb-2"><I className="w-5 h-5 text-[#00F0FF]" />{label}</div>
      <div className="flex gap-1.5">
        {options.map(([v, l]) => <button key={v} onClick={() => { audio.play('click'); onChange(v); }} className={`btn-bounce flex-1 h-10 rounded-xl font-display font-semibold text-sm ${value === v ? 'btn-primary' : 'btn-dark'}`}>{l}</button>)}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      <div className="glass rounded-3xl p-4 mb-3 flex items-center gap-4 shrink-0">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-3xl text-[#0B0E1A]" style={{ background: `linear-gradient(160deg, ${ch.color}, #ffffff)` }}>{ch.name[0]}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-2xl text-white">Runner Lv. {save.playerLevel}</div>
          <div className="text-sm text-[#a9b3d9] mb-1">Main: {ch.name} · {save.achClaimed.length}/{ACHIEVEMENTS.length} trophies</div>
          <Progress value={save.xp} max={xpForLevel(save.playerLevel)} />
          <div className="text-xs text-[#a9b3d9] mt-1 tabular-nums">{save.xp} / {xpForLevel(save.playerLevel)} XP</div>
        </div>
      </div>
      <div className="flex gap-2 mb-3 shrink-0">
        {([['stats', 'Stats', BarChart3], ['settings', 'Settings', SettingsIcon]] as const).map(([id, l, I]) => (
          <button key={id} onClick={() => { audio.play('click'); setTab(id); }} className={`btn-bounce flex-1 h-11 rounded-2xl font-display font-bold flex items-center justify-center gap-2 ${tab === id ? 'btn-primary' : 'btn-dark'}`}><I className="w-4 h-4" />{l}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0 scroll-y no-scrollbar pb-4">
        {tab === 'stats' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="glass rounded-2xl p-3">
                <div className="text-xs uppercase tracking-wider text-[#8f9ac4]">{k}</div>
                <div className="font-display font-bold text-2xl text-white tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <Seg label="Controls" icon={Hand} value={st.controls} options={[['swipe', 'Swipe'], ['buttons', 'On-screen buttons']]} onChange={(v) => setSettings({ controls: v })} />
            <div className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between font-display text-white text-lg mb-2"><span className="flex items-center gap-2"><Gauge className="w-5 h-5 text-[#00F0FF]" />Swipe sensitivity</span><span className="tabular-nums">{st.sensitivity.toFixed(1)}x</span></div>
              <input type="range" min={0.5} max={2} step={0.1} value={st.sensitivity} aria-label="Swipe sensitivity" onChange={(e) => setSettings({ sensitivity: parseFloat(e.target.value) })} className="w-full accent-[#00F0FF]" />
            </div>
            <Seg<Quality> label="Graphics quality" icon={Smartphone} value={st.quality} options={[['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} onChange={(v) => setSettings({ quality: v })} />
            <Toggle label="Music" icon={Music} on={st.music} onChange={(v) => { setSettings({ music: v }); audio.setMusic(v); }} />
            <Toggle label="Sound effects" icon={Volume2} on={st.sfx} onChange={(v) => { setSettings({ sfx: v }); audio.setSfx(v); }} />
            <Toggle label="Haptic vibration" icon={Smartphone} on={st.haptics} onChange={(v) => { setSettings({ haptics: v }); (window as any).__skyrushHaptics = v; }} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <GameButton variant="dark" onClick={onFullscreen}><Maximize className="w-5 h-5" />Fullscreen</GameButton>
              <GameButton variant="dark" onClick={onTutorial}><GraduationCap className="w-5 h-5" />Tutorial</GameButton>
              {canInstall && <GameButton className="col-span-2" onClick={onInstall}><Download className="w-5 h-5" />Install app</GameButton>}
            </div>
            <GameButton variant="pink" className="w-full mt-2" onClick={() => setConfirm(true)}><Trash2 className="w-5 h-5" />Reset progress</GameButton>
            <p className="text-xs text-[#7f8ab5] text-center pt-2">Progress is saved on this device only. No account, no real-money purchases.</p>
          </div>
        )}
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset progress?">
        <p className="text-[#cfd6f5] mb-4">This erases coins, gems, unlocked items, levels and stats on this device. Settings are kept. This cannot be undone.</p>
        <div className="flex gap-2">
          <GameButton variant="dark" className="flex-1" onClick={() => setConfirm(false)}>Cancel</GameButton>
          <GameButton variant="pink" className="flex-1" onClick={() => { resetProgress(); setConfirm(false); }}>Reset</GameButton>
        </div>
      </Modal>
    </div>
  );
}
