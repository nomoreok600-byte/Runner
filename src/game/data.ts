// SKYRUSH single source of truth for game content.
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type Slot = 'character' | 'top' | 'pants' | 'shoes' | 'hat' | 'mask' | 'backpack' | 'trail' | 'emote' | 'landing';

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#9CA3AF',
  Rare: '#3B9CFF',
  Epic: '#B45CFF',
  Legendary: '#FFB800',
};

export interface Unlock { type: 'level' | 'achievement' | 'login' | 'season' | 'chest'; value: number | string; }
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  style: string;
  color: string;
  coins?: number;
  gems?: number;
  unlock?: Unlock;
}

export interface CharacterDef extends Item {
  skin: string; hair: string; hairStyle: 'short' | 'spiky' | 'long' | 'bun' | 'mohawk' | 'bald' | 'ponytail';
  top: string; topColor: string; pants: string; pantsColor: string; shoes: string; shoesColor: string;
  scarf: string; build: number; height: number; bio: string;
}

const ch = (c: Omit<CharacterDef, 'slot' | 'style'>): CharacterDef => ({ ...c, slot: 'character', style: c.id });

export const CHARACTERS: CharacterDef[] = [
  ch({ id: 'kai', name: 'Kai', rarity: 'Common', color: '#00F0FF', skin: '#e0ac7e', hair: '#1b1b24', hairStyle: 'spiky', top: 'hoodie', topColor: '#1f6fff', pants: 'joggers', pantsColor: '#23263a', shoes: 'runner', shoesColor: '#ffffff', scarf: '#ff2e9e', build: 1, height: 1, bio: 'Rooftop rookie with a fearless streak.' }),
  ch({ id: 'nova', name: 'Nova', rarity: 'Common', color: '#FF2E9E', coins: 1500, skin: '#f1c7a3', hair: '#ff5fb7', hairStyle: 'ponytail', top: 'tank', topColor: '#ff2e9e', pants: 'tech', pantsColor: '#1a1d33', shoes: 'glow', shoesColor: '#00f0ff', scarf: '#00f0ff', build: 0.92, height: 0.97, bio: 'Neon-city speedster, lives for combos.' }),
  ch({ id: 'blaze', name: 'Blaze', rarity: 'Rare', color: '#FF6A00', coins: 4000, skin: '#8d5a3b', hair: '#ff6a00', hairStyle: 'mohawk', top: 'jacket', topColor: '#d9480f', pants: 'cargo', pantsColor: '#3a2a20', shoes: 'high', shoesColor: '#ffb800', scarf: '#ffb800', build: 1.08, height: 1.02, bio: 'Industrial daredevil. Never takes the stairs.' }),
  ch({ id: 'juno', name: 'Juno', rarity: 'Rare', color: '#2EE6A6', unlock: { type: 'level', value: 10 }, skin: '#c68b5e', hair: '#2d1b10', hairStyle: 'bun', top: 'tech', topColor: '#0f9f7a', pants: 'shorts', pantsColor: '#133b33', shoes: 'runner', shoesColor: '#2ee6a6', scarf: '#ffe066', build: 0.95, height: 0.98, bio: 'Jungle-ruins explorer with perfect balance.' }),
  ch({ id: 'rook', name: 'Rook', rarity: 'Rare', color: '#9fb4ff', gems: 60, skin: '#f0d0b0', hair: '#c9d4ff', hairStyle: 'short', top: 'jacket', topColor: '#384a8f', pants: 'joggers', pantsColor: '#1c2240', shoes: 'boot', shoesColor: '#222634', scarf: '#9fb4ff', build: 1.12, height: 1.05, bio: 'Ice-peak climber, steady as a glacier.' }),
  ch({ id: 'vex', name: 'Vex', rarity: 'Epic', color: '#B45CFF', gems: 150, skin: '#b98a6a', hair: '#b45cff', hairStyle: 'long', top: 'tech', topColor: '#2a0f4a', pants: 'tech', pantsColor: '#150a26', shoes: 'glow', shoesColor: '#b45cff', scarf: '#ff2e9e', build: 0.96, height: 1.0, bio: 'A glitch in the skyline. Wall-run master.' }),
  ch({ id: 'aria', name: 'Aria', rarity: 'Epic', color: '#FFD1F0', unlock: { type: 'achievement', value: 'combo25' }, skin: '#ffe0c8', hair: '#fff2c2', hairStyle: 'ponytail', top: 'hoodie', topColor: '#ffffff', pants: 'joggers', pantsColor: '#ffb3de', shoes: 'high', shoesColor: '#ff2e9e', scarf: '#b45cff', build: 0.9, height: 0.96, bio: 'Style queen. Every landing is a pose.' }),
  ch({ id: 'titan', name: 'Titan', rarity: 'Epic', color: '#FF4D4D', unlock: { type: 'level', value: 30 }, skin: '#6b4430', hair: '#111111', hairStyle: 'bald', top: 'tank', topColor: '#b91c1c', pants: 'cargo', pantsColor: '#27272a', shoes: 'boot', shoesColor: '#111111', scarf: '#ff4d4d', build: 1.25, height: 1.08, bio: 'Heavy hitter who smashes drones mid-dash.' }),
  ch({ id: 'zephyr', name: 'Zephyr', rarity: 'Legendary', color: '#7DF9FF', gems: 400, skin: '#dcb593', hair: '#e6fbff', hairStyle: 'long', top: 'tech', topColor: '#e6fbff', pants: 'tech', pantsColor: '#7df9ff', shoes: 'glow', shoesColor: '#ffffff', scarf: '#7df9ff', build: 0.94, height: 1.02, bio: 'Rides the wind between towers. Pure flow.' }),
  ch({ id: 'echo', name: 'Echo', rarity: 'Legendary', color: '#FFB800', unlock: { type: 'season', value: 30 }, skin: '#a8714f', hair: '#ffb800', hairStyle: 'spiky', top: 'jacket', topColor: '#1a1a1a', pants: 'joggers', pantsColor: '#ffb800', shoes: 'glow', shoesColor: '#ffb800', scarf: '#ffffff', build: 1.0, height: 1.0, bio: 'Legend of the skyline. Season 1 champion.' }),
];

const it = (slot: Slot, id: string, name: string, rarity: Rarity, style: string, color: string, extra: Partial<Item> = {}): Item =>
  ({ id, name, slot, rarity, style, color, ...extra });

export const ITEMS: Item[] = [
  // tops
  it('top', 'top_default', 'Character Top', 'Common', 'default', '#ffffff'),
  it('top', 'top_hoodie', 'Street Hoodie', 'Common', 'hoodie', '#3a86ff', { coins: 400 }),
  it('top', 'top_tank', 'Sprint Tank', 'Common', 'tank', '#ff006e', { coins: 400 }),
  it('top', 'top_jacket', 'Flight Jacket', 'Rare', 'jacket', '#fb5607', { coins: 1200 }),
  it('top', 'top_tech', 'Neon Techwear', 'Epic', 'tech', '#00f0ff', { gems: 80 }),
  it('top', 'top_gold', 'Gilded Armor', 'Legendary', 'tech', '#ffb800', { unlock: { type: 'season', value: 20 } }),
  // pants
  it('pants', 'pants_default', 'Character Pants', 'Common', 'default', '#ffffff'),
  it('pants', 'pants_joggers', 'Joggers', 'Common', 'joggers', '#2b2d42', { coins: 300 }),
  it('pants', 'pants_shorts', 'Trail Shorts', 'Common', 'shorts', '#06d6a0', { coins: 300 }),
  it('pants', 'pants_cargo', 'Cargo Pants', 'Rare', 'cargo', '#6b705c', { coins: 1000 }),
  it('pants', 'pants_tech', 'Circuit Leggings', 'Epic', 'tech', '#ff2e9e', { gems: 70 }),
  // shoes
  it('shoes', 'shoes_default', 'Character Kicks', 'Common', 'default', '#ffffff'),
  it('shoes', 'shoes_runner', 'Air Runners', 'Common', 'runner', '#ffffff', { coins: 300 }),
  it('shoes', 'shoes_high', 'High Tops', 'Rare', 'high', '#ef233c', { coins: 900 }),
  it('shoes', 'shoes_boot', 'Grip Boots', 'Rare', 'boot', '#3d405b', { coins: 900 }),
  it('shoes', 'shoes_glow', 'Photon Kicks', 'Epic', 'glow', '#00f0ff', { gems: 60 }),
  it('shoes', 'shoes_gold', 'Midas Soles', 'Legendary', 'glow', '#ffb800', { unlock: { type: 'achievement', value: 'dist100k' } }),
  // hats
  it('hat', 'hat_none', 'No Hat', 'Common', 'none', '#ffffff'),
  it('hat', 'hat_cap', 'Snapback', 'Common', 'cap', '#ff2e9e', { coins: 350 }),
  it('hat', 'hat_beanie', 'Beanie', 'Common', 'beanie', '#ffbe0b', { coins: 350 }),
  it('hat', 'hat_headphones', 'Beat Cans', 'Rare', 'headphones', '#00f0ff', { coins: 1400 }),
  it('hat', 'hat_visor', 'Holo Visor', 'Rare', 'visor', '#2ee6a6', { unlock: { type: 'level', value: 5 } }),
  it('hat', 'hat_helmet', 'Stunt Helmet', 'Epic', 'helmet', '#e63946', { gems: 90 }),
  it('hat', 'hat_horns', 'Demon Horns', 'Epic', 'horns', '#ff4d4d', { unlock: { type: 'season', value: 12 } }),
  it('hat', 'hat_crown', 'Golden Crown', 'Legendary', 'crown', '#ffb800', { unlock: { type: 'login', value: 7 } }),
  // masks
  it('mask', 'mask_none', 'No Mask', 'Common', 'none', '#ffffff'),
  it('mask', 'mask_bandana', 'Bandana', 'Common', 'bandana', '#e63946', { coins: 300 }),
  it('mask', 'mask_shades', 'Night Shades', 'Rare', 'shades', '#111111', { coins: 1100 }),
  it('mask', 'mask_cyber', 'Cyber Mask', 'Epic', 'cyber', '#00f0ff', { gems: 75 }),
  it('mask', 'mask_oni', 'Oni Mask', 'Epic', 'oni', '#ff2e2e', { unlock: { type: 'achievement', value: 'wallrun500' } }),
  it('mask', 'mask_skull', 'Neon Skull', 'Legendary', 'skull', '#f8f8ff', { gems: 250 }),
  // backpacks
  it('backpack', 'bp_none', 'No Backpack', 'Common', 'none', '#ffffff'),
  it('backpack', 'bp_pack', 'Day Pack', 'Common', 'pack', '#4361ee', { coins: 500 }),
  it('backpack', 'bp_tank', 'Oxygen Tank', 'Rare', 'tank', '#adb5bd', { coins: 1500 }),
  it('backpack', 'bp_katana', 'Twin Katanas', 'Epic', 'katana', '#ff2e9e', { gems: 100 }),
  it('backpack', 'bp_jet', 'Jetpack', 'Epic', 'jet', '#ffb800', { unlock: { type: 'season', value: 25 } }),
  it('backpack', 'bp_wings', 'Phoenix Wings', 'Legendary', 'wings', '#ff6a00', { gems: 300 }),
  // trails
  it('trail', 'trail_none', 'No Trail', 'Common', 'none', '#ffffff'),
  it('trail', 'trail_neon', 'Neon Streak', 'Common', 'neon', '#00f0ff', { coins: 800 }),
  it('trail', 'trail_smoke', 'Smoke', 'Common', 'smoke', '#9aa0b5', { coins: 600 }),
  it('trail', 'trail_fire', 'Inferno', 'Rare', 'fire', '#ff6a00', { coins: 2000 }),
  it('trail', 'trail_stars', 'Stardust', 'Rare', 'stars', '#fff4b0', { unlock: { type: 'level', value: 15 } }),
  it('trail', 'trail_ice', 'Frostbite', 'Epic', 'ice', '#a8e8ff', { gems: 90 }),
  it('trail', 'trail_rainbow', 'Rainbow Rush', 'Epic', 'rainbow', '#ff2e9e', { unlock: { type: 'season', value: 8 } }),
  it('trail', 'trail_gold', 'Golden Wake', 'Legendary', 'gold', '#ffb800', { gems: 280 }),
  // emotes
  it('emote', 'emote_fist', 'Fist Pump', 'Common', 'fist', '#ffffff'),
  it('emote', 'emote_wave', 'Big Wave', 'Common', 'wave', '#ffffff', { coins: 500 }),
  it('emote', 'emote_dance', 'Groove', 'Rare', 'dance', '#ffffff', { coins: 1500 }),
  it('emote', 'emote_bow', 'Royal Bow', 'Rare', 'bow', '#ffffff', { unlock: { type: 'season', value: 5 } }),
  it('emote', 'emote_flex', 'Power Flex', 'Epic', 'flex', '#ffffff', { gems: 70 }),
  it('emote', 'emote_spin', 'Victory Spin', 'Legendary', 'spin', '#ffffff', { unlock: { type: 'achievement', value: 'clear50' } }),
  // landing effects
  it('landing', 'land_dust', 'Dust Puff', 'Common', 'dust', '#c8b89a'),
  it('landing', 'land_sparks', 'Sparks', 'Rare', 'sparks', '#ffb800', { coins: 1200 }),
  it('landing', 'land_snow', 'Snowburst', 'Rare', 'snow', '#e8f7ff', { unlock: { type: 'level', value: 41 } }),
  it('landing', 'land_petals', 'Petal Storm', 'Epic', 'petals', '#ff8fc7', { gems: 60 }),
  it('landing', 'land_shock', 'Shockwave', 'Epic', 'shock', '#00f0ff', { unlock: { type: 'season', value: 16 } }),
  it('landing', 'land_bolt', 'Thunderstrike', 'Legendary', 'bolt', '#b45cff', { gems: 220 }),
];

export const ALL_ITEMS: Item[] = [...CHARACTERS, ...ITEMS];
export const itemById = (id: string) => ALL_ITEMS.find((i) => i.id === id);
export const charById = (id: string) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

export const DEFAULT_OWNED = ['kai', 'top_default', 'pants_default', 'shoes_default', 'hat_none', 'mask_none', 'bp_none', 'trail_none', 'emote_fist', 'land_dust'];
export const DEFAULT_EQUIP: Record<Slot, string> = {
  character: 'kai', top: 'top_default', pants: 'pants_default', shoes: 'shoes_default', hat: 'hat_none',
  mask: 'mask_none', backpack: 'bp_none', trail: 'trail_none', emote: 'emote_fist', landing: 'land_dust',
};

export const SLOT_LABEL: Record<Slot, string> = {
  character: 'Runners', top: 'Tops', pants: 'Pants', shoes: 'Shoes', hat: 'Hats', mask: 'Masks',
  backpack: 'Backpacks', trail: 'Trails', emote: 'Emotes', landing: 'Landings',
};
export const COLORABLE: Slot[] = ['top', 'pants', 'shoes', 'hat', 'mask', 'backpack'];
export const SWATCHES = ['#ffffff', '#1b1b24', '#ff2e9e', '#00f0ff', '#ffb800', '#2ee6a6', '#b45cff', '#ff4d4d', '#3b9cff', '#ff6a00', '#9aa0b5', '#7df9ff'];

// ---------------- Worlds ----------------
export interface World {
  id: string; name: string; accent: string; accent2: string;
  skyTop: string; skyBottom: string; nightTop: string; nightBottom: string; fog: string;
  ground: string; groundEdge: string; building: string; decor: 'city' | 'neon' | 'industrial' | 'jungle' | 'ice';
  sun: string;
}
export const WORLDS: World[] = [
  { id: 'rooftop', name: 'Sunset Rooftops', accent: '#FFB800', accent2: '#FF6A3D', skyTop: '#2b3a8f', skyBottom: '#ff9a5a', nightTop: '#0b0e2a', nightBottom: '#5a2a6a', fog: '#e8866a', ground: '#4a4f63', groundEdge: '#FFB800', building: '#2a2f45', decor: 'city', sun: '#ffd6a0' },
  { id: 'neon', name: 'Neon City', accent: '#00F0FF', accent2: '#FF2E9E', skyTop: '#07091c', skyBottom: '#3a1060', nightTop: '#030410', nightBottom: '#1a0a3a', fog: '#2a1050', ground: '#1a1d33', groundEdge: '#00F0FF', building: '#12162B', decor: 'neon', sun: '#b0a0ff' },
  { id: 'industrial', name: 'Rust Works', accent: '#FF7A1A', accent2: '#FFD23F', skyTop: '#3b2a2a', skyBottom: '#c77a43', nightTop: '#140c0c', nightBottom: '#4a2618', fog: '#a0603a', ground: '#51443c', groundEdge: '#FF7A1A', building: '#3a2e28', decor: 'industrial', sun: '#ffc080' },
  { id: 'jungle', name: 'Jungle Ruins', accent: '#2EE6A6', accent2: '#FFE066', skyTop: '#1f6f78', skyBottom: '#bfe8b0', nightTop: '#06201f', nightBottom: '#1a4a3a', fog: '#7fbf9a', ground: '#6d6a52', groundEdge: '#2EE6A6', building: '#3f5a3a', decor: 'jungle', sun: '#fff4c0' },
  { id: 'ice', name: 'Ice Peak', accent: '#9FE8FF', accent2: '#FFFFFF', skyTop: '#4a78c8', skyBottom: '#dff4ff', nightTop: '#0a1636', nightBottom: '#3a5a8a', fog: '#c8e6ff', ground: '#dfefff', groundEdge: '#9FE8FF', building: '#a8c8e8', decor: 'ice', sun: '#ffffff' },
];
export const worldForLevel = (n: number) => WORLDS[Math.floor((Math.max(1, n) - 1) / 10) % WORLDS.length];
export const zoneForLevel = (n: number) => Math.floor((Math.max(1, n) - 1) / 10);

// ---------------- Achievements ----------------
export interface Achievement { id: string; name: string; desc: string; stat: string; goal: number; coins: number; gems: number; }
const ach = (id: string, name: string, desc: string, stat: string, goal: number, coins: number, gems = 0): Achievement => ({ id, name, desc, stat, goal, coins, gems });
export const ACHIEVEMENTS: Achievement[] = [
  ach('first_run', 'First Steps', 'Complete your first run', 'runs', 1, 100),
  ach('clear1', 'Rooftop Rookie', 'Clear 1 level', 'levelsCleared', 1, 150),
  ach('clear10', 'Skyline Climber', 'Clear 10 levels', 'levelsCleared', 10, 500, 10),
  ach('clear25', 'City Conqueror', 'Clear 25 levels', 'levelsCleared', 25, 1000, 20),
  ach('clear50', 'Parkour Legend', 'Clear 50 levels', 'levelsCleared', 50, 2500, 50),
  ach('stars10', 'Star Collector', 'Earn 3 stars on 5 levels', 'threeStars', 5, 400, 5),
  ach('stars30', 'Constellation', 'Earn 3 stars on 20 levels', 'threeStars', 20, 1500, 25),
  ach('jump100', 'Hopper', 'Jump 100 times', 'jumps', 100, 200),
  ach('jump2000', 'Gravity Hater', 'Jump 2,000 times', 'jumps', 2000, 1200, 15),
  ach('double200', 'Air Walker', 'Double jump 200 times', 'doubleJumps', 200, 600, 5),
  ach('slide200', 'Low Rider', 'Slide 200 times', 'slides', 200, 500),
  ach('vault100', 'Vault Master', 'Vault 100 walls', 'vaults', 100, 700, 5),
  ach('wallrun50', 'Wall Walker', 'Wall-run 50 times', 'wallRuns', 50, 500, 5),
  ach('wallrun500', 'Spider Sense', 'Wall-run 500 times', 'wallRuns', 500, 2000, 30),
  ach('walljump50', 'Ricochet', 'Wall-jump 50 times', 'wallJumps', 50, 800, 10),
  ach('ledge50', 'Cliffhanger', 'Grab 50 ledges', 'ledgeGrabs', 50, 800, 10),
  ach('roll50', 'Tuck and Roll', 'Land 50 perfect rolls', 'perfectRolls', 50, 900, 10),
  ach('zip50', 'Zip Addict', 'Ride 50 zip lines', 'ziplines', 50, 800, 10),
  ach('swing50', 'Trapeze Artist', 'Swing on 50 bars', 'swings', 50, 800, 10),
  ach('dash300', 'Blink', 'Dash 300 times', 'dashes', 300, 900, 10),
  ach('drone25', 'Drone Breaker', 'Smash 25 drones with a dash', 'dronesSmashed', 25, 1200, 15),
  ach('spring100', 'Boing', 'Hit 100 spring pads', 'springs', 100, 600, 5),
  ach('combo10', 'Combo Starter', 'Reach a x10 combo', 'bestCombo', 10, 300),
  ach('combo25', 'Flow State', 'Reach a x25 combo', 'bestCombo', 25, 1200, 20),
  ach('combo50', 'Unstoppable', 'Reach a x50 combo', 'bestCombo', 50, 3000, 50),
  ach('coins5k', 'Pocket Change', 'Collect 5,000 coins', 'coins', 5000, 500),
  ach('coins50k', 'Coin Hoarder', 'Collect 50,000 coins', 'coins', 50000, 3000, 30),
  ach('tokens30', 'Treasure Hunter', 'Find 30 golden tokens', 'tokens', 30, 1500, 20),
  ach('dist10k', 'Marathoner', 'Run 10,000 m total', 'distance', 10000, 800, 5),
  ach('dist100k', 'Ultra Runner', 'Run 100,000 m total', 'distance', 100000, 4000, 50),
  ach('endless1k', 'Endless Spirit', 'Reach 1,000 m in Endless', 'endlessBest', 1000, 1000, 10),
  ach('endless5k', 'Infinity Runner', 'Reach 5,000 m in Endless', 'endlessBest', 5000, 3000, 40),
  ach('power50', 'Charged Up', 'Collect 50 power-ups', 'powerups', 50, 700, 5),
  ach('chest10', 'Unboxer', 'Open 10 mystery chests', 'chestsOpened', 10, 800, 10),
  ach('level10', 'Seasoned', 'Reach player level 10', 'playerLevel', 10, 1000, 20),
  ach('login7', 'Loyal Runner', 'Log in 7 days', 'loginDays', 7, 700, 15),
];

// ---------------- Daily missions ----------------
export interface MissionTemplate { id: string; text: string; stat: string; amounts: number[]; mode: 'sum' | 'max'; }
export const MISSION_TEMPLATES: MissionTemplate[] = [
  { id: 'wallrun', text: 'Wall-run {n} times', stat: 'wallRuns', amounts: [10, 20, 30], mode: 'sum' },
  { id: 'coins', text: 'Collect {n} coins', stat: 'coins', amounts: [300, 500, 900], mode: 'sum' },
  { id: 'stars', text: 'Finish {n} levels with 3 stars', stat: 'threeStars', amounts: [1, 2, 3], mode: 'sum' },
  { id: 'combo', text: 'Get a x{n} combo', stat: 'bestCombo', amounts: [6, 10, 15], mode: 'max' },
  { id: 'jumps', text: 'Jump {n} times', stat: 'jumps', amounts: [50, 100, 150], mode: 'sum' },
  { id: 'vaults', text: 'Vault {n} walls', stat: 'vaults', amounts: [10, 20, 35], mode: 'sum' },
  { id: 'slides', text: 'Slide {n} times', stat: 'slides', amounts: [15, 30, 50], mode: 'sum' },
  { id: 'rolls', text: 'Land {n} perfect rolls', stat: 'perfectRolls', amounts: [3, 6, 10], mode: 'sum' },
  { id: 'dist', text: 'Run {n} m', stat: 'distance', amounts: [1000, 2000, 3500], mode: 'sum' },
  { id: 'clear', text: 'Clear {n} levels', stat: 'levelsCleared', amounts: [2, 3, 5], mode: 'sum' },
  { id: 'zip', text: 'Ride {n} zip lines', stat: 'ziplines', amounts: [3, 6, 10], mode: 'sum' },
  { id: 'dash', text: 'Dash {n} times', stat: 'dashes', amounts: [10, 20, 40], mode: 'sum' },
  { id: 'power', text: 'Collect {n} power-ups', stat: 'powerups', amounts: [3, 6, 10], mode: 'sum' },
  { id: 'tokens', text: 'Find {n} golden tokens', stat: 'tokens', amounts: [1, 3, 5], mode: 'sum' },
];

// ---------------- Rewards ----------------
export interface Reward { coins?: number; gems?: number; chest?: 'common' | 'rare' | 'epic'; item?: string; xp?: number; }
export const LOGIN_REWARDS: Reward[] = [
  { coins: 100 }, { gems: 5 }, { coins: 250 }, { chest: 'common' }, { gems: 15 }, { coins: 500, chest: 'rare' }, { item: 'hat_crown', gems: 25 },
];
export const SPIN_SEGMENTS: { label: string; reward: Reward; color: string }[] = [
  { label: '50', reward: { coins: 50 }, color: '#1f6fff' },
  { label: '5', reward: { gems: 5 }, color: '#b45cff' },
  { label: '150', reward: { coins: 150 }, color: '#ff2e9e' },
  { label: 'CHEST', reward: { chest: 'common' }, color: '#2ee6a6' },
  { label: '300', reward: { coins: 300 }, color: '#ff6a00' },
  { label: '15', reward: { gems: 15 }, color: '#00c2d6' },
  { label: '100', reward: { coins: 100 }, color: '#3b3f9f' },
  { label: '750', reward: { coins: 750 }, color: '#ffb800' },
];
export const XP_PER_TIER = 600;
export const SEASON_TIERS: Reward[] = Array.from({ length: 30 }, (_, i) => {
  const t = i + 1;
  const special: Record<number, Reward> = {
    5: { item: 'emote_bow' }, 8: { item: 'trail_rainbow' }, 10: { chest: 'epic' }, 12: { item: 'hat_horns' },
    16: { item: 'land_shock' }, 20: { item: 'top_gold' }, 25: { item: 'bp_jet' }, 30: { item: 'echo' },
  };
  if (special[t]) return special[t];
  if (t % 3 === 0) return { gems: 10 + t };
  if (t % 4 === 0) return { chest: t > 15 ? 'rare' : 'common' };
  return { coins: 150 + t * 40 };
});
export const CHESTS = {
  common: { name: 'Street Chest', coins: 600, gems: 0, color: '#3b9cff', weights: { Common: 70, Rare: 25, Epic: 5, Legendary: 0 } },
  rare: { name: 'Neon Chest', coins: 0, gems: 40, color: '#b45cff', weights: { Common: 30, Rare: 45, Epic: 20, Legendary: 5 } },
  epic: { name: 'Legend Chest', coins: 0, gems: 110, color: '#ffb800', weights: { Common: 0, Rare: 35, Epic: 45, Legendary: 20 } },
} as const;
export type ChestKind = keyof typeof CHESTS;
export const GEM_TO_COIN_PACKS = [
  { gems: 10, coins: 800 }, { gems: 25, coins: 2200 }, { gems: 60, coins: 6000 },
];
export const xpForLevel = (lvl: number) => 300 + lvl * 150;
export const levelUpReward = (lvl: number): Reward => (lvl % 5 === 0 ? { gems: 20, chest: 'rare' } : { coins: 200 + lvl * 50, gems: 3 });
