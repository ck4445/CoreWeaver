'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const bgMusic = document.getElementById('bg-music');

    const dom = {
        hud: document.getElementById('game-hud'), waveCounter: document.getElementById('wave-counter'), scoreCounter: document.getElementById('score-counter'),
        hpBar: document.getElementById('hp-bar'), hpValue: document.getElementById('hp-value'), xpBar: document.getElementById('xp-bar'),
        levelValue: document.getElementById('level-value'), overlay: document.getElementById('ui-overlay'), startMenu: document.getElementById('start-menu'),
        levelUpMenu: document.getElementById('level-up-menu'), gameOverMenu: document.getElementById('game-over-menu'),
        upgradeContainer: document.getElementById('upgrade-cards-container'), startButton: document.getElementById('start-button'),
        restartButton: document.getElementById('restart-button'), finalScore: document.getElementById('final-score'), finalWave: document.getElementById('final-wave'),
    };

    let state, musicStarted = false;
    function getInitialState() { return { gameState: 'START', player: null, enemies: [], projectiles: [], xpOrbs: [], particles: [], drones: [], keys: {}, mouse: { x: 0, y: 0 }, camera: { x: 0, y: 0 }, wave: 0, score: 0, gameTime: 0, lastTime: 0, animationFrameId: null }; }

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
            if (state.keys['w'] || state.keys['arrowup']) { this.vx += Math.cos(this.angle) * this.speed; this.vy += Math.sin(this.angle) * this.speed; createThrusterParticles(this); }
            this.vx *= this.friction; this.vy *= this.friction;
            this.x += this.vx * dt; this.y += this.vy * dt;
            const targetAngle = Math.atan2(state.mouse.y - (this.y - state.camera.y), state.mouse.x - (this.x - state.camera.x));
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * this.rotationSpeed * dt;
            this.weapons.forEach(w => w.update(dt));
            if (this.invincibleTimer > 0) { this.invincibleTimer -= dt * (1000 / CONFIG.TARGET_FPS); if (this.invincibleTimer <= 0) this.invincible = false; }
        }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.fillStyle = this.invincible && Math.floor(this.invincibleTimer / 100) % 2 === 0 ? '#fff' : '#00f5d4';
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-5, 0); ctx.lineTo(-10, 10); ctx.closePath();
            ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        takeDamage(amount) {
            if (this.invincible) return; this.hp -= amount; this.invincible = true; this.invincibleTimer = CONFIG.PLAYER.INVINCIBILITY_DURATION;
            createExplosion(this.x, this.y, '#e63946', 10); if (this.hp <= 0) { this.hp = 0; setGameState('GAME_OVER'); }
        }
        addXp(amount) {
            this.xp += amount; if (this.xp >= this.xpToNextLevel) { this.xp -= this.xpToNextLevel; this.level++; this.xpToNextLevel = Math.floor(this.xpToNextLevel * CONFIG.PLAYER.XP_LEVEL_MULTIPLIER); this.hp = this.maxHp; setGameState('LEVEL_UP'); }
        }
    }

    class Enemy extends Entity {
        constructor(x, y, config) {
            super(x, y, config.RADIUS);
            this.config = config; this.maxHp = config.HP; this.hp = this.maxHp; this.speed = config.SPEED; this.damage = config.DAMAGE; this.xpValue = config.XP;
            this.color = config.COLOR; this.mass = config.RADIUS / 5; this.gravity = config.GRAVITY || 0;
        }
        update(dt) { const player = state.player; const dx = player.x - this.x; const dy = player.y - this.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist > 0) { const moveX = (dx / dist) * this.speed; const moveY = (dy / dist) * this.speed; this.x += moveX * dt; this.y += moveY * dt; } }
        draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
        takeDamage(damageInfo) {
            this.hp -= damageInfo.amount;
            if (damageInfo.isCrit) createCritIndicator(this.x, this.y, damageInfo.amount);
            if (this.hp <= 0) {
                this.onDeath();
                state.enemies = state.enemies.filter(e => e !== this);
                state.score += this.xpValue * 10;
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
            const player = state.player; const dx = player.x - this.x; const dy = player.y - this.y; const dist = Math.sqrt(dx * dx + dy * dy); const prefer = this.config.PREF_DIST;
            if (dist > prefer) {
                const spd = this.speed * Math.min(1, (dist - prefer) / prefer);
                this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt;
            } else if (dist < prefer * 0.8) {
                const spd = this.speed * Math.min(1, (prefer * 0.8 - dist) / prefer);
                this.x -= (dx / dist) * spd * dt; this.y -= (dy / dist) * spd * dt;
            }
            this.fireCooldown -= dt * (1000 / CONFIG.TARGET_FPS);
            if (this.fireCooldown <= 0) {
                const angle = Math.atan2(dy, dx);
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
            if (this.cloakTimer <= 0) { this.cloaked = !this.cloaked; this.cloakTimer = this.cloaked ? this.config.CLOAK_DUR : this.config.UNCLOAK_DUR; }
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
            return { amount, isCrit };
        }
        destroy() { state.projectiles = state.projectiles.filter(p => p !== this); }
    }
    class EnemyProjectile extends Projectile {
        constructor(x, y, angle, config, owner) {
            super(x, y, angle !== undefined ? angle : 0, config, owner || null);
        }
        getDamage() { return { amount: this.damage, isCrit: false }; }
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
    class Weapon { constructor(owner) { this.owner = owner; this.level = 1; this.fireRate = 500; this.fireCooldown = 0; } update(dt) { this.fireCooldown -= dt * (1000 / CONFIG.TARGET_FPS) * this.owner.fireRateMultiplier; if (this.fireCooldown <= 0) { this.fire(); this.fireCooldown = this.fireRate; } } fire() {} }
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
        constructor(owner) { super(owner); this.config = { ...CONFIG.WEAPONS.CHAIN_LIGHTNING }; this.fireRate = this.config.FIRE_RATE; }
        fire() {
            if (!state.enemies.length) return;
            const nearestEnemy = state.enemies.reduce((closest, enemy) => {
                const dCurr = (enemy.x-this.owner.x)**2 + (enemy.y-this.owner.y)**2;
                if (!closest) return enemy;
                const dBest = (closest.x-this.owner.x)**2 + (closest.y-this.owner.y)**2;
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
    ]);

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
        const maxWeapons = 5;
        const weaponChoices = player.weapons.length < maxWeapons ? weaponUpgradePool.slice() : [];
        if (weaponChoices.length) {
            choices.push(weaponChoices[Math.floor(Math.random() * weaponChoices.length)]);
        }
        while (choices.length < 4) {
            let pick = null;
            if (Math.random() < 0.5 && weaponChoices.length > 0) {
                const remaining = weaponChoices.filter(w => !choices.includes(w));
                if (remaining.length) {
                    pick = remaining[Math.floor(Math.random() * remaining.length)];
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
            if (WeaponClass && player.weapons.length < 5) {
                player.weapons.push(new WeaponClass(player));
            }
        }
        setGameState('PLAYING');
    }

    function setGameState(newState) {
        state.gameState = newState;
        dom.overlay.classList.toggle('active', newState !== 'PLAYING');
        dom.hud.classList.toggle('hidden', newState !== 'PLAYING');
        dom.startMenu.classList.add('hidden'); dom.levelUpMenu.classList.add('hidden'); dom.gameOverMenu.classList.add('hidden');
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
        switch(newState) {
            case 'START': dom.startMenu.classList.remove('hidden'); break;
            case 'PLAYING': resumeGame(); break;
            case 'LEVEL_UP': pauseGame(); displayUpgradeChoices(); dom.levelUpMenu.classList.remove('hidden'); break;
            case 'GAME_OVER': pauseGame(); dom.finalScore.textContent = state.score; dom.finalWave.textContent = state.wave; dom.gameOverMenu.classList.remove('hidden'); break;
        }
    }
    function startGame() {
        if (!musicStarted) { bgMusic.play().catch(e => console.log("Audio couldn't play:", e)); musicStarted = true; }
        const keys = state ? state.keys : {}; const mouse = state ? state.mouse : { x: 0, y: 0 };
        state = getInitialState(); state.keys = keys; state.mouse = mouse;
        state.player = new Player(canvas.width / 2, canvas.height / 2);
        nextWave();
        setGameState('PLAYING');
    }
    function pauseGame() { if (state.animationFrameId) { cancelAnimationFrame(state.animationFrameId); state.animationFrameId = null; } }
    function resumeGame() { if (!state.animationFrameId) { state.lastTime = performance.now(); state.animationFrameId = requestAnimationFrame(gameLoop); } }
    function nextWave() {
        state.wave++;
        const numEnemies = 8 + state.wave * 4;
        const waveEnemyTypes = [CONFIG.ENEMY.CHASER, CONFIG.ENEMY.SWARMER];
        if (state.wave > 1) waveEnemyTypes.push(CONFIG.ENEMY.TANK);
        if (state.wave > 2) waveEnemyTypes.push(CONFIG.ENEMY.SHOOTER);
        if (state.wave > 3) waveEnemyTypes.push(CONFIG.ENEMY.SPLITTER);
        if (state.wave > 4) waveEnemyTypes.push(CONFIG.ENEMY.CLOAKER);
        if (state.wave > 5) waveEnemyTypes.push(CONFIG.ENEMY.GRAVITON);
        if (state.wave > 6) waveEnemyTypes.push(CONFIG.ENEMY.HEALER);

        for (let i = 0; i < numEnemies; i++) {
            const side = Math.floor(Math.random() * 4);
            let x, y;
            const spawnDist = 100;
            switch(side) {
                case 0: x = Math.random() * canvas.width; y = -spawnDist; break;
                case 1: x = canvas.width + spawnDist; y = Math.random() * canvas.height; break;
                case 2: x = Math.random() * canvas.width; y = canvas.height + spawnDist; break;
                case 3: x = -spawnDist; y = Math.random() * canvas.height; break;
            }
            const config = waveEnemyTypes[Math.floor(Math.random() * waveEnemyTypes.length)];
            state.enemies.push(Enemy.create(config, x + state.camera.x, y + state.camera.y));
        }
    }

    let spatialGrid;

    function handleCollisions() {
        spatialGrid = new Map();
        const allEntities = [state.player, ...state.enemies, ...state.projectiles, ...state.xpOrbs, ...state.drones];
        for (const entity of allEntities) {
            if (!entity) continue;
            const key = `${Math.floor(entity.x / CONFIG.SPATIAL_GRID_CELL_SIZE)}|${Math.floor(entity.y / CONFIG.SPATIAL_GRID_CELL_SIZE)}`;
            if (!spatialGrid.has(key)) spatialGrid.set(key, []);
            spatialGrid.get(key).push(entity);
        }

        const checkPair = (e1, e2) => {
            const dx = e1.x - e2.x; const dy = e1.y - e2.y;
            if ((dx * dx + dy * dy) < (e1.radius + e2.radius) * (e1.radius + e2.radius)) {
                if (e1 instanceof Player && e2 instanceof Enemy) e1.takeDamage(e2.damage);
                else if (e2 instanceof Player && e1 instanceof Enemy) e2.takeDamage(e1.damage);
                else if (e1 instanceof Player && e2 instanceof XpOrb) { e1.addXp(e2.value); state.xpOrbs = state.xpOrbs.filter(o => o !== e2); }
                else if (e2 instanceof Player && e1 instanceof XpOrb) { e2.addXp(e1.value); state.xpOrbs = state.xpOrbs.filter(o => o !== e1); }
                else if (e1 instanceof Projectile && e2 instanceof Enemy) handleProjectileEnemy(e1, e2);
                else if (e2 instanceof Projectile && e1 instanceof Enemy) handleProjectileEnemy(e2, e1);
                else if (e1 instanceof Player && e2 instanceof EnemyProjectile) e1.takeDamage(e2.getDamage().amount);
                else if (e2 instanceof Player && e1 instanceof EnemyProjectile) e2.takeDamage(e1.getDamage().amount);
                else if (e1 instanceof Drone && e2 instanceof Enemy) { e2.takeDamage({amount: e1.config.DRONE_DMG, isCrit: false}); e1.takeDamage(); }
                else if (e2 instanceof Drone && e1 instanceof Enemy) { e1.takeDamage({amount: e2.config.DRONE_DMG, isCrit: false}); e2.takeDamage(); }
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
        const physicalEntities = [state.player, ...state.enemies, ...state.projectiles, ...state.drones];

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
        // Remove old xp orbs
        state.xpOrbs = state.xpOrbs.filter(o => o.age < o.lifespan);
        // Cap particles to 500 at most
        state.particles = state.particles.slice(-500);
        state.player.update(dt);
        state.enemies.forEach(e => e.update(dt));
        state.projectiles.forEach(p => p.update(dt));
        state.drones.forEach(d => d.update(dt));
        state.xpOrbs.forEach(o => o.update(dt));
        handleCollisions();
        handleGravity(dt);
        state.particles = state.particles.filter(p => p.lifespan > 0);
        state.particles.forEach(p => p.update(dt));
        if (state.enemies.length === 0 && state.gameState === 'PLAYING') nextWave();
        state.camera.x = state.player.x - canvas.width / 2;
        state.camera.y = state.player.y - canvas.height / 2;
    }

    function draw() {
        ctx.save();
        ctx.fillStyle = '#00000a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(-state.camera.x, -state.camera.y);
        state.particles.forEach(p => p.draw());
        ctx.globalAlpha = 1;
        state.xpOrbs.forEach(o => o.draw());
        state.enemies.forEach(e => e.draw());
        state.drones.forEach(d => d.draw());
        state.player.draw();
        ctx.globalCompositeOperation = 'lighter';
        state.projectiles.forEach(p => p.draw());
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

        dom.waveCounter.textContent = state.wave;
        dom.scoreCounter.textContent = state.score;
        // HP/XP bars: avoid division by zero
        dom.hpValue.textContent = `${Math.ceil(state.player.hp)}/${Math.ceil(state.player.maxHp)}`;
        dom.hpBar.style.width = state.player.maxHp > 0 ? `${Math.max(0, Math.min(1, state.player.hp / state.player.maxHp)) * 100}%` : '0%';
        dom.levelValue.textContent = state.player.level;
        dom.xpBar.style.width = state.player.xpToNextLevel > 0 ? `${Math.max(0, Math.min(1, state.player.xp / state.player.xpToNextLevel)) * 100}%` : '0%';
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

    function reCenterCamera() {
        if (state && state.player) {
            state.camera.x = state.player.x - canvas.width / 2;
            state.camera.y = state.player.y - canvas.height / 2;
        }
    }

    function init() {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; reCenterCamera(); });
        window.addEventListener('keydown', e => { if(state) state.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(state) state.keys[e.key.toLowerCase()] = false; });
        window.addEventListener('mousemove', e => { if(state) { state.mouse.x = e.clientX; state.mouse.y = e.clientY; } });
        document.addEventListener('visibilitychange', () => { if(document.hidden) pauseGame(); else resumeGame(); });
        dom.startButton.addEventListener('click', startGame);
        dom.restartButton.addEventListener('click', startGame);
        state = getInitialState();
        setGameState('START');
    }

    init();
});
