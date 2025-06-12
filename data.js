'use strict';

const FACTIONS = {
    PIRATE: 'Pirate',
    SAMA: 'Sama',
    NEUTRAL: 'Neutral',
};

// Visible outline colors for each faction
const FACTION_OUTLINE_COLORS = {
    [FACTIONS.PIRATE]: '#ff4d4d',   // bright red for pirates
    [FACTIONS.SAMA]: '#4dffd4',    // cyan/green for Sama forces
    [FACTIONS.NEUTRAL]: '#cccccc', // neutral grey for others
};

// Starting relations between major factions
const INITIAL_FACTION_RELATIONS = {
    [FACTIONS.PIRATE]: { [FACTIONS.SAMA]: -50, [FACTIONS.NEUTRAL]: -20 },
    [FACTIONS.SAMA]: { [FACTIONS.PIRATE]: -50, [FACTIONS.NEUTRAL]: 10 },
    [FACTIONS.NEUTRAL]: { [FACTIONS.PIRATE]: -10, [FACTIONS.SAMA]: 10 },
};

// Player starting archetypes
const PLAYER_CLASSES = {
    ENGINEER: {
        name: 'Engineer',
        startingWeapons: ['DRONE_FACTORY'],
        passives: { techXpBonus: 0.25 },
    },
    MERCENARY: {
        name: 'Mercenary',
        startingWeapons: ['CANNON'],
        passives: { creditBonus: 0.2 },
    },
    SMUGGLER: {
        name: 'Smuggler',
        startingWeapons: ['SHARD'],
        passives: { extraUpgradeChoice: true },
    },
};

const BASE_SKILL_TREE = {
    combat: { crit: 0, damage: 0 },
    tech: { hyperspace: 0 },
    utility: { reveal: 0 },
};

// Types of points of interest that can appear in regions
const POI_TYPES = {
    DERELICT: 'Derelict Ship',
    OUTPOST: 'Outpost',
    BLACK_MARKET: 'Black Market',
    TECH_DROP: 'Sama Tech Drop',
    MISSION_DATA: 'Mission Data',
};

const BIOME_TYPES = ['Nebula', 'Void Rift', 'Crystal Zone', 'Asteroid Field'];

function generateMapRegions(width, height) {
    const cols = 6, rows = 6;
    const cellW = Math.floor(width / cols);
    const cellH = Math.floor(height / rows);
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({ x: c * cellW, y: r * cellH, width: cellW, height: cellH });
        }
    }
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    function createPolygon(cell) {
        const segments = 6 + Math.floor(Math.random() * 3);
        const cx = cell.x + cell.width / 2 + (Math.random() - 0.5) * cell.width * 0.2;
        const cy = cell.y + cell.height / 2 + (Math.random() - 0.5) * cell.height * 0.2;
        const points = [];
        for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const rx = (cell.width / 2) * (0.6 + Math.random() * 0.4);
            const ry = (cell.height / 2) * (0.6 + Math.random() * 0.4);
            points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
        }
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return { points, x: minX, y: minY, width: maxX - minX, height: maxY - minY, cx, cy };
    }

    const pirateCount = Math.floor(cells.length * 0.25);
    const samaCount = Math.floor(cells.length * 0.25);
    const regions = [];
    cells.forEach((cell, idx) => {
        const shape = createPolygon(cell);
        let faction, name, color, music;
        const biome = BIOME_TYPES[Math.floor(Math.random()*BIOME_TYPES.length)];
        if (idx < pirateCount) {
            faction = FACTIONS.PIRATE;
            name = 'Pirate Outpost';
            color = '#331f20';
            music = 'pirate_outpost.ogg';
        } else if (idx < pirateCount + samaCount) {
            faction = FACTIONS.SAMA;
            name = 'Sama Enclave';
            color = '#203030';
            music = 'sama_enclave.ogg';
        } else {
            faction = null;
            name = 'Dead Space';
            color = '#222831';
            music = 'dead_space.ogg';
        }
        regions.push({
            ...shape,
            name,
            faction,
            color,
            music,
            biome,
            discovered: false,
            cleared: false,
            pois: [],
            events: [],
        });
    });
    return regions;
}

// Scatter points of interest throughout the generated regions
function populatePOIs(regions) {
    regions.forEach(region => {
        const roll = Math.random();
        if (roll < 0.1) {
            region.pois.push({ type: POI_TYPES.DERELICT, x: region.x + Math.random() * region.width, y: region.y + Math.random() * region.height, collected: false, radius: 12 });
        } else if (roll < 0.15) {
            region.pois.push({ type: POI_TYPES.OUTPOST, x: region.x + Math.random() * region.width, y: region.y + Math.random() * region.height, collected: false, radius: 12 });
        } else if (roll < 0.2) {
            region.pois.push({ type: POI_TYPES.BLACK_MARKET, x: region.x + Math.random() * region.width, y: region.y + Math.random() * region.height, collected: false, radius: 12 });
        }
    });
}


const CONFIG = {
    PLAYER: {
        RADIUS: 12, MAX_HP: 100, SPEED: 1.7, ROTATION_SPEED: 0.08, FRICTION: 0.9, INVINCIBILITY_DURATION: 1000, MAGNET_RADIUS: 120,
        XP_TO_NEXT_LEVEL_BASE: 60, XP_LEVEL_MULTIPLIER: 1.5, BASE_CRIT_CHANCE: 0.05, BASE_CRIT_DAMAGE: 1.5,
        GRAVITY: 100, // Player is a significant gravity source
    },
    PHYSICS: {
        GRAVITY_CONSTANT: 20, // Reduced further to minimize projectile attraction
        VELOCITY_DAMAGE_MODIFIER: 0.05,
    },
    HYPERSPACE: { CHARGE_TIME: 30000, SPEED_MULTIPLIER: 25 },
    ENEMY: {
        // All enemies now have a small amount of gravity and faction assignments
        CHASER: { RADIUS: 10, HP: 20, SPEED: 1.0, DAMAGE: 10, XP: 10, COLOR: '#A0522D', BEHAVIOR: 'chase', GRAVITY: 2, FACTION: FACTIONS.PIRATE },
        SWARMER: { RADIUS: 6, HP: 8, SPEED: 1.5, DAMAGE: 5, XP: 5, COLOR: '#FF4500', BEHAVIOR: 'chase', GRAVITY: 1, FACTION: FACTIONS.PIRATE },
        TANK: { RADIUS: 18, HP: 120, SPEED: 0.6, DAMAGE: 25, XP: 30, COLOR: '#2E8B57', BEHAVIOR: 'chase', GRAVITY: 10, FACTION: FACTIONS.PIRATE },
        SHOOTER: { RADIUS: 11, HP: 25, SPEED: 0.7, DAMAGE: 10, XP: 15, COLOR: '#4682B4', BEHAVIOR: 'shoot', FIRE_RATE: 2500, PREF_DIST: 250, GRAVITY: 3, FACTION: FACTIONS.PIRATE },
        SPLITTER: { RADIUS: 15, HP: 50, SPEED: 0.8, DAMAGE: 20, XP: 20, COLOR: '#DAA520', BEHAVIOR: 'split', SPLIT_COUNT: 3, GRAVITY: 5, FACTION: FACTIONS.PIRATE },
        GRAVITON: { RADIUS: 16, HP: 100, SPEED: 0.5, DAMAGE: 10, XP: 25, COLOR: '#00CED1', BEHAVIOR: 'graviton', GRAVITY: 200, FACTION: FACTIONS.PIRATE }, // Graviton remains a super-source
        CLOAKER: { RADIUS: 9, HP: 25, SPEED: 1.2, DAMAGE: 12, XP: 18, COLOR: '#8A2BE2', BEHAVIOR: 'cloak', CLOAK_DUR: 3000, UNCLOAK_DUR: 2000, GRAVITY: 1, FACTION: FACTIONS.PIRATE },
        HEALER: { RADIUS: 10, HP: 40, SPEED: 0.9, DAMAGE: 5, XP: 20, COLOR: '#DB7093', BEHAVIOR: 'heal', HEAL_RATE: 1000, HEAL_AMOUNT: 5, HEAL_RADIUS: 150, GRAVITY: 2, FACTION: FACTIONS.PIRATE },
        SAMA_TROOP: { RADIUS: 10, HP: 18, SPEED: 1.2, DAMAGE: 8, XP: 8, COLOR: '#D2691E', BEHAVIOR: 'wander', GRAVITY: 2, FACTION: FACTIONS.SAMA },
        SAMA_GUARD: { RADIUS: 12, HP: 30, SPEED: 1.0, DAMAGE: 12, XP: 12, COLOR: '#696969', BEHAVIOR: 'chase', GRAVITY: 2, FACTION: FACTIONS.SAMA },
        SAMA_SNIPER: { RADIUS: 9, HP: 20, SPEED: 0.8, DAMAGE: 15, XP: 15, COLOR: '#F4A460', BEHAVIOR: 'shoot', FIRE_RATE: 2200, PREF_DIST: 350, GRAVITY: 2, FACTION: FACTIONS.SAMA },
        NEUTRAL_TRADER: { RADIUS: 10, HP: 40, SPEED: 0.8, DAMAGE: 0, XP: 0, COLOR: '#cccccc', BEHAVIOR: 'wander', GRAVITY: 1, FACTION: FACTIONS.NEUTRAL, FRIENDLY: true,
            DIALOGUE: [
                { id: 'start', text: 'Greetings traveler. Interested in some goods or work?', choices: ['Trade', 'Job', 'Leave'], next: ['trade', 'mission', 'end'] },
                { id: 'trade', text: 'Take a look.', action: 'openTrade' },
                { id: 'mission', text: 'I need data from a nearby derelict.', action: 'offerMission' },
                { id: 'end', text: 'Safe travels.' }
            ] },
        SAMA_AGENT: { RADIUS: 10, HP: 30, SPEED: 0.9, DAMAGE: 0, XP: 0, COLOR: '#4dffd4', BEHAVIOR: 'wander', GRAVITY: 1, FACTION: FACTIONS.SAMA, FRIENDLY: true,
            DIALOGUE: [
                { id: 'start', text: 'The Sama Empire seeks allies. Will you aid us?', choices: ['Yes', 'No'], next: ['mission', 'end'] },
                { id: 'mission', text: 'Retrieve stolen tech from pirates.', action: 'offerMission' },
                { id: 'end', text: 'Very well.' }
            ] },
        PIRATE_BROKER: { RADIUS: 10, HP: 30, SPEED: 0.9, DAMAGE: 0, XP: 0, COLOR: '#ff4d4d', BEHAVIOR: 'wander', GRAVITY: 1, FACTION: FACTIONS.PIRATE, FRIENDLY: true,
            DIALOGUE: [
                { id: 'start', text: 'Psst, looking for work?', choices: ['What job?', 'Leave'], next: ['mission', 'end'] },
                { id: 'mission', text: 'Sabotage a Sama shipment for us.', action: 'offerMission' },
                { id: 'end', text: 'Maybe next time.' }
            ] },
    },
    MAP: {
        WIDTH: 367200,
        HEIGHT: 367200,
        REGIONS: (() => {
            const regs = generateMapRegions(367200, 367200);
            populatePOIs(regs);
            return regs;
        })(),
    },
    WEAPONS: {
        // All projectiles now have a tiny amount of gravity
        CANNON: { FIRE_RATE: 500, DAMAGE: 10, SPEED: 7, RADIUS: 3, COLOR: '#ffbe0b', GRAVITY: 0.5 },
        SHARD: { FIRE_RATE: 900, DAMAGE: 4, SPEED: 5, RADIUS: 2, COLOR: '#ff006e', GRAVITY: 0.2 },
        ORBITER: { DAMAGE: 15, RADIUS: 6, COLOR: '#5dd39e', ORBIT_RADIUS: 60, ORBIT_SPEED: 0.05, GRAVITY: 1 },
        MISSILE: { FIRE_RATE: 1200, DAMAGE: 25, SPEED: 4, RADIUS: 4, COLOR: '#8338ec', TURN_RATE: 0.1, GRAVITY: 2 },
        BEAM: { DAMAGE_PER_SECOND: 30, RANGE: 300, COLOR: '#fee440', GRAVITY: 0 }, // Beams are instant, no gravity
        MINE: { FIRE_RATE: 2000, DAMAGE: 40, RADIUS: 5, ARM_TIME: 1000, BLAST_RADIUS: 80, COLOR: '#e63946', GRAVITY: 5},
        BLADE: { FIRE_RATE: 700, DAMAGE: 35, RANGE: 50, ARC: Math.PI / 2, DURATION: 100, COLOR: '#a8dadc', GRAVITY: 0 }, // Slashes are instant, no gravity
        RAILGUN: { FIRE_RATE: 1800, DAMAGE: 50, SPEED: 25, RADIUS: 4, WIDTH: 200, COLOR: '#00b4d8', PENETRATION: 3, GRAVITY: 1 },
        CHAIN_LIGHTNING: { FIRE_RATE: 1500, DAMAGE: 20, SPEED: 8, RADIUS: 3, COLOR: '#9d4edd', BOUNCES: 3, RANGE: 400, BOUNCE_RANGE: 120, GRAVITY: 0 }, // Instantaneous jumps
        BLACK_HOLE: { FIRE_RATE: 5000, DAMAGE: 100, SPEED: 2, RADIUS: 10, COLOR: '#3c096c', DURATION: 3000, GRAVITY: 350, EXPLOSION_RADIUS: 120 }, // Black hole remains the ultimate gravity source
        DRONE_FACTORY: { FIRE_RATE: 4000, DRONE_HP: 10, DRONE_DMG: 15, DRONE_SPD: 2.5, DRONE_RADIUS: 5, COLOR: '#ADFF2F', GRAVITY: 4 },
        FORCE_FIELD: { FIRE_RATE: 2500, RADIUS: 150, DURATION: 200, PUSH_FORCE: 25, COLOR: '#ade8f4', GRAVITY: 0 },
        SAMA_PULSE: { FIRE_RATE: 800, DAMAGE: 20, SPEED: 6, RADIUS: 4, COLOR: '#b5838d', GRAVITY: 1 },
    },
    PARTICLE_LIFESPAN: 1000, SPATIAL_GRID_CELL_SIZE: 150, TARGET_FPS: 60,
};

// --- The rest of data.js (weaponUpgradePool, etc.) remains unchanged. ---
const weaponUpgradePool = [
    { id: 'add_cannon', name: 'New Weapon: Basic Cannon', desc: 'Fires a steady stream of projectiles.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new BasicCannon(p)); } },
    { id: 'add_shard_launcher', name: 'New Weapon: Shard Launcher', desc: 'Periodically unleashes a nova of piercing shards.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new ShardLauncher(p)); } },
    { id: 'add_orbiting_shield', name: 'New Weapon: Orbiting Shield', desc: 'Summons a shield that damages enemies on contact.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new OrbitingShield(p)); } },
    { id: 'add_homing_missile', name: 'New Weapon: Homing Missile', desc: 'Launches missiles that seek the nearest enemy.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new HomingMissileLauncher(p)); } },
    { id: 'add_laser_beam', name: 'New Weapon: Laser Beam', desc: 'Fires a continuous beam at the nearest enemy.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new LaserBeam(p)); } },
    { id: 'add_mine_layer', name: 'New Weapon: Mine Layer', desc: 'Drops proximity mines that explode.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new MineLayer(p)); } },
    { id: 'add_kinetic_blade', name: 'New Weapon: Kinetic Blade', desc: 'A short-range energy slash that hits multiple enemies.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new KineticBlade(p)); } },
    { id: 'add_railgun', name: 'New Weapon: Railgun', desc: 'Fires a high-velocity, piercing shot.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new RailgunWeapon(p)); } },
    { id: 'add_chain_lightning', name: 'New Weapon: Chain Lightning', desc: 'Unleashes a bolt that jumps between enemies.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new ChainLightningWeapon(p)); } },
    { id: 'add_black_hole', name: 'New Weapon: Black Hole', desc: 'Launches a singularity that pulls in and destroys foes.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new BlackHoleWeapon(p)); } },
    { id: 'add_drone_factory', name: 'New Weapon: Drone Factory', desc: 'Deploys autonomous drones to attack enemies.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new DroneFactoryWeapon(p)); } },
    { id: 'add_force_field', name: 'New Weapon: Force Field', desc: 'Periodically emits a pulse that pushes enemies away.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new ForceFieldWeapon(p)); } },
    { id: 'add_sama_pulse', name: 'New Weapon: Sama Pulse', desc: 'Powerful shots obtainable only in Sama Space.', tag: 'NEW WEAPON', apply: (p) => { if(p.weapons.length < 8) p.weapons.push(new SamaPulseGun(p)); } },
];
const genericUpgradeTemplates = [
    { name: 'Damage', stat: 'damageMultiplier', base: 0.05, tag: 'OFFENSE', desc: 'Weapon damage' },
    { name: 'Fire Rate', stat: 'fireRateMultiplier', base: 0.04, tag: 'OFFENSE', desc: 'Weapon fire rate' },
    { name: 'Crit Chance', stat: 'critChance', base: 0.03, tag: 'OFFENSE', desc: 'Chance to deal critical hits' },
    { name: 'Crit Damage', stat: 'critDamage', base: 0.10, tag: 'OFFENSE', desc: 'Critical hit damage' },
    { name: 'Projectile Speed', stat: 'projectileSpeedMultiplier', base: 0.08, tag: 'UTILITY', desc: 'Projectile velocity' },
    { name: 'Area of Effect', stat: 'areaMultiplier', base: 0.10, tag: 'UTILITY', desc: 'Weapon area and range' },
    { name: 'Max Hull', stat: 'maxHp', base: 0.15, tag: 'DEFENSE', isHp: true, desc: 'Maximum hull integrity' },
    { name: 'Movement Speed', stat: 'speed', base: 0.05, tag: 'DEFENSE', desc: 'Ship movement speed' },
    { name: 'Magnet Radius', stat: 'magnetRadius', base: 0.15, tag: 'UTILITY', desc: 'Aetherium pickup radius' },
];
const rarityTiers = {
    common: { weight: 10, multi: 1, color: 'common' },
    uncommon: { weight: 6, multi: 1.8, color: 'uncommon' },
    rare: { weight: 3, multi: 3, color: 'rare' },
    epic: { weight: 1, multi: 5, color: 'epic' },
};