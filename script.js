document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const bgMusic = document.getElementById('bg-music');
    let newsPopupTimeout = null;

    const dom = {
        hud: document.getElementById('game-hud'), waveCounter: document.getElementById('wave-counter'), scoreCounter: document.getElementById('score-counter'),
        missionInfo: document.getElementById('mission-info'),
        hpBar: document.getElementById('hp-bar'), hpValue: document.getElementById('hp-value'), xpBar: document.getElementById('xp-bar'),
        hyperBar: document.getElementById('hyper-bar'), hyperValue: document.getElementById('hyper-value'),
        levelValue: document.getElementById('level-value'), overlay: document.getElementById('ui-overlay'), startMenu: document.getElementById('start-menu'),
        levelUpMenu: document.getElementById('level-up-menu'), gameOverMenu: document.getElementById('game-over-menu'),
        upgradeContainer: document.getElementById('upgrade-cards-container'), startButton: document.getElementById('start-button'),
        restartButton: document.getElementById('restart-button'), finalScore: document.getElementById('final-score'), finalWave: document.getElementById('final-wave'),
        minimap: document.getElementById('minimap'), mapOverlay: document.getElementById('map-overlay'), mapCanvas: document.getElementById('map-canvas'),
        hyperspaceOverlay: document.getElementById('hyperspace-overlay'),
        diplomacyOverlay: document.getElementById('diplomacy-overlay'),
        diplomacyTable: document.getElementById('diplomacy-table'),
        closeDiplomacy: document.getElementById('close-diplomacy'),
        classMenu: document.getElementById('class-select-menu'),
        classOptions: document.getElementById('class-options'),
        dialogueOverlay: document.getElementById('dialogue-overlay'),
        dialogueText: document.getElementById('dialogue-text'),
        dialogueChoices: document.getElementById('dialogue-choices'),
        tradeOverlay: document.getElementById('trade-overlay'),
        tradeItems: document.getElementById('trade-items'),
        closeTrade: document.getElementById('close-trade'),
        creditHud: document.getElementById('credit-hud'),
        creditCount: document.getElementById('credit-count'),
        questOverlay: document.getElementById('quest-overlay'),
        questList: document.getElementById('quest-list'),
        closeQuests: document.getElementById('close-quests'),
        controlPanel: document.getElementById('control-panel'),
        closeControl: document.getElementById('close-control-panel'),
        newsOverlay: document.getElementById('news-overlay'),
        newsList: document.getElementById('news-list'),
        skillOverlay: document.getElementById('skill-overlay'),
        skillTreeContent: document.getElementById('skill-tree-content'), // Updated
        statsOverlay: document.getElementById('stats-overlay'),
        statsContent: document.getElementById('stats-content'), // Updated
        modifiersOverlay: document.getElementById('modifiers-overlay'),
        modifiersList: document.getElementById('modifiers-list'),
        newsPopup: document.getElementById('news-popup'),
    };

    let state, musicStarted = false;
    const MINIMAP_VIEW = 30000;
    let mapZoom = 0.25;

    function generateBackground(width, height) {
        const stars = [];
        const planets = [];
        const starColors = ['#ffffff', '#ffe5b4', '#b0e0e6', '#dcdcdc'];
        const planetColors = ['#6c5ce7', '#e17055', '#00b894', '#0984e3', '#fdcb6e'];
        const starCount = 20000;
        const planetCount = 50;
        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.5 + 0.5,
                color: starColors[Math.floor(Math.random() * starColors.length)],
                a: Math.random() * 0.5 + 0.5,
            });
        }
        for (let i = 0; i < planetCount; i++) {
            planets.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 40 + Math.random() * 80,
                color: planetColors[Math.floor(Math.random() * planetColors.length)],
            });
        }
        return { stars, planets };
    }
    function getInitialState() {
        const bg = generateBackground(CONFIG.MAP.WIDTH, CONFIG.MAP.HEIGHT);
        return {
            gameState: 'START', player: null, enemies: [], projectiles: [], xpOrbs: [], particles: [], drones: [], keys: {},
            mouse: { x: 0, y: 0 }, camera: { x: 0, y: 0 }, map: CONFIG.MAP, wave: 0, score: 0, gameTime: 0, lastTime: 0,
            animationFrameId: null, showMap: false, levelUpRegion: null, currentRegion: null,
            hyperspaceCharge: 0, hyperspaceActive: false, stars: bg.stars, planets: bg.planets,
            autoFire: false, events: [], eventTimer: 10000, missions: [], speedBoost: 1,
            newsFeed: [],
            hostileFactions: new Set(),
            factionRelations: JSON.parse(JSON.stringify(INITIAL_FACTION_RELATIONS)),
            skillTree: loadSkillTree(),
            credits: 0,
        };
    }

    function adjustFactionRelation(f1, f2, amount) {
        if (!state.factionRelations[f1] || !state.factionRelations[f2]) return;
        state.factionRelations[f1][f2] = Math.max(-100, Math.min(100, state.factionRelations[f1][f2] + amount));
        state.factionRelations[f2][f1] = Math.max(-100, Math.min(100, state.factionRelations[f2][f1] - amount));
        if (state.factionRelations[f1][f2] <= -60) state.hostileFactions.add(f1);
        if (state.factionRelations[f1][f2] > -30) state.hostileFactions.delete(f1);
        updateDiplomacyUI();
    }

    function loadSkillTree() {
        try { return JSON.parse(localStorage.getItem('skillTree')) || JSON.parse(JSON.stringify(BASE_SKILL_TREE)); } catch { return JSON.parse(JSON.stringify(BASE_SKILL_TREE)); }
    }

    function saveSkillTree(tree) {
        localStorage.setItem('skillTree', JSON.stringify(tree));
    }

    function updateDiplomacyUI() {
        if (!dom.diplomacyTable) return;
        dom.diplomacyTable.innerHTML = '';
        const factions = Object.keys(state.factionRelations);
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        factions.forEach(f => { const th = document.createElement('th'); th.textContent = f; headerRow.appendChild(th); });
        dom.diplomacyTable.appendChild(headerRow);
        factions.forEach(rowFaction => {
            const tr = document.createElement('tr');
            const nameCell = document.createElement('th');
            nameCell.textContent = rowFaction;
            tr.appendChild(nameCell);
            factions.forEach(colFaction => {
                const td = document.createElement('td');
                if (rowFaction === colFaction) { td.textContent = '—'; }
                else { td.textContent = state.factionRelations[rowFaction][colFaction]; }
                tr.appendChild(td);
            });
            dom.diplomacyTable.appendChild(tr);
        });
    }

    function startDialogue(npc) {
        if (!npc.dialogue) return;
        let node = npc.dialogue[0];
        dom.dialogueOverlay.classList.add('visible');
        dom.dialogueOverlay.classList.remove('hidden');
        function showNode(n) {
            dom.dialogueText.textContent = n.text;
            dom.dialogueChoices.innerHTML = '';
            (n.choices || []).forEach((choice, idx) => {
                const btn = document.createElement('button');
                btn.textContent = choice;
                btn.addEventListener('click', () => {
                    const nextKey = n.next[idx];
                    const next = npc.dialogue[nextKey];
                    if (next && !next.action) { showNode(next); return; }
                    dom.dialogueOverlay.classList.add('hidden');
                    if (next && next.action === 'openTrade') openTrade(npc);
                    else if (next && next.action === 'offerMission') offerMission(npc);
                });
                dom.dialogueChoices.appendChild(btn);
            });
            if (!n.choices) {
                const btn = document.createElement('button');
                btn.textContent = 'Close';
                btn.addEventListener('click', () => dom.dialogueOverlay.classList.add('hidden'));
                dom.dialogueChoices.appendChild(btn);
            }
        }
        showNode(node);
    }

    function generateTradeItems() {
        const items = [];
        for (let i = 0; i < 3; i++) {
            let upg;
            if (Math.random() < 0.5) upg = generateProceduralUpgrade();
            else upg = weaponUpgradePool[Math.floor(Math.random()*weaponUpgradePool.length)];
            const rarity = upg.rarity || 'rare';
            const cost = {common:50,uncommon:80,rare:150,epic:300}[rarity] || 100;
            items.push({ ...upg, cost });
        }
        return items;
    }

    function openTrade() {
        dom.tradeItems.innerHTML = '';
        dom.creditCount.textContent = state.credits;
        generateTradeItems().forEach(upg => {
            const div = document.createElement('div');
            div.className = 'trade-item';
            const span = document.createElement('span');
            span.textContent = `${upg.name} - ${upg.cost}c`;
            const btn = document.createElement('button');
            btn.textContent = 'Buy';
            btn.addEventListener('click', () => {
                if (state.credits >= upg.cost) {
                    upg.apply(state.player);
                    state.credits -= upg.cost;
                    dom.creditCount.textContent = state.credits;
                    updateQuestLog();
                    btn.disabled = true;
                }
            });
            div.append(span, btn);
            dom.tradeItems.appendChild(div);
        });
        dom.tradeOverlay.classList.remove('hidden');
        dom.tradeOverlay.classList.add('visible');
    }

    function closeTrade() {
        dom.tradeOverlay.classList.add('hidden');
        dom.tradeOverlay.classList.remove('visible');
    }

    function offerMission(npc) {
        const m = generateMission(npc.faction || FACTIONS.NEUTRAL);
        state.missions.push(m);
        updateQuestLog();
    }

    function updateQuestLog() {
        dom.creditHud.textContent = state.credits;
        dom.questList.innerHTML = '';
        state.missions.forEach(m => {
            const li = document.createElement('li');
            li.textContent = (m.completed ? '[Done] ' : '') + m.description;
            dom.questList.appendChild(li);
        });
    }

    function updateNewsFeed() {
        dom.newsList.innerHTML = '';
        const items = [...state.newsFeed].sort((a, b) => b.timestamp - a.timestamp);
        items.forEach(n => {
            const li = document.createElement('li');
            const time = new Date(n.timestamp).toLocaleTimeString();
            li.innerHTML = `${n.message}<span class="news-time">${time}</span>`;
            li.style.color = n.color || '';
            dom.newsList.appendChild(li);
        });
    }

    function updateSkillViewer() {
        if (!state || !state.skillTree) return;
        let html = '';
        for (const category in state.skillTree) {
            html += `<div class="skill-category"><h3>${category.toUpperCase()}</h3>`;
            for (const skill in state.skillTree[category]) {
                const level = state.skillTree[category][skill];
                html += `<div class="skill-item">
                           <span class="skill-name">${skill}</span>
                           <span class="skill-level">Level ${level}</span>
                         </div>`;
            }
            html += `</div>`;
        }
        dom.skillTreeContent.innerHTML = html;
    }

    function updateStatsView() {
        if (!state || !state.player) return;

        const createStatItem = (label, value) => `
            <div class="stat-item">
                <strong>${label}</strong>
                <span>${value}</span>
            </div>`;

        let html = '';
        html += createStatItem('Level', state.player.level);
        html += createStatItem('Experience', `${state.player.xp.toFixed(0)} / ${state.player.xpToNextLevel.toFixed(0)}`);
        html += createStatItem('Credits', state.credits);
        html += createStatItem('Hull Integrity', `${Math.ceil(state.player.hp)} / ${Math.ceil(state.player.maxHp)}`);
        html += createStatItem('Movement Speed', `${(state.player.speed / CONFIG.PLAYER.SPEED * 100).toFixed(0)}%`);
        html += createStatItem('Magnet Radius', `${(state.player.magnetRadius / CONFIG.PLAYER.MAGNET_RADIUS * 100).toFixed(0)}%`);
        
        dom.statsContent.innerHTML = html;
    }

    function updateModifiersView() {
        if (!state || !state.player) return;
        dom.modifiersList.innerHTML = '';
        const mods = [
            { name: 'Damage Bonus', val: `${((state.player.damageMultiplier - 1) * 100).toFixed(0)}%` },
            { name: 'Fire Rate Bonus', val: `${((state.player.fireRateMultiplier - 1) * 100).toFixed(0)}%` },
            { name: 'Crit Chance', val: `${(state.player.critChance * 100).toFixed(0)}%` },
            { name: 'Crit Damage Bonus', val: `${((state.player.critDamage - CONFIG.PLAYER.BASE_CRIT_DAMAGE) * 100).toFixed(0)}%` },
            { name: 'Projectile Speed', val: `${((state.player.projectileSpeedMultiplier - 1) * 100).toFixed(0)}%` },
            { name: 'Area of Effect', val: `${((state.player.areaMultiplier - 1) * 100).toFixed(0)}%` },
        ];
        mods.forEach(m => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="mod-name">${m.name}</span><span class="mod-value">+${m.val}</span>`;
            dom.modifiersList.appendChild(li);
        });
    }

    function toggleControlPanel(force) {
        const show = typeof force === 'boolean' ? force : !dom.controlPanel.classList.contains('visible');
        dom.controlPanel.classList.toggle('visible', show);
    }

    function openApp(id) {
        toggleControlPanel(false);
        const map = {
            diplomacy: dom.diplomacyOverlay,
            quests: dom.questOverlay,
            news: dom.newsOverlay,
            skills: dom.skillOverlay,
            stats: dom.statsOverlay,
            modifiers: dom.modifiersOverlay,
        };
        Object.values(map).forEach(el => {
            el.classList.remove('visible');
        });
        const target = map[id];
        if (!target) return;
        target.classList.add('visible');

        // Update content when opening
        if (id === 'diplomacy') updateDiplomacyUI();
        if (id === 'quests') updateQuestLog();
        if (id === 'news') updateNewsFeed();
        if (id === 'skills') updateSkillViewer();
        if (id === 'stats') updateStatsView();
        if (id === 'modifiers') updateModifiersView();
    }

    class Entity { constructor(x, y, radius) { this.x = x; this.y = y; this.radius = radius; this.vx = 0; this.vy = 0; this.angle = 0; this.gravity = 0; this.mass = 1; this.owner = null; } }

    class Player extends Entity {
        constructor(x, y) {
            super(x, y, CONFIG.PLAYER.RADIUS);
            this.mass = 10;
            this.gravity = CONFIG.PLAYER.GRAVITY;
            this.maxHp = CONFIG.PLAYER.MAX_HP; this.hp = this.maxHp; this.level = 1; this.xp = 0; this.xpToNextLevel = CONFIG.PLAYER.XP_TO_NEXT_LEVEL_BASE;
            this.speed = CONFIG.PLAYER.SPEED; this.rotationSpeed = CONFIG.PLAYER.ROTATION_SPEED; this.friction = CONFIG.PLAYER.FRICTION;
            this.invincible = false; this.invincibleTimer = 0; this.magnetRadius = CONFIG.PLAYER.MAGNET_RADIUS;
            this.weapons = [new BasicCannon(this)];
            this.damageMultiplier = 1.0; this.fireRateMultiplier = 1.0; this.projectileSpeedMultiplier = 1.0;
            this.areaMultiplier = 1.0; this.critChance = CONFIG.PLAYER.BASE_CRIT_CHANCE; this.critDamage = CONFIG.PLAYER.BASE_CRIT_DAMAGE;
        }
        update(dt) {
            // Use all keys as lowercase for consistency
            if (state.hyperspaceActive) {
                const spd = this.speed * (state.speedBoost || 1) * CONFIG.HYPERSPACE.SPEED_MULTIPLIER;
                this.vx = Math.cos(this.angle) * spd;
                this.vy = Math.sin(this.angle) * spd;
            } else {
                let spd = this.speed * (state.speedBoost || 1);
                if (state.keys['w'] || state.keys['arrowup']) { this.vx += Math.cos(this.angle) * spd; this.vy += Math.sin(this.angle) * spd; createThrusterParticles(this); }
                this.vx *= this.friction; this.vy *= this.friction;
                const targetAngle = Math.atan2(state.mouse.y - (this.y - state.camera.y), state.mouse.x - (this.x - state.camera.x));
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                this.angle += angleDiff * this.rotationSpeed * dt;
            }
            this.x += this.vx * dt; this.y += this.vy * dt;
            this.weapons.forEach(w => w.update(dt));
            if (this.invincibleTimer > 0) { this.invincibleTimer -= dt * (1000 / CONFIG.TARGET_FPS); if (this.invincibleTimer <= 0) this.invincible = false; }
            this.x = Math.max(0, Math.min(state.map.WIDTH, this.x));
            this.y = Math.max(0, Math.min(state.map.HEIGHT, this.y));
        }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.fillStyle = this.invincible && Math.floor(this.invincibleTimer / 100) % 2 === 0 ? '#fff' : '#FFD700';
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-5, 0); ctx.lineTo(-10, 10); ctx.closePath();
            ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        takeDamage(amount) {
            if (this.invincible) return; this.hp -= amount; this.invincible = true; this.invincibleTimer = CONFIG.PLAYER.INVINCIBILITY_DURATION;
            createExplosion(this.x, this.y, '#e63946', 10); if (this.hp <= 0) { this.hp = 0; setGameState('GAME_OVER'); }
        }
        addXp(amount) {
            this.xp += amount; if (this.xp >= this.xpToNextLevel) { this.xp -= this.xpToNextLevel; this.level++; this.xpToNextLevel = Math.floor(this.xpToNextLevel * CONFIG.PLAYER.XP_LEVEL_MULTIPLIER); this.hp = this.maxHp; state.levelUpRegion = getRegionFor(this.x, this.y); setGameState('LEVEL_UP'); }
        }
    }

    class Enemy extends Entity {
        constructor(x, y, config) {
            super(x, y, config.RADIUS);
            this.config = config; this.maxHp = config.HP; this.hp = this.maxHp; this.speed = config.SPEED; this.damage = config.DAMAGE; this.xpValue = config.XP;
            this.color = config.COLOR; this.mass = config.RADIUS / 5; this.gravity = config.GRAVITY || 0;
            this.faction = config.FACTION || FACTIONS.NEUTRAL;
            this.behavior = config.BEHAVIOR || 'chase';
            this.friendly = !!config.FRIENDLY;
            this.dialogue = config.DIALOGUE || null;
            this.wanderTimer = 0; this.wanderAngle = Math.random() * Math.PI * 2;
            this.isWave = false; // Added property to distinguish wave enemies
        }
        update(dt) {
            if (this.friendly) return;
            let target = null;
            if (state.hostileFactions.has(this.faction)) {
                target = state.player;
            } else {
                target = this.findTarget();
                if (this.isWave && !target) target = state.player;
            }

            if (target) { // Covers both wave and non-wave if a valid target is found
                const dx = target.x - this.x; const dy = target.y - this.y; const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
            } else { // No target found
                // Non-wave enemies ALWAYS wander if no other faction target. Wave enemies might also wander if player somehow disappears.
                // For non-wave enemies, this.behavior might be 'chase', but they should wander if target is null.
                this.wanderTimer -= dt * (1000 / CONFIG.TARGET_FPS);
                if (this.wanderTimer <= 0) { this.wanderAngle = Math.random() * Math.PI * 2; this.wanderTimer = 1000 + Math.random() * 2000; }
                this.x += Math.cos(this.wanderAngle) * this.speed * 0.5 * dt;
                this.y += Math.sin(this.wanderAngle) * this.speed * 0.5 * dt;
            }
        }
        findTarget() {
            let best = null; let bestDistSq = Infinity;
            for (const e of state.enemies) {
                if (e === this || e.faction === this.faction) continue;
                const dx = e.x - this.x; const dy = e.y - this.y; const distSq = dx * dx + dy * dy;
                if (distSq < bestDistSq && distSq < 90000) { best = e; bestDistSq = distSq; }
            }
            return best;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            if (this.isWave) {
                ctx.strokeStyle = '#FFFF00'; // Bright yellow outline for all wave enemies
                ctx.lineWidth = Math.max(2, this.radius * 0.3);
                ctx.stroke();
            } else {
                const outline = FACTION_OUTLINE_COLORS[this.faction];
                if (outline) {
                    ctx.strokeStyle = outline;
                    ctx.lineWidth = Math.max(2, this.radius * 0.3);
                    ctx.stroke();
                }
            }
        }
        takeDamage(damageInfo) {
            this.hp -= damageInfo.amount;
            if (damageInfo.isCrit) createCritIndicator(this.x, this.y, damageInfo.amount);
            if (damageInfo.attacker instanceof Player) {
                state.hostileFactions.add(this.faction);
                adjustFactionRelation(this.faction, FACTIONS.NEUTRAL, -5);
            }
            if (this.hp <= 0) {
                this.onDeath();
                state.enemies = state.enemies.filter(e => e !== this);
                state.score += this.xpValue * 10;
                state.credits += this.xpValue * 2;
                createExplosion(this.x, this.y, this.color, this.radius);
                state.xpOrbs.push(new XpOrb(this.x, this.y, this.xpValue));
            }
        }
        onDeath() {}
        static create(config, x, y) {
            switch (config.BEHAVIOR) {
                case 'shoot': return new ShooterEnemy(x, y, config);
                case 'split': return new SplitterEnemy(x, y, config);
                case 'graviton': return new GravitonEnemy(x, y, config);
                case 'cloak': return new CloakerEnemy(x, y, config);
                case 'heal': return new HealerEnemy(x, y, config);
                default: return new Enemy(x, y, config);
            }
        }
    }
    class ShooterEnemy extends Enemy {
        constructor(x, y, config) { super(x, y, config); this.fireCooldown = config.FIRE_RATE; }
        update(dt) {
            let target = this.findTarget(); // Prioritizes other factions
            let firingTarget = null; // Separate target for firing decision
            let movementTarget = null; // Separate target for movement decision

            if (this.isWave) {
                // Wave enemies can target player for movement and firing if no other faction target
                movementTarget = target || state.player;
                firingTarget = target || state.player;
            } else {
                // Non-wave enemies only target other factions for movement and firing
                movementTarget = target;
                firingTarget = target;
            }

            if (movementTarget) {
                const dx = movementTarget.x - this.x; const dy = movementTarget.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy); const prefer = this.config.PREF_DIST;
                if (dist > prefer) {
                    const spd = this.speed * Math.min(1, (dist - prefer) / prefer);
                    this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt;
                } else if (dist < prefer * 0.8) {
                    const spd = this.speed * Math.min(1, (prefer * 0.8 - dist) / prefer);
                    this.x -= (dx / dist) * spd * dt; this.y -= (dy / dist) * spd * dt;
                }
            } else { // No movement target (either non-wave with no faction target, or wave with no target at all)
                this.wanderTimer -= dt * (1000 / CONFIG.TARGET_FPS);
                if (this.wanderTimer <= 0) { this.wanderAngle = Math.random() * Math.PI * 2; this.wanderTimer = 1000 + Math.random() * 2000; }
                this.x += Math.cos(this.wanderAngle) * this.speed * 0.5 * dt;
                this.y += Math.sin(this.wanderAngle) * this.speed * 0.5 * dt;
            }

            this.fireCooldown -= dt * (1000 / CONFIG.TARGET_FPS);
            if (this.fireCooldown <= 0 && firingTarget) { // Firing only if there's a valid firingTarget
                const angle = Math.atan2(firingTarget.y - this.y, firingTarget.x - this.x);
                state.projectiles.push(new EnemyProjectile(this.x, this.y, angle, { ...this.config, SPEED: 3, RADIUS: 4, DAMAGE: this.damage }, this));
                this.fireCooldown = this.config.FIRE_RATE;
            }
        }
    }
    class SplitterEnemy extends Enemy {
        onDeath() { for (let i = 0; i < this.config.SPLIT_COUNT; i++) { state.enemies.push(Enemy.create(CONFIG.ENEMY.SWARMER, this.x + (Math.random()-0.5)*10, this.y + (Math.random()-0.5)*10)); } }
    }
    class GravitonEnemy extends Enemy { constructor(x, y, config) { super(x, y, config); this.gravity = config.GRAVITY; } }
    class CloakerEnemy extends Enemy {
        constructor(x, y, config) { super(x, y, config); this.cloaked = false; this.cloakTimer = Math.random() * config.CLOAK_DUR; }
        update(dt) {
            super.update(dt);
            this.cloakTimer -= dt * (1000/CONFIG.TARGET_FPS);
            if (this.cloakTimer <= 0) {
                if (this.cloaked) {
                    // Uncloak behind player
                    const a = state.player.angle + Math.PI;
                    this.x = state.player.x + Math.cos(a) * 40;
                    this.y = state.player.y + Math.sin(a) * 40;
                }
                this.cloaked = !this.cloaked;
                this.cloakTimer = this.cloaked ? this.config.CLOAK_DUR : this.config.UNCLOAK_DUR;
            }
            if (this.cloaked) {
                const dx = state.player.x - this.x; const dy = state.player.y - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                this.x += (dx/dist) * this.speed * 1.5 * dt;
                this.y += (dy/dist) * this.speed * 1.5 * dt;
            }
        }
        draw() { ctx.globalAlpha = this.cloaked ? 0.3 : 1.0; super.draw(); ctx.globalAlpha = 1.0; }
    }
    class HealerEnemy extends Enemy {
        constructor(x, y, config) { super(x, y, config); this.healCooldown = config.HEAL_RATE; }
        update(dt) {
            super.update(dt);
            this.healCooldown -= dt * (1000/CONFIG.TARGET_FPS);
            if (this.healCooldown <= 0) {
                for (const other of state.enemies) {
                    if (other === this || other.hp >= other.maxHp) continue;
                    const distSq = (this.x - other.x)**2 + (this.y - other.y)**2;
                    if (distSq < this.config.HEAL_RADIUS**2) { other.hp = Math.min(other.maxHp, other.hp + this.config.HEAL_AMOUNT); createHealParticle(other.x, other.y); }
                }
                this.healCooldown = this.config.HEAL_RATE;
            }
        }
    }

    class Projectile extends Entity {
        constructor(x, y, angle, config, owner) {
            super(x, y, config.RADIUS);
            this.owner = owner || null;
            this.config = config; this.damage = config.DAMAGE; this.color = config.COLOR;
            const speed = (config.SPEED || 0) * ((owner && owner.projectileSpeedMultiplier) || 1);
            this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
            this.lifespan = 2000;
            this.mass = config.RADIUS / 4; this.gravity = config.GRAVITY || 0;
        }
        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.lifespan -= dt * (1000 / CONFIG.TARGET_FPS); if (this.lifespan <= 0) { this.destroy(); } }
        draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
        getDamage() {
            let isCrit = false;
            let amount = this.damage;
            if (this.owner instanceof Player) {
                isCrit = Math.random() < (this.owner.critChance || 0);
                amount = amount * (this.owner.damageMultiplier || 1);
            }
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            amount *= (1 + speed * CONFIG.PHYSICS.VELOCITY_DAMAGE_MODIFIER);
            if (isCrit && this.owner && this.owner.critDamage) { amount *= this.owner.critDamage; }
            if (isNaN(amount) || !isFinite(amount)) amount = this.damage || 1; // Security: fallback if NaN
            return { amount, isCrit, attacker: this.owner };
        }
        destroy() { state.projectiles = state.projectiles.filter(p => p !== this); }
    }
    class EnemyProjectile extends Projectile {
        constructor(x, y, angle, config, owner) {
            super(x, y, angle !== undefined ? angle : 0, config, owner || null);
        }
        getDamage() { return { amount: this.damage, isCrit: false, attacker: this.owner }; }
    }
    class XpOrb extends Entity {
        constructor(x, y, value) { super(x, y, 4); this.value = value; this.friction = 0.95; this.age = 0; this.lifespan = 10000; }
        update(dt) {
            this.age += dt * (1000 / CONFIG.TARGET_FPS);
            const player = state.player;
            const dx = player.x - this.x; const dy = player.y - this.y; const distSq = dx * dx + dy * dy;
            if (distSq < player.magnetRadius * player.magnetRadius) {
                const dist = Math.sqrt(distSq); this.vx += (dx / dist) * 10; this.vy += (dy / dist) * 10;
            }
            this.vx *= this.friction; this.vy *= this.friction;
            this.x += this.vx * dt; this.y += this.vy * dt;
        }
        draw() {
            ctx.fillStyle = '#4f8dff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
        }
    }
    class Particle {
        constructor(x, y, vx, vy, lifespan, color, size) {
            this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.lifespan = lifespan; this.initialLifespan = lifespan; this.color = color; this.size = size;
        }
        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.lifespan -= dt * (1000 / CONFIG.TARGET_FPS); }
        draw() { ctx.globalAlpha = this.lifespan / this.initialLifespan; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
    }
    class Drone extends Entity {
        constructor(x, y, config, owner) {
            super(x, y, config.DRONE_RADIUS);
            this.owner = owner; this.config = config; this.hp = config.DRONE_HP; this.target = null;
            this.mass = 5; this.gravity = config.GRAVITY || 0;
        }
        update(dt) {
            if (!this.target || this.target.hp <= 0) {
                if (state.enemies.length > 0) {
                    this.target = state.enemies.reduce((closest, enemy) => {
                        const dCurr = (enemy.x-this.x)**2 + (enemy.y-this.y)**2;
                        if (!closest) return enemy;
                        const dBest = (closest.x-this.x)**2 + (closest.y-this.y)**2;
                        return dCurr < dBest ? enemy : closest;
                    }, null);
                } else {
                    this.target = null;
                }
            }
            if (this.target) {
                const dx = this.target.x - this.x; const dy = this.target.y - this.y; const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) { this.vx = (dx/dist) * this.config.DRONE_SPD; this.vy = (dy/dist) * this.config.DRONE_SPD; }
            } else {
                this.vx = 0; this.vy = 0;
            }
            this.x += this.vx * dt; this.y += this.vy * dt;
        }
        draw() { ctx.fillStyle = this.config.COLOR; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
        takeDamage() { state.drones = state.drones.filter(d => d !== this); }
    }

    // --- WEAPON & PROJECTILE CLASSES ---
    class Weapon {
        constructor(owner) { this.owner = owner; this.level = 1; this.fireRate = 500; this.fireCooldown = 0; }
        update(dt) {
            this.fireCooldown -= dt * (1000 / CONFIG.TARGET_FPS) * this.owner.fireRateMultiplier;
            if (this.fireCooldown <= 0) {
                if (state.autoFire) this.fire();
                this.fireCooldown = this.fireRate;
            }
        }
        fire() {}
    }
    class BasicCannon extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.CANNON }; this.fireRate = this.config.FIRE_RATE; this.projectiles = 1; } fire() { const spread = 0.3; for (let i = 0; i < this.projectiles && state.projectiles.length < 1000; i++) { const angle = this.owner.angle + (i - (this.projectiles - 1) / 2) * spread; state.projectiles.push(new Projectile(this.owner.x, this.owner.y, angle, this.config, this.owner)); } } }
    class ShardLauncher extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.SHARD }; this.fireRate = this.config.FIRE_RATE; this.shards = 8; } fire() { for (let i = 0; i < this.shards && state.projectiles.length < 1000; i++) { const angle = (i / this.shards) * Math.PI * 2 + state.gameTime / 1000; state.projectiles.push(new Projectile(this.owner.x, this.owner.y, angle, this.config, this.owner)); } } }
    class OrbitingShield extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.ORBITER }; this.fireRate = 999999; this.orbs = []; this.addOrb(); } addOrb() { const orb = new Projectile(0, 0, 0, this.config, this.owner); orb.lifespan = Infinity; orb.isOrbiter = true; this.orbs.push(orb); state.projectiles.push(orb); } update(dt) { const orbitRadius = this.config.ORBIT_RADIUS * this.owner.areaMultiplier; const orbitSpeed = this.config.ORBIT_SPEED; this.orbs.forEach((orb, i) => { const angle = state.gameTime * orbitSpeed * dt + (i / this.orbs.length) * Math.PI * 2; orb.x = this.owner.x + Math.cos(angle) * orbitRadius; orb.y = this.owner.y + Math.sin(angle) * orbitRadius; }); } }
    class HomingMissile extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.target = null; }
        update(dt) {
            if (!this.target || this.target.hp <= 0) {
                if (state.enemies.length > 0) {
                    this.target = state.enemies.reduce((closest, enemy) => {
                        const dCurr = (enemy.x-this.x)**2 + (enemy.y-this.y)**2;
                        if (!closest) return enemy;
                        const dBest = (closest.x-this.x)**2 + (closest.y-this.y)**2;
                        return dCurr < dBest ? enemy : closest;
                    }, null);
                } else {
                    this.target = null;
                }
            }
            if (this.target) {
                const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                const currentAngle = Math.atan2(this.vy, this.vx);
                let angleDiff = targetAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.config.TURN_RATE * dt);
                const speed = this.config.SPEED * (this.owner ? this.owner.projectileSpeedMultiplier : 1);
                this.vx = Math.cos(newAngle) * speed; this.vy = Math.sin(newAngle) * speed;
            }
            this.x += this.vx * dt; this.y += this.vy * dt;
            this.lifespan -= dt * (1000 / CONFIG.TARGET_FPS); if (this.lifespan <= 0) this.destroy();
        }
    }
    class HomingMissileLauncher extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.MISSILE }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new HomingMissile(this.owner.x, this.owner.y, this.owner.angle, this.config, this.owner)); } }
    class LaserBeam extends Weapon {
        constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.BEAM }; this.fireRate = 100; this.target = null; }
        fire() {
            this.target = state.enemies.length ? state.enemies.reduce((closest, enemy) => {
                const dCurr = (enemy.x-this.owner.x)**2 + (enemy.y-this.owner.y)**2;
                if (!closest) return enemy;
                const dBest = (closest.x-this.owner.x)**2 + (closest.y-this.owner.y)**2;
                return dCurr < dBest ? enemy : closest;
            }, null) : null;
            if (this.target) {
                const dx = this.target.x - this.owner.x; const dy = this.target.y - this.owner.y;
                if (dx*dx + dy*dy < (this.config.RANGE * this.owner.areaMultiplier)**2) {
                    const damageInfo = {amount: this.config.DAMAGE_PER_SECOND / (CONFIG.TARGET_FPS / this.owner.fireRateMultiplier) * this.owner.damageMultiplier, isCrit: false};
                    this.target.takeDamage(damageInfo);
                    createBeamParticle(this.owner.x, this.owner.y, this.target.x, this.target.y, this.config.COLOR);
                }
            }
        }
    }
    class Mine extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.vx = 0; this.vy = 0; this.lifespan = 10000; this.armed = false; this.armTimer = this.config.ARM_TIME; }
        update(dt) { if (!this.armed) { this.armTimer -= dt * (1000/CONFIG.TARGET_FPS); if (this.armTimer <= 0) this.armed = true; } if (this.armed) { for (const enemy of state.enemies) { if ((enemy.x-this.x)**2+(enemy.y-this.y)**2 < (this.config.BLAST_RADIUS * (this.owner ? this.owner.areaMultiplier : 1))**2) { this.explode(); break; } } } super.update(dt); }
        draw() { ctx.fillStyle = this.armed ? this.color : '#aaa'; ctx.beginPath(); ctx.rect(this.x-this.radius, this.y-this.radius, this.radius*2, this.radius*2); ctx.fill(); }
        explode() { createExplosion(this.x, this.y, this.color, this.config.BLAST_RADIUS/2); for (const enemy of state.enemies) { if ((enemy.x-this.x)**2+(enemy.y-this.y)**2 < (this.config.BLAST_RADIUS*(this.owner ? this.owner.areaMultiplier : 1))**2) { enemy.takeDamage(this.getDamage()); } } this.destroy(); }
    }
    class MineLayer extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.MINE }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new Mine(this.owner.x, this.owner.y, 0, this.config, this.owner)); } }
    class KineticSlash extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.lifespan = this.config.DURATION; this.vx = 0; this.vy = 0; this.hitEnemies = new Set(); }
        update(dt) {
            this.lifespan -= dt * (1000 / CONFIG.TARGET_FPS); if (this.lifespan <= 0) this.destroy();
            for (const enemy of state.enemies) {
                if (this.hitEnemies.has(enemy)) continue;
                const dx = enemy.x - this.owner.x; const dy = enemy.y - this.owner.y; const distSq = dx*dx + dy*dy;
                if (distSq < (this.config.RANGE * (this.owner ? this.owner.areaMultiplier : 1))**2) {
                    let angleToEnemy = Math.atan2(dy, dx); let ownerAngle = this.owner.angle;
                    let angleDiff = angleToEnemy - ownerAngle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    if (Math.abs(angleDiff) < this.config.ARC/2) { enemy.takeDamage(this.getDamage()); this.hitEnemies.add(enemy); }
                }
            }
        }
        draw() { ctx.save(); ctx.translate(this.owner.x, this.owner.y); ctx.rotate(this.owner.angle); ctx.fillStyle = this.color; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, this.config.RANGE * (this.owner ? this.owner.areaMultiplier : 1), -this.config.ARC/2, this.config.ARC/2); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    class KineticBlade extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.BLADE }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new KineticSlash(this.owner.x, this.owner.y, 0, this.config, this.owner)); } }

    class RailgunProjectile extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.penetration = config.PENETRATION; this.lifespan = 500; this.hitEnemies = new Set(); }
        draw() { ctx.save(); ctx.strokeStyle = this.color; ctx.lineWidth = this.radius * 2; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(this.x - this.vx/this.config.SPEED * this.config.WIDTH/2, this.y - this.vy/this.config.SPEED * this.config.WIDTH/2); ctx.lineTo(this.x + this.vx/this.config.SPEED * this.config.WIDTH/2, this.y + this.vy/this.config.SPEED * this.config.WIDTH/2); ctx.stroke(); ctx.restore(); }
    }
    class RailgunWeapon extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.RAILGUN }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new RailgunProjectile(this.owner.x, this.owner.y, this.owner.angle, this.config, this.owner)); } }

    class ChainLightningProjectile extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.bounces = config.BOUNCES; this.bounceRange = config.BOUNCE_RANGE; this.hitEnemies = new Set(); }
        onHit(enemy) {
            this.hitEnemies.add(enemy); this.bounces--;
            if (this.bounces > 0) {
                const nextTarget = state.enemies.filter(e => !this.hitEnemies.has(e) && (e.x-this.x)**2 + (e.y-this.y)**2 < (this.bounceRange * (this.owner ? this.owner.areaMultiplier : 1))**2).sort((a,b) => (a.x-this.x)**2+(a.y-this.y)**2 - (b.x-this.x)**2+(b.y-this.y)**2)[0];
                if (nextTarget) {
                    createBeamParticle(this.x, this.y, nextTarget.x, nextTarget.y, this.color);
                    this.x = nextTarget.x; this.y = nextTarget.y;
                    nextTarget.takeDamage(this.getDamage()); this.onHit(nextTarget);
                } else { this.destroy(); }
            } else { this.destroy(); }
        }
    }
    class ChainLightningWeapon extends Weapon {
        constructor(owner) {
            super(owner);
            this.config = { ...CONFIG.WEAPONS.CHAIN_LIGHTNING };
            this.fireRate = this.config.FIRE_RATE;
        }
        fire() {
            if (!state.enemies.length) return;
            const rangeSq = (this.config.RANGE || 0) ** 2;
            const inRange = state.enemies
                .filter(e => (e.x - this.owner.x) ** 2 + (e.y - this.owner.y) ** 2 <= rangeSq);
            if (!inRange.length) return;
            const nearestEnemy = inRange.reduce((closest, enemy) => {
                const dCurr = (enemy.x - this.owner.x) ** 2 + (enemy.y - this.owner.y) ** 2;
                if (!closest) return enemy;
                const dBest = (closest.x - this.owner.x) ** 2 + (closest.y - this.owner.y) ** 2;
                return dCurr < dBest ? enemy : closest;
            }, null);
            if (nearestEnemy) {
                const p = new ChainLightningProjectile(nearestEnemy.x, nearestEnemy.y, 0, this.config, this.owner);
                createBeamParticle(this.owner.x, this.owner.y, nearestEnemy.x, nearestEnemy.y, this.config.COLOR);
                nearestEnemy.takeDamage(p.getDamage());
                p.onHit(nearestEnemy);
            }
        }
    }

    class BlackHoleProjectile extends Projectile {
        constructor(x, y, angle, config, owner) { super(x, y, angle, config, owner); this.lifespan = config.DURATION; this.gravity = config.GRAVITY; this.hitEnemies = new Set(); }
        update(dt) { super.update(dt); if (this.lifespan <= 0) this.explode(); }
        explode() {
            const blastRadius = this.config.EXPLOSION_RADIUS * (this.owner ? this.owner.areaMultiplier : 1);
            createExplosion(this.x, this.y, this.color, blastRadius);
            for (const enemy of state.enemies) { if ((enemy.x-this.x)**2+(enemy.y-this.y)**2 < blastRadius**2) { enemy.takeDamage(this.getDamage()); } }
            this.destroy();
        }
        draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * (1 + (this.config.DURATION - this.lifespan)/this.config.DURATION), 0, Math.PI * 2); ctx.fill(); }
    }
    class BlackHoleWeapon extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.BLACK_HOLE }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new BlackHoleProjectile(this.owner.x, this.owner.y, this.owner.angle, this.config, this.owner)); } }

    class DroneFactoryWeapon extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.DRONE_FACTORY }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.drones.length < 5) state.drones.push(new Drone(this.owner.x, this.owner.y, this.config, this.owner)); } }

    class ForcePulseProjectile extends Projectile {
        constructor(x, y, config, owner) { super(x, y, 0, config, owner); this.lifespan = config.DURATION; this.hitEnemies = new Set(); }
        update(dt) { this.lifespan -= dt * (1000 / CONFIG.TARGET_FPS); if (this.lifespan <= 0) this.destroy(); this.radius = this.config.RADIUS * (this.owner ? this.owner.areaMultiplier : 1) * (1 - this.lifespan/this.config.DURATION); }
        draw() { ctx.strokeStyle = this.color; ctx.lineWidth = 4; ctx.globalAlpha = this.lifespan/this.config.DURATION; ctx.beginPath(); ctx.arc(this.owner.x, this.owner.y, this.radius, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    class ForceFieldWeapon extends Weapon { constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.FORCE_FIELD }; this.fireRate = this.config.FIRE_RATE; } fire() { if (state.projectiles.length < 1000) state.projectiles.push(new ForcePulseProjectile(this.owner.x, this.owner.y, this.config, this.owner)); } }

    class SamaPulseGun extends Weapon {
        constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.SAMA_PULSE }; this.fireRate = this.config.FIRE_RATE; }
        fire() { if (state.projectiles.length < 1000) state.projectiles.push(new Projectile(this.owner.x, this.owner.y, this.owner.angle, this.config, this.owner)); }
    }

    const weaponConstructors = new Map([
        ['add_cannon', BasicCannon],
        ['add_shard_launcher', ShardLauncher],
        ['add_orbiting_shield', OrbitingShield],
        ['add_homing_missile', HomingMissileLauncher],
        ['add_laser_beam', LaserBeam],
        ['add_mine_layer', MineLayer],
        ['add_kinetic_blade', KineticBlade],
        ['add_railgun', RailgunWeapon],
        ['add_chain_lightning', ChainLightningWeapon],
        ['add_black_hole', BlackHoleWeapon],
        ['add_drone_factory', DroneFactoryWeapon],
        ['add_force_field', ForceFieldWeapon],
        ['add_sama_pulse', SamaPulseGun],
    ]);

    const weaponNameMap = {
        CANNON: BasicCannon,
        SHARD: ShardLauncher,
        ORBITER: OrbitingShield,
        MISSILE: HomingMissileLauncher,
        BEAM: LaserBeam,
        MINE: MineLayer,
        BLADE: KineticBlade,
        RAILGUN: RailgunWeapon,
        CHAIN_LIGHTNING: ChainLightningWeapon,
        BLACK_HOLE: BlackHoleWeapon,
        DRONE_FACTORY: DroneFactoryWeapon,
        FORCE_FIELD: ForceFieldWeapon,
        SAMA_PULSE: SamaPulseGun,
    };

    function weaponNameToClass(name) {
        return weaponNameMap[name];
    }

    function generateProceduralUpgrade() {
        const totalWeight = Object.values(rarityTiers).reduce((sum, tier) => sum + tier.weight, 0);
        let roll = Math.random() * totalWeight;
        let selectedRarity;
        for (const tier in rarityTiers) { if (roll <= rarityTiers[tier].weight) { selectedRarity = rarityTiers[tier]; break; } roll -= rarityTiers[tier].weight; }
        const template = genericUpgradeTemplates[Math.floor(Math.random() * genericUpgradeTemplates.length)];
        const value = template.base * selectedRarity.multi;
        return {
            isProcedural: true,
            name: `${template.name} +${(value * 100).toFixed(0)}%`,
            desc: `${template.desc} increased by ${(value * 100).toFixed(0)}%.`,
            tag: template.tag,
            rarity: selectedRarity.color,
            apply: (p) => {
                if (template.isHp) {
                    p.maxHp *= (1 + value);
                    p.hp += p.maxHp * value;
                } else {
                    p[template.stat] += value;
                }
            }
        };
    }
    function getUpgradeChoices() {
        const choices = [];
        const player = state.player;
        const maxWeapons = 8;
        const weaponChoices = player.weapons.length < maxWeapons ? weaponUpgradePool.slice() : [];
        if (player.weapons.length < maxWeapons && state.levelUpRegion && state.levelUpRegion.faction === FACTIONS.SAMA) {
            const sama = weaponUpgradePool.find(w => w.id === 'add_sama_pulse');
            if (sama) weaponChoices.push(sama);
        }
        let weaponCount = 0;
        if (weaponChoices.length) {
            const first = weaponChoices.splice(Math.floor(Math.random() * weaponChoices.length), 1)[0];
            choices.push(first);
            weaponCount = 1;
        }
        while (choices.length < 4) {
            let pick = null;
            if (weaponCount < 2 && Math.random() < 0.5 && weaponChoices.length > 0) {
                const remaining = weaponChoices.filter(w => !choices.includes(w));
                if (remaining.length) {
                    pick = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
                    weaponCount++;
                }
            }
            if (!pick) {
                do { pick = generateProceduralUpgrade(); } while (choices.some(c => c.name === pick.name));
            }
            choices.push(pick);
        }
        return choices.sort(() => Math.random() - 0.5);
    }
    function displayUpgradeChoices() {
        dom.upgradeContainer.innerHTML = '';
        getUpgradeChoices().forEach(upgrade => {
            const card = document.createElement('div');
            card.className = `upgrade-card ${upgrade.rarity || 'uncommon'}`;
            const title = document.createElement('h3');
            title.textContent = upgrade.name;
            const desc = document.createElement('p');
            desc.textContent = upgrade.desc;
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = upgrade.tag;
            card.append(title, desc, tag);
            card.onclick = () => selectUpgrade(upgrade);
            dom.upgradeContainer.appendChild(card);
        });
    }
    function selectUpgrade(upgrade) {
        const player = state.player;
        if (upgrade.isProcedural) {
            upgrade.apply(player);
        } else {
            const WeaponClass = weaponConstructors.get(upgrade.id);
            if (WeaponClass && player.weapons.length < 8) {
                player.weapons.push(new WeaponClass(player));
            }
        }
        setGameState('PLAYING');
    }

    function setGameState(newState) {
        state.gameState = newState;
        dom.overlay.classList.toggle('active', newState !== 'PLAYING');
        dom.hud.classList.toggle('hidden', newState !== 'PLAYING');
        dom.startMenu.classList.add('hidden'); dom.levelUpMenu.classList.add('hidden'); dom.gameOverMenu.classList.add('hidden'); dom.classMenu.classList.add('hidden');
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        switch(newState) {
            case 'START': dom.startMenu.classList.remove('hidden'); break;
            case 'PLAYING': resumeGame(); break;
            case 'LEVEL_UP': pauseGame(); displayUpgradeChoices(); dom.levelUpMenu.classList.remove('hidden'); break;
            case 'GAME_OVER': pauseGame(); dom.finalScore.textContent = state.score; dom.finalWave.textContent = state.wave; dom.gameOverMenu.classList.remove('hidden'); saveSkillTree(state.skillTree); break;
        }
    }
    function startGame() {
        dom.startMenu.classList.add('hidden');
        dom.classMenu.classList.remove('hidden');
        dom.classOptions.innerHTML = '';
        Object.entries(PLAYER_CLASSES).forEach(([key, cls]) => {
            const btn = document.createElement('button');
            btn.textContent = cls.name;
            btn.addEventListener('click', () => beginRun(key));
            dom.classOptions.appendChild(btn);
        });
    }

    function beginRun(classKey) {
        if (!musicStarted) { bgMusic.play().catch(e => console.log("Audio couldn't play:", e)); musicStarted = true; }
        const keys = state ? state.keys : {}; const mouse = state ? state.mouse : { x: 0, y: 0 };
        state = getInitialState();
        state.keys = keys;
        state.mouse = mouse;
        const cls = PLAYER_CLASSES[classKey] || PLAYER_CLASSES.ENGINEER;
        state.player = new Player(state.map.WIDTH / 2, state.map.HEIGHT / 2);
        cls.startingWeapons.forEach(w => {
            const WeaponClass = weaponNameToClass(w);
            if (WeaponClass && state.player.weapons.length < 8) state.player.weapons.push(new WeaponClass(state.player));
        });
        state.player.passives = cls.passives;
        state.camera.x = state.player.x - canvas.width / 2;
        state.camera.y = state.player.y - canvas.height / 2;
        const region = getRegionFor(state.player.x, state.player.y);
        state.currentRegion = region;
        if (region) {
            region.discovered = true;
            spawnEnemiesForRegion(region);
            activateRegion(region);
            updateMusic(region);
        }
        state.missions.push(generateMission(FACTIONS.NEUTRAL));
        nextWave();
        dom.classMenu.classList.add('hidden');
        updateDiplomacyUI();
        setGameState('PLAYING');
    }
    function pauseGame() { if (state.animationFrameId) { cancelAnimationFrame(state.animationFrameId); state.animationFrameId = null; } }
    function resumeGame() { if (!state.animationFrameId) { state.lastTime = performance.now(); state.animationFrameId = requestAnimationFrame(gameLoop); } }
    function nextWave() {
        state.wave++;
        const numEnemies = 12 + state.wave * 6;
        const waveEnemyTypes = [CONFIG.ENEMY.CHASER, CONFIG.ENEMY.SWARMER];
        if (state.wave > 1) waveEnemyTypes.push(CONFIG.ENEMY.TANK);
        if (state.wave > 2) waveEnemyTypes.push(CONFIG.ENEMY.SHOOTER);
        if (state.wave > 3) waveEnemyTypes.push(CONFIG.ENEMY.SPLITTER);
        if (state.wave > 4) waveEnemyTypes.push(CONFIG.ENEMY.CLOAKER);
        if (state.wave > 5) waveEnemyTypes.push(CONFIG.ENEMY.GRAVITON);
        if (state.wave > 6) waveEnemyTypes.push(CONFIG.ENEMY.HEALER);
        const spawnRadius = 600;
        for (let i = 0; i < numEnemies; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * spawnRadius;
            const x = state.player.x + Math.cos(angle) * dist;
            const y = state.player.y + Math.sin(angle) * dist;
            const config = waveEnemyTypes[Math.floor(Math.random() * waveEnemyTypes.length)];
            const enemy = Enemy.create(config, x, y);
            enemy.isWave = true;
            state.enemies.push(enemy);
        }
    }

    function spawnEnemiesForRegion(region) {
        if (region.spawned) return;
        region.spawned = true;
        region.enemies = [];
        let configs = [];
        let count = 50;
        if (region.faction === FACTIONS.PIRATE) {
            configs = [CONFIG.ENEMY.CHASER, CONFIG.ENEMY.SWARMER, CONFIG.ENEMY.SHOOTER];
        } else if (region.faction === FACTIONS.SAMA) {
            configs = [CONFIG.ENEMY.SAMA_TROOP, CONFIG.ENEMY.SAMA_GUARD, CONFIG.ENEMY.SAMA_SNIPER];
        } else {
            configs = [CONFIG.ENEMY.SWARMER, CONFIG.ENEMY.CLOAKER];
            count = 20;
        }
        const clusters = region.faction ? 3 : 5;
        const centers = [];
        for (let i = 0; i < clusters; i++) {
            centers.push({
                x: region.x + Math.random() * region.width,
                y: region.y + Math.random() * region.height,
            });
        }
        for (let i = 0; i < count; i++) {
            const center = centers[Math.floor(Math.random() * centers.length)];
            const x = center.x + (Math.random() - 0.5) * region.width * 0.3;
            const y = center.y + (Math.random() - 0.5) * region.height * 0.3;
            const cfg = configs[Math.floor(Math.random() * configs.length)];
            const enemy = Enemy.create(cfg, x, y);
            enemy.region = region;
            enemy.active = false;
            enemy.isWave = false;
            enemy.color = cfg.COLOR;
            region.enemies.push(enemy);
            state.enemies.push(enemy);
        }
        if (Math.random() < 0.3) {
            let npcCfg = CONFIG.ENEMY.NEUTRAL_TRADER;
            if (region.faction === FACTIONS.SAMA && Math.random() < 0.5) npcCfg = CONFIG.ENEMY.SAMA_AGENT;
            else if (region.faction === FACTIONS.PIRATE && Math.random() < 0.5) npcCfg = CONFIG.ENEMY.PIRATE_BROKER;
            const x = region.x + Math.random() * region.width;
            const y = region.y + Math.random() * region.height;
            const npc = Enemy.create(npcCfg, x, y);
            npc.active = true;
            npc.region = region;
            state.enemies.push(npc);
        }
    }

    function activateRegion(region) {
        if (!region || !region.enemies) return;
        region.enemies.forEach(e => e.active = true);
    }

    function deactivateRegion(region) {
        if (!region || !region.enemies) return;
        region.enemies.forEach(e => e.active = false);
    }

    function updateMusic(region) {
        if (!region) return;
        if (bgMusic.getAttribute('src') !== region.music) {
            bgMusic.pause();
            bgMusic.src = region.music;
            bgMusic.play().catch(e => console.log("Audio couldn't play:", e));
        }
    }

    function pointInPolygon(x, y, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function getRegionFor(x, y) {
        return CONFIG.MAP.REGIONS.find(r =>
            x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height &&
            pointInPolygon(x, y, r.points)
        ) || null;
    }

    function getAllPOIs() {
        return CONFIG.MAP.REGIONS.flatMap(r => r.pois);
    }

    // ----- Dynamic Events -----
    function triggerRandomEvent() {
        const region = CONFIG.MAP.REGIONS[Math.floor(Math.random() * CONFIG.MAP.REGIONS.length)];
        const roll = Math.random();
        if (roll < 0.25) spawnPirateRaid(region);
        else if (roll < 0.5) spawnTechDrop(region);
        else if (roll < 0.75) spawnFactionWar(region);
        else if (roll < 0.95) spawnSectorInvasion();
        else spawnWarpStorm(region);
    }

    function spawnPirateRaid(region) {
        for (let i = 0; i < 8; i++) {
            const x = region.x + Math.random() * region.width;
            const y = region.y + Math.random() * region.height;
            const enemy = Enemy.create(CONFIG.ENEMY.CHASER, x, y);
            enemy.isWave = false;
            enemy.active = true;
            state.enemies.push(enemy);
        }
        adjustFactionRelation(FACTIONS.PIRATE, region.faction || FACTIONS.NEUTRAL, -5);
    }

    function spawnTechDrop(region) {
        const poi = { type: POI_TYPES.TECH_DROP, x: region.x + Math.random() * region.width, y: region.y + Math.random() * region.height, collected: false, timeout: state.gameTime + 15000, radius: 10 };
        region.pois.push(poi);
        if (region.faction) adjustFactionRelation(region.faction, FACTIONS.NEUTRAL, 5);
    }

    function spawnFactionWar(region) {
        const factions = [FACTIONS.PIRATE, FACTIONS.SAMA];
        const factionA = factions[Math.floor(Math.random()*factions.length)];
        const factionB = factionA === FACTIONS.PIRATE ? FACTIONS.SAMA : FACTIONS.PIRATE;
        for (let i=0;i<5;i++) {
            const enemyA = Enemy.create(CONFIG.ENEMY.CHASER, region.x + Math.random()*region.width, region.y + Math.random()*region.height);
            enemyA.faction = factionA;
            enemyA.active = true;
            state.enemies.push(enemyA);
            const enemyB = Enemy.create(CONFIG.ENEMY.SAMA_TROOP, region.x + Math.random()*region.width, region.y + Math.random()*region.height);
            enemyB.faction = factionB;
            enemyB.active = true;
            state.enemies.push(enemyB);
        }
        adjustFactionRelation(factionA, factionB, -10);
    }

    function spawnWarpStorm(region) {
        region.events.push({ type: 'warpStorm', end: state.gameTime + 15000 });
    }

    function spawnSectorInvasion() {
        const occupied = CONFIG.MAP.REGIONS.filter(r => r.faction);
        if (occupied.length < 2) return;
        const attackerRegion = occupied[Math.floor(Math.random()*occupied.length)];
        let targetRegion = occupied[Math.floor(Math.random()*occupied.length)];
        while (targetRegion === attackerRegion) targetRegion = occupied[Math.floor(Math.random()*occupied.length)];
        const attacker = attackerRegion.faction;
        const defender = targetRegion.faction;
        const winner = Math.random() < 0.5 ? attacker : defender;
        targetRegion.faction = winner;
        const msg = `[${winner}] captured ${targetRegion.name}`;
        state.newsFeed.push({timestamp: Date.now(), message: msg, color: FACTION_OUTLINE_COLORS[winner]});
        dom.newsPopup.textContent = msg;
        dom.newsPopup.classList.remove('hidden');
        clearTimeout(newsPopupTimeout);
        newsPopupTimeout = setTimeout(() => {
            dom.newsPopup.classList.add('hidden');
        }, 5000);
    }

    function handlePoiCollision(poi) {
        if (poi.collected) return;
        const region = getRegionFor(poi.x, poi.y);
        if (poi.type === POI_TYPES.DERELICT) {
            state.score += 50;
        } else if (poi.type === POI_TYPES.OUTPOST) {
            state.player.hp = state.player.maxHp;
        } else if (poi.type === POI_TYPES.BLACK_MARKET) {
            if (state.player.xp >= 20) { state.player.xp -= 20; state.score += 100; }
        } else if (poi.type === POI_TYPES.TECH_DROP) {
            state.player.addXp(50);
        } else if (poi.type === POI_TYPES.MISSION_DATA) {
            state.missions.forEach(m => {
                if (!m.completed && m.poi === poi) {
                    m.completed = true;
                    state.score += 200;
                    adjustFactionRelation(m.faction, FACTIONS.NEUTRAL, 10);
                }
            });
        }
        poi.collected = true;
        if (region) region.pois = region.pois.filter(p => p !== poi);
    }

    function generateMission(faction) {
        const region = CONFIG.MAP.REGIONS[Math.floor(Math.random()*CONFIG.MAP.REGIONS.length)];
        const poi = { type: POI_TYPES.MISSION_DATA, x: region.x + Math.random()*region.width, y: region.y + Math.random()*region.height, collected: false, radius: 10 };
        region.pois.push(poi);
        const description = `Recover data for ${faction} at ${region.name}.`;
        return { faction, region, poi, description, completed: false };
    }

    let spatialGrid;

    function handleCollisions() {
        spatialGrid = new Map();
        const activeEnemies = state.enemies.filter(e => e.isWave || e.active);
        const allEntities = [state.player, ...activeEnemies, ...state.projectiles, ...state.xpOrbs, ...state.drones, ...getAllPOIs()];
        for (const entity of allEntities) {
            if (!entity) continue;
            const key = `${Math.floor(entity.x / CONFIG.SPATIAL_GRID_CELL_SIZE)}|${Math.floor(entity.y / CONFIG.SPATIAL_GRID_CELL_SIZE)}`;
            if (!spatialGrid.has(key)) spatialGrid.set(key, []);
            spatialGrid.get(key).push(entity);
        }

        const checkPair = (e1, e2) => {
            const dx = e1.x - e2.x; const dy = e1.y - e2.y;
            if ((dx * dx + dy * dy) < (e1.radius + e2.radius) * (e1.radius + e2.radius)) {
                if (e1 instanceof Player && e2 instanceof Enemy && !e2.friendly) e1.takeDamage(e2.damage);
                else if (e2 instanceof Player && e1 instanceof Enemy && !e1.friendly) e2.takeDamage(e1.damage);
                else if (e1 instanceof Player && e2 instanceof Enemy && e2.friendly && e2.dialogue) startDialogue(e2);
                else if (e2 instanceof Player && e1 instanceof Enemy && e1.friendly && e1.dialogue) startDialogue(e1);
                else if (e1 instanceof Player && e2 instanceof XpOrb) { e1.addXp(e2.value); state.xpOrbs = state.xpOrbs.filter(o => o !== e2); }
                else if (e2 instanceof Player && e1 instanceof XpOrb) { e2.addXp(e1.value); state.xpOrbs = state.xpOrbs.filter(o => o !== e1); }
                else if (e1 instanceof Player && e2.type) handlePoiCollision(e2);
                else if (e2 instanceof Player && e1.type) handlePoiCollision(e1);
                else if (e1 instanceof Projectile && e2 instanceof Enemy) handleProjectileEnemy(e1, e2);
                else if (e2 instanceof Projectile && e1 instanceof Enemy) handleProjectileEnemy(e2, e1);
                else if (e1 instanceof Enemy && e2 instanceof Enemy && e1.faction !== e2.faction) {
                    e1.takeDamage({amount: e2.damage, isCrit: false, attacker: e2});
                    e2.takeDamage({amount: e1.damage, isCrit: false, attacker: e1});
                }
                else if (e1 instanceof Player && e2 instanceof EnemyProjectile) e1.takeDamage(e2.getDamage().amount);
                else if (e2 instanceof Player && e1 instanceof EnemyProjectile) e2.takeDamage(e1.getDamage().amount);
                else if (e1 instanceof Drone && e2 instanceof Enemy) { e2.takeDamage({amount: e1.config.DRONE_DMG, isCrit: false, attacker: e1}); e1.takeDamage(); }
                else if (e2 instanceof Drone && e1 instanceof Enemy) { e1.takeDamage({amount: e2.config.DRONE_DMG, isCrit: false, attacker: e2}); e2.takeDamage(); }
            }
        };
        const handleProjectileEnemy = (p, e) => {
            if (p.owner === e || p instanceof EnemyProjectile) return;
            if (p instanceof ForcePulseProjectile) { if (p.hitEnemies.has(e)) return; const angle = Math.atan2(e.y-p.owner.y, e.x-p.owner.x); e.vx += Math.cos(angle) * p.config.PUSH_FORCE / e.mass; e.vy += Math.sin(angle) * p.config.PUSH_FORCE / e.mass; p.hitEnemies.add(e); return; }
            if (p instanceof RailgunProjectile) { if (p.hitEnemies.has(e)) return; e.takeDamage(p.getDamage()); p.hitEnemies.add(e); p.penetration--; if (p.penetration <= 0) p.destroy(); return; }
            if (p instanceof ChainLightningProjectile) { if (p.hitEnemies.has(e)) return; e.takeDamage(p.getDamage()); p.onHit(e); return; }
            if (p instanceof KineticSlash) { if (p.hitEnemies.has(e)) return; e.takeDamage(p.getDamage()); p.hitEnemies.add(e); return; }
            if (p instanceof BlackHoleProjectile) return;
            e.takeDamage(p.getDamage());
            if (!p.isOrbiter) p.destroy();
        };

        for (const [key, cell] of spatialGrid.entries()) {
            const [cellX, cellY] = key.split('|').map(Number);
            for (let i = 0; i < cell.length; i++) { for (let j = i + 1; j < cell.length; j++) { checkPair(cell[i], cell[j]); } }
            const neighborOffsets = [[1,0], [0,1], [1,1], [-1,1]];
            for (const offset of neighborOffsets) {
                const neighborKey = `${cellX + offset[0]}|${cellY + offset[1]}`;
                if (spatialGrid.has(neighborKey)) { for (const e1 of cell) { for (const e2 of spatialGrid.get(neighborKey)) { checkPair(e1, e2); } } }
            }
        }
    }

    function handleGravity(dt) {
        if (!spatialGrid) return;
        const G = CONFIG.PHYSICS.GRAVITY_CONSTANT;
        const activeEnemies = state.enemies.filter(e => e.isWave || e.active);
        const physicalEntities = [state.player, ...activeEnemies, ...state.projectiles, ...state.drones];

        for (const entity of physicalEntities) {
            if (!entity) continue;
            const cellX = Math.floor(entity.x / CONFIG.SPATIAL_GRID_CELL_SIZE);
            const cellY = Math.floor(entity.y / CONFIG.SPATIAL_GRID_CELL_SIZE);

            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const key = `${cellX + i}|${cellY + j}`;
                    if (spatialGrid.has(key)) {
                        for (const source of spatialGrid.get(key)) {
                            if (entity === source || entity.owner === source || !source.gravity) continue;
                            if (entity instanceof Projectile && source instanceof Projectile) continue;
                            const dx = source.x - entity.x;
                            const dy = source.y - entity.y;
                            const distSq = dx * dx + dy * dy;
                            if (distSq > 1) {
                                const dist = Math.sqrt(distSq);
                                const force = (G * source.gravity) / distSq;
                                const acceleration = force / entity.mass;
                                entity.vx += (dx / dist) * acceleration * dt;
                                entity.vy += (dy / dist) * acceleration * dt;
                            }
                        }
                    }
                }
            }
        }
    }

    function update(dt) {
        state.gameTime += dt;
        state.eventTimer -= dt * (1000 / CONFIG.TARGET_FPS);
        if (state.eventTimer <= 0) {
            triggerRandomEvent();
            state.eventTimer = 20000 + Math.random() * 10000;
        }
        if (!state.hyperspaceActive) {
            if (state.keys[' ']) {
                state.hyperspaceCharge += dt * (1000 / CONFIG.TARGET_FPS);
                if (state.hyperspaceCharge >= CONFIG.HYPERSPACE.CHARGE_TIME) {
                    state.hyperspaceActive = true;
                    state.hyperspaceCharge = CONFIG.HYPERSPACE.CHARGE_TIME;
                }
            } else {
                state.hyperspaceCharge = 0;
            }
        }
        // Remove old xp orbs
        state.xpOrbs = state.xpOrbs.filter(o => o.age < o.lifespan);
        // Cap particles to 500 at most
        state.particles = state.particles.slice(-500);
        state.player.update(dt);
        const region = getRegionFor(state.player.x, state.player.y);
        if (region !== state.currentRegion) {
            deactivateRegion(state.currentRegion);
            state.currentRegion = region;
            if (region) {
                region.discovered = true;
                spawnEnemiesForRegion(region);
                activateRegion(region);
                updateMusic(region);
            }
        }
        if (region && region.events) {
            region.events = region.events.filter(ev => ev.end > state.gameTime);
            const storm = region.events.find(ev => ev.type === 'warpStorm');
            if (storm) {
                state.player.hp = Math.max(1, state.player.hp - 0.05 * dt);
                state.speedBoost = 1.5;
            } else {
                state.speedBoost = 1;
            }
        }
        state.enemies.forEach(e => { if (e.isWave || e.active) e.update(dt); });
        state.projectiles.forEach(p => p.update(dt));
        state.drones.forEach(d => d.update(dt));
        state.xpOrbs.forEach(o => o.update(dt));
        handleCollisions();
        handleGravity(dt);
        state.particles = state.particles.filter(p => p.lifespan > 0);
        state.particles.forEach(p => p.update(dt));
        if (region && region.enemies && !region.cleared) {
            if (region.enemies.every(e => e.hp <= 0)) region.cleared = true;
        }
        const remainingWave = state.enemies.filter(e => e.isWave).length;
        if (remainingWave === 0 && state.gameState === 'PLAYING') nextWave();
        state.camera.x = state.player.x - canvas.width / 2;
        state.camera.y = state.player.y - canvas.height / 2;
    }

    function draw() {
        ctx.save();
        ctx.fillStyle = '#00000a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(-state.camera.x, -state.camera.y);
        drawBackground();
        state.particles.forEach(p => p.draw());
        ctx.globalAlpha = 1;
        state.xpOrbs.forEach(o => o.draw());
        state.enemies.forEach(e => { if (e.isWave || e.active) e.draw(); });
        // enemy hover labels
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        state.enemies.forEach(e => {
            if (!e.isWave && !e.active) return;
            const screenX = e.x - state.camera.x;
            const screenY = e.y - state.camera.y;
            const dx = state.mouse.x - screenX;
            const dy = state.mouse.y - screenY;
            if (dx*dx + dy*dy < (e.radius + 8) * (e.radius + 8)) {
                const type = Object.keys(CONFIG.ENEMY).find(k => CONFIG.ENEMY[k] === e.config) || 'Enemy';
                ctx.fillText(type.replace(/_/g,' '), e.x, e.y - e.radius - 10);
            }
        });
        state.drones.forEach(d => d.draw());
        state.player.draw();
        ctx.globalCompositeOperation = 'lighter';
        state.projectiles.forEach(p => p.draw());
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        drawMissionPointer();

        dom.waveCounter.textContent = state.wave;
        dom.scoreCounter.textContent = state.score;
        const activeMission = state.missions.find(m => !m.completed);
        dom.missionInfo.textContent = activeMission ? activeMission.description : 'No mission';
        dom.creditHud.textContent = state.credits;
        // HP/XP bars: avoid division by zero
        dom.hpValue.textContent = `${Math.ceil(state.player.hp)}/${Math.ceil(state.player.maxHp)}`;
        dom.hpBar.style.width = state.player.maxHp > 0 ? `${Math.max(0, Math.min(1, state.player.hp / state.player.maxHp)) * 100}%` : '0%';
        dom.levelValue.textContent = state.player.level;
        dom.xpBar.style.width = state.player.xpToNextLevel > 0 ? `${Math.max(0, Math.min(1, state.player.xp / state.player.xpToNextLevel)) * 100}%` : '0%';
        if (state.hyperspaceActive) {
            dom.hyperValue.textContent = 'ACTIVE';
            dom.hyperBar.style.width = '100%';
        } else {
            const ratio = Math.max(0, Math.min(1, state.hyperspaceCharge / CONFIG.HYPERSPACE.CHARGE_TIME));
            dom.hyperValue.textContent = `${Math.floor(ratio * 100)}%`;
            dom.hyperBar.style.width = `${ratio * 100}%`;
        }
        dom.hyperspaceOverlay.classList.toggle('active', state.hyperspaceActive);

        drawMiniMap();
        if (state.showMap) drawFullMap();
        if (dom.questOverlay.classList.contains('visible')) updateQuestLog();
    }

    function gameLoop(timestamp) {
        if (state.gameState !== 'PLAYING') { state.animationFrameId = requestAnimationFrame(gameLoop); return; }
        if (!state.lastTime) state.lastTime = timestamp;
        let rawDeltaTime = timestamp - state.lastTime;
        state.lastTime = timestamp;
        // Break up large dt steps
        let steps = Math.floor(rawDeltaTime / (1000 / CONFIG.TARGET_FPS));
        let remainder = rawDeltaTime % (1000 / CONFIG.TARGET_FPS);
        let count = 0;
        while (steps-- > 0 && count < 5) { update(1); count++; }
        update(remainder / (1000 / CONFIG.TARGET_FPS));
        draw();
        state.animationFrameId = requestAnimationFrame(gameLoop);
    }

    function createExplosion(x, y, color, radius) {
        for (let i = 0; i < 5 + Math.floor(radius); i++) {
            const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 2 + 0.5;
            const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
            const lifespan = Math.random() * 500 + 500; const size = Math.random() * 2 + 1;
            if (state.particles.length < 500) state.particles.push(new Particle(x, y, vx, vy, lifespan, color, size));
        }
    }
    function createThrusterParticles(player) {
        const angle = player.angle + Math.PI + (Math.random() - 0.5) * 0.5;
        const speed = 1 + Math.random(); const vx = Math.cos(angle) * speed - player.vx * 0.5; const vy = Math.sin(angle) * speed - player.vy * 0.5;
        const x = player.x - Math.cos(player.angle) * 10; const y = player.y - Math.sin(player.angle) * 10;
        if (state.particles.length < 500) state.particles.push(new Particle(x, y, vx, vy, 400, '#fb5607', Math.random() * 1.5 + 1));
    }
    function createCritIndicator(x, y, amount) {
        const particle = new Particle(x, y, 0, -1, 500, '#fee440', 0);
        particle.draw = function() { ctx.globalAlpha = this.lifespan / this.initialLifespan; ctx.fillStyle = this.color; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(amount), this.x, this.y); };
        particle.update = function(dt) { this.y -= 0.5 * dt; this.lifespan -= dt * (1000/CONFIG.TARGET_FPS); };
        if (state.particles.length < 500) state.particles.push(particle);
    }
    function createBeamParticle(x1, y1, x2, y2, color) {
        const p = new Particle(0,0,0,0, 100, color, 0);
        p.draw = function() { ctx.save(); ctx.globalAlpha = this.lifespan / this.initialLifespan; ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); };
        if (state.particles.length < 500) state.particles.push(p);
    }
    function createHealParticle(x, y) {
        const p = new Particle(x, y, 0, -0.5, 300, '#5dd39e', 2);
        p.draw = function() { ctx.globalAlpha = this.lifespan / this.initialLifespan; ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x, this.y-this.size); ctx.lineTo(this.x, this.y+this.size); ctx.moveTo(this.x-this.size, this.y); ctx.lineTo(this.x+this.size, this.y); ctx.stroke(); };
        if (state.particles.length < 500) state.particles.push(p);
    }

    function drawBackground() {
        for (const s of state.stars) {
            if (s.x < state.camera.x - 2 || s.x > state.camera.x + canvas.width + 2 ||
                s.y < state.camera.y - 2 || s.y > state.camera.y + canvas.height + 2) continue;
            ctx.globalAlpha = s.a;
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;
        for (const p of state.planets) {
            if (p.x + p.r < state.camera.x || p.x - p.r > state.camera.x + canvas.width ||
                p.y + p.r < state.camera.y || p.y - p.r > state.camera.y + canvas.height) continue;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawRegionPath(ctx, points, offsetX, offsetY, scaleX, scaleY) {
        ctx.beginPath();
        ctx.moveTo((points[0].x - offsetX) * scaleX, (points[0].y - offsetY) * scaleY);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo((points[i].x - offsetX) * scaleX, (points[i].y - offsetY) * scaleY);
        }
        ctx.closePath();
    }

    function drawMiniMap() {
        const mCtx = dom.minimap.getContext('2d');
        const view = MINIMAP_VIEW;
        let minX = Math.max(0, Math.min(state.map.WIDTH - view, state.player.x - view/2));
        let minY = Math.max(0, Math.min(state.map.HEIGHT - view, state.player.y - view/2));
        const scaleX = dom.minimap.width / view;
        const scaleY = dom.minimap.height / view;
        mCtx.clearRect(0,0,dom.minimap.width, dom.minimap.height);
        CONFIG.MAP.REGIONS.forEach(r => {
            const rx = r.cx - minX, ry = r.cy - minY;
            if (rx + r.width/2 < 0 || ry + r.height/2 < 0 || rx - r.width/2 > view || ry - r.height/2 > view) return;
            mCtx.fillStyle = r.discovered ? (r.color || '#444') : '#111';
            drawRegionPath(mCtx, r.points, minX, minY, scaleX, scaleY);
            mCtx.fill();
            if (r.discovered) {
                mCtx.fillStyle = '#fff';
                mCtx.font = '10px sans-serif';
                mCtx.textAlign = 'center';
                mCtx.fillText(r.name, rx*scaleX, ry*scaleY);
            }
        });
        state.enemies.forEach(e => {
            if (!e.isWave && !e.active) return;
            const ex = (e.x - minX) * scaleX;
            const ey = (e.y - minY) * scaleY;
            mCtx.fillStyle = e.isWave ? '#ff0000' : e.color;
            mCtx.beginPath();
            mCtx.arc(ex, ey, 2, 0, Math.PI*2);
            mCtx.fill();
        });
        getAllPOIs().forEach(poi => {
            const px = (poi.x - minX) * scaleX;
            const py = (poi.y - minY) * scaleY;
            if (poi.type === POI_TYPES.OUTPOST) mCtx.fillStyle = '#00ff88';
            else if (poi.type === POI_TYPES.BLACK_MARKET) mCtx.fillStyle = '#ff00ff';
            else if (poi.type === POI_TYPES.DERELICT) mCtx.fillStyle = '#aaaaaa';
            else if (state.missions.some(m => m.poi === poi && !m.completed)) mCtx.fillStyle = '#ffff00';
            else mCtx.fillStyle = '#ffff00';
            mCtx.beginPath();
            mCtx.arc(px, py, state.missions.some(m => m.poi === poi && !m.completed) ? 3 : 2, 0, Math.PI*2);
            mCtx.fill();
            if (state.missions.some(m => m.poi === poi && !m.completed)) {
                mCtx.strokeStyle = '#ffffff';
                mCtx.lineWidth = 1;
                mCtx.stroke();
            }
        });
        mCtx.fillStyle = '#00f5d4';
        mCtx.beginPath();
        mCtx.arc((state.player.x-minX)*scaleX, (state.player.y-minY)*scaleY, 3, 0, Math.PI*2);
        mCtx.fill();
    }

    function drawFullMap() {
        const canvasMap = dom.mapCanvas;
        const mCtx = canvasMap.getContext('2d');
        canvasMap.width = Math.min(state.map.WIDTH * mapZoom, window.innerWidth*0.8);
        canvasMap.height = Math.min(state.map.HEIGHT * mapZoom, window.innerHeight*0.8);
        const scaleX = canvasMap.width / state.map.WIDTH;
        const scaleY = canvasMap.height / state.map.HEIGHT;
        mCtx.clearRect(0,0,canvasMap.width,canvasMap.height);
        CONFIG.MAP.REGIONS.forEach(r => {
            mCtx.fillStyle = r.discovered ? (r.color || '#444') : '#111';
            drawRegionPath(mCtx, r.points, 0, 0, scaleX, scaleY);
            mCtx.fill();
            if (r.discovered) {
                mCtx.fillStyle = '#fff';
                mCtx.font = '16px sans-serif';
                mCtx.textAlign = 'center';
                mCtx.fillText(r.name, r.cx*scaleX, r.cy*scaleY);
            }
        });
        state.enemies.forEach(e => {
            if (!e.isWave && !e.active) return;
            mCtx.fillStyle = e.isWave ? '#ff0000' : e.color;
            mCtx.beginPath();
            mCtx.arc(e.x*scaleX, e.y*scaleY, 3, 0, Math.PI*2);
            mCtx.fill();
        });
        getAllPOIs().forEach(poi => {
            if (poi.type === POI_TYPES.OUTPOST) mCtx.fillStyle = '#00ff88';
            else if (poi.type === POI_TYPES.BLACK_MARKET) mCtx.fillStyle = '#ff00ff';
            else if (poi.type === POI_TYPES.DERELICT) mCtx.fillStyle = '#aaaaaa';
            else if (state.missions.some(m => m.poi === poi && !m.completed)) mCtx.fillStyle = '#ffff00';
            else mCtx.fillStyle = '#ffff00';
            mCtx.beginPath();
            mCtx.arc(poi.x*scaleX, poi.y*scaleY, state.missions.some(m => m.poi === poi && !m.completed) ? 4 : 3, 0, Math.PI*2);
            mCtx.fill();
            if (state.missions.some(m => m.poi === poi && !m.completed)) {
                mCtx.strokeStyle = '#ffffff';
                mCtx.lineWidth = 1;
                mCtx.stroke();
            }
        });
        mCtx.fillStyle = '#00f5d4';
        mCtx.beginPath();
        mCtx.arc(state.player.x*scaleX, state.player.y*scaleY, 5, 0, Math.PI*2);
        mCtx.fill();
    }

    function drawMissionPointer() {
        const m = state.missions.find(ms => !ms.completed);
        if (!m) return;
        const poi = m.poi;
        if (!poi) return;
        const x = poi.x - state.camera.x;
        const y = poi.y - state.camera.y;
        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) return;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const angle = Math.atan2(y - cy, x - cx);
        const dist = Math.min(cx, cy) - 20;
        const ax = cx + Math.cos(angle) * dist;
        const ay = cy + Math.sin(angle) * dist;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(angle - Math.PI/6) * 12, ay - Math.sin(angle - Math.PI/6) * 12);
        ctx.lineTo(ax - Math.cos(angle + Math.PI/6) * 12, ay - Math.sin(angle + Math.PI/6) * 12);
        ctx.closePath();
        ctx.fill();
    }

    function reCenterCamera() {
        if (state && state.player) {
            state.camera.x = state.player.x - canvas.width / 2;
            state.camera.y = state.player.y - canvas.height / 2;
        }
    }

    function init() {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        dom.minimap.width = 200; dom.minimap.height = 200;
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; reCenterCamera(); });
        window.addEventListener('keydown', e => {
            if(state) {
                state.keys[e.key.toLowerCase()] = true;
                if (e.code === 'Space' && state.hyperspaceActive) {
                    state.hyperspaceActive = false;
                    state.hyperspaceCharge = 0;
                }
                if (e.key.toLowerCase() === 'm') {
                    state.showMap = !state.showMap;
                    dom.mapOverlay.classList.toggle('visible', state.showMap);
                }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const isVisible = !dom.diplomacyOverlay.classList.contains('visible');
                    dom.diplomacyOverlay.classList.toggle('visible', isVisible);
                    if (isVisible) updateDiplomacyUI();
                }
                if (e.key.toLowerCase() === 'j') {
                    const isVisible = !dom.questOverlay.classList.contains('visible');
                    dom.questOverlay.classList.toggle('visible', isVisible);
                    if (isVisible) updateQuestLog();
                }
                if (e.key.toLowerCase() === 'c') {
                    toggleControlPanel();
                }
                if (state.showMap && (e.key === '+' || e.key === '=')) { mapZoom = Math.min(1, mapZoom * 1.2); drawFullMap(); }
                if (state.showMap && (e.key === '-' || e.key === '_')) { mapZoom = Math.max(0.1, mapZoom / 1.2); drawFullMap(); }
            }
        });
        window.addEventListener('keyup', e => { if(state) state.keys[e.key.toLowerCase()] = false; });
        window.addEventListener('mousemove', e => { if(state) { state.mouse.x = e.clientX; state.mouse.y = e.clientY; } });
        window.addEventListener('mousedown', e => {
            if (e.button === 1 && state) {
                state.autoFire = !state.autoFire;
                e.preventDefault();
            }
        });
        document.addEventListener('visibilitychange', () => { if(document.hidden) pauseGame(); else resumeGame(); });
        dom.startButton.addEventListener('click', startGame);
        dom.restartButton.addEventListener('click', startGame);
        dom.closeDiplomacy.addEventListener('click', () => {
            dom.diplomacyOverlay.classList.remove('visible');
        });
        dom.closeTrade.addEventListener('click', closeTrade);
        dom.closeQuests.addEventListener('click', () => {
            dom.questOverlay.classList.remove('visible');
        });
        if (dom.closeControl) dom.closeControl.addEventListener('click', () => toggleControlPanel(false));
        document.querySelectorAll('.app-icon').forEach(icon => {
            icon.addEventListener('click', () => openApp(icon.dataset.app));
        });
        document.querySelectorAll('.close-app').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.classList.remove('visible');
                }
            });
        });
        if (dom.newsPopup) dom.newsPopup.addEventListener('click', () => {
            openApp('news');
            toggleControlPanel(false);
            dom.newsPopup.classList.add('hidden');
        });
        state = getInitialState();
        updateDiplomacyUI();
        setGameState('START');
    }

    init();
});