import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, levelAt, createRng } from "../web/campaign.mjs";
import { Game, ARENA, sweptHit } from "../web/game.mjs";
const fresh = (level = 1) => {
  const g = new Game({ seed: 42 });
  g.reset(level);
  g.player.invincible = 0;
  return g;
};
test("campaign contains 20 unique stages and four boss encounters", () => {
  assert.equal(LEVELS.length, 20);
  assert.equal(new Set(LEVELS.map((l) => l.title)).size, 20);
  assert.deepEqual(
    LEVELS.filter((l) => l.boss).map((l) => l.number),
    [5, 10, 15, 20],
  );
  assert.deepEqual([...new Set(LEVELS.map((l) => l.region))], [0, 1, 2, 3]);
});
test("every stage increases ship and projectile speed, without decreasing wave count", () => {
  for (let i = 1; i < 20; i++) {
    assert.ok(LEVELS[i].speed > LEVELS[i - 1].speed);
    assert.ok(LEVELS[i].bulletSpeed > LEVELS[i - 1].bulletSpeed);
    assert.ok(LEVELS[i].waves >= LEVELS[i - 1].waves);
    assert.ok(LEVELS[i].fireInterval < LEVELS[i - 1].fireInterval);
  }
});
test("invalid stage numbers are rejected", () => {
  for (const n of [0, 21, 1.5, NaN])
    assert.throws(() => levelAt(n), RangeError);
});
test("seeded replays are deterministic", () => {
  let a = createRng(42),
    b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});
test("movement stays within the arena and diagonal speed is normalized", () => {
  const a = fresh(),
    b = fresh();
  a.step(0.05, { x: 1 });
  b.step(0.05, { x: 1, z: 1 });
  assert.ok(
    Math.abs(Math.hypot(b.player.x, b.player.z + 5) - a.player.x) < 1e-9,
  );
  for (let i = 0; i < 100; i++) a.step(0.05, { x: 1, z: 1 });
  assert.equal(a.player.x, ARENA.right);
  assert.equal(a.player.z, ARENA.front);
});
test("paused game freezes movement timers and all entities", () => {
  const g = fresh();
  g.fire();
  g.pause();
  const before = JSON.stringify(g);
  g.step(0.05, { x: 1, fire: true });
  assert.equal(JSON.stringify(g), before);
  g.pause();
  assert.equal(g.state, "playing");
});
test("shields absorb damage, hull follows, and protection prevents repeated hits", () => {
  const g = fresh();
  g.damage(52);
  assert.equal(g.player.shield, 0);
  assert.equal(g.player.hull, 88);
  g.damage(100);
  assert.equal(g.player.hull, 88);
  g.player.invincible = 0;
  g.damage(100);
  assert.equal(g.state, "gameover");
  assert.equal(g.player.hull, 0);
});
test("dash clears nearby hostile projectiles and enforces a cooldown", () => {
  const g = fresh();
  g.bullets = [
    { x: 0, z: -5, enemy: true },
    { x: 7, z: 10, enemy: true },
    { x: 0, z: -5, enemy: false },
  ];
  assert.equal(g.dash(), true);
  assert.equal(g.bullets.length, 2);
  assert.equal(g.dash(), false);
  assert.ok(g.player.invincible > 0);
  for (let i = 0; i < 101; i++) g.step(0.05);
  assert.equal(g.dash(), true);
});
test("firing has a cooldown and weapon tiers increase shot count", () => {
  const g = fresh();
  g.fire();
  assert.equal(g.bullets.length, 1);
  g.fire();
  assert.equal(g.bullets.length, 1);
  g.player.weapon = 3;
  g.player.fire = 0;
  g.fire();
  assert.equal(g.bullets.length, 4);
});
test("projectiles kill enemies and score exactly once", () => {
  const g = fresh();
  g.enemies = [
    {
      id: 1,
      x: 0,
      originX: -Math.sin(1) * 1,
      z: 0,
      kind: "scout",
      hp: 1,
      radius: 0.6,
      fire: 100,
      age: 0,
      speed: 0,
    },
  ];
  g.bullets = [{ x: 0, z: -0.2, vx: 0, vz: 1, damage: 1, enemy: false }];
  g.step(0.01);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.kills, 1);
  assert.equal(g.score, 100);
});
test("boss changes phase at half health and dies once", () => {
  const g = fresh(5);
  g.spawnBoss();
  g.boss.hp = g.boss.maxHP / 2;
  g.step(0.01);
  assert.equal(g.boss.phase, 2);
  g.boss.x = 0;
  g.boss.age = 0;
  g.boss.hp = 1;
  g.bullets = [{ x: 0, z: g.boss.z, vx: 0, vz: 0, damage: 1, enemy: false }];
  g.step(0.01);
  assert.equal(g.boss, null);
  assert.equal(g.kills, 1);
  assert.equal(g.score, 2500);
});
test("clear unlocks only the next stage and only upgrades advance", () => {
  const g = fresh();
  g.clear();
  assert.equal(g.state, "intermission");
  assert.equal(g.unlocked, 2);
  assert.equal(g.upgrade("invalid"), false);
  assert.equal(g.level.number, 1);
  g.upgrade("weapon");
  assert.equal(g.level.number, 2);
  assert.equal(g.player.weapon, 2);
});
test("all 20 stages transition in order, ending in victory with capped equipment", () => {
  const g = fresh();
  for (let i = 1; i <= 20; i++) {
    assert.equal(g.level.number, i);
    g.clear();
    if (i < 20) g.upgrade("weapon");
  }
  assert.equal(g.state, "victory");
  assert.equal(g.unlocked, 20);
  assert.equal(g.player.weapon, 5);
  assert.equal(g.upgrade("weapon"), false);
});
test("repair and shield upgrades cap their values and stage transition clears hazards", () => {
  const g = fresh();
  g.player.hull = 20;
  g.clear();
  g.upgrade("repair");
  assert.equal(g.player.hull, 100);
  g.clear();
  g.upgrade("shield");
  assert.equal(g.player.shield, 60);
  assert.equal(g.bullets.length, 0);
  assert.equal(g.enemies.length, 0);
});
test("long simulation cleans expired objects and keeps particle count bounded", () => {
  const g = fresh(20);
  g.player.invincible = Infinity;
  for (let i = 0; i < 6000; i++) {
    g.step(1 / 60, { fire: true, x: Math.sin(i / 100) });
    if (i % 30 === 0) g.burst(0, 0, [1, 1, 1], 100);
  }
  assert.ok(g.particles.length <= 280);
  assert.ok(g.bullets.length < 300);
  assert.ok(g.enemies.length <= g.level.count);
});

test("swept collision catches fast shots that cross a target between frames", () => {
  assert.equal(
    sweptHit({ x: 0, z: -2 }, { x: 0, z: 2 }, { x: 0, z: 0 }, 0.2),
    true,
  );
  assert.equal(
    sweptHit({ x: 1, z: -2 }, { x: 1, z: 2 }, { x: 0, z: 0 }, 0.2),
    false,
  );
});
