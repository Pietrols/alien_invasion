import { Game } from "./game.mjs";
import { LEVELS, REGIONS, clamp } from "./campaign.mjs";
import { Renderer } from "./renderer.mjs";
import { Audio } from "./audio.mjs";
const $ = (id) => document.getElementById(id);
const ui = {
  menu: $("menu"),
  hud: $("hud"),
  overlay: $("overlay"),
  dialog: $("dialog"),
  toast: $("toast"),
  canvas: $("scene"),
};
const audio = new Audio();
let renderer,
  game,
  autoFire = true,
  target = null,
  lastTime = 0,
  toastTimer,
  mapReturn = "menu",
  lastFocus = null;
const keys = new Set(),
  roman = ["I", "II", "III", "IV", "V"];
const STORAGE = "void-runner.v1";
function load() {
  try {
    let s = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    return {
      best: Number.isFinite(s.best) ? clamp(s.best, 0, 1e9) : 0,
      unlocked: Number.isInteger(s.unlocked) ? clamp(s.unlocked, 1, 20) : 1,
      audio: s.audio !== false,
    };
  } catch {
    return { best: 0, unlocked: 1, audio: true };
  }
}
const saved = load();
audio.enabled = saved.audio;
function save() {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        best: game.best,
        unlocked: game.unlocked,
        audio: audio.enabled,
      }),
    );
  } catch {
    /* Private browsing can disable storage; play remains available. */
  }
}
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2300);
}
function showDialog(markup) {
  lastFocus = document.activeElement;
  ui.dialog.innerHTML = markup;
  ui.overlay.hidden = false;
  ui.dialog.querySelector("button")?.focus();
}
function hideDialog() {
  ui.overlay.hidden = true;
  ui.dialog.innerHTML = "";
  lastFocus?.focus();
}
function stats() {
  return `<div class="result-stats"><div><strong>${game.score.toLocaleString()}</strong><span>MISSION SCORE</span></div><div><strong>${game.kills}</strong><span>HOSTILES DOWN</span></div><div><strong>${String(game.level.number).padStart(2, "0")}</strong><span>SECTOR REACHED</span></div></div>`;
}
function updateMenu() {
  $("best").textContent = String(game.best).padStart(6, "0");
  $("resume-btn").hidden = game.unlocked <= 1;
}
function launch(level = 1) {
  audio.unlock();
  keys.clear();
  target = null;
  hideDialog();
  game.reset(level);
  ui.menu.hidden = true;
  ui.hud.hidden = false;
  $("pause-btn").hidden = false;
}
function returnToMenu() {
  game.best = Math.max(game.best, game.score);
  save();
  game.state = "menu";
  game.enemies = [];
  game.bullets = [];
  game.particles = [];
  game.pickups = [];
  game.boss = null;
  game.player.x = 3;
  game.player.z = 1;
  game.player.shield = 40;
  ui.menu.hidden = false;
  ui.hud.hidden = true;
  $("boss-hud").hidden = true;
  $("pause-btn").hidden = true;
  hideDialog();
  updateMenu();
}
function paused() {
  showDialog(
    `<span class="eyebrow green">FLIGHT ON HOLD</span><h2 id="dialog-title">Catch your breath.</h2><p>The stars can wait. Your mission is paused.</p><div class="dialog-actions"><button class="primary" data-action="resume">RESUME FLIGHT ↗</button><button class="secondary" data-action="menu">MAIN MENU</button></div>`,
  );
}
function sectorMap() {
  mapReturn = game.state;
  if (game.state === "playing") game.pause();
  if (
    game.state === "intermission" ||
    game.state === "gameover" ||
    game.state === "victory"
  )
    return;
  showDialog(
    `<span class="eyebrow green">CAMPAIGN / ${game.unlocked} OF 20 SECTORS UNLOCKED</span><h2 id="dialog-title">Into the unknown.</h2><p>Resume at any unlocked sector. A sector launch starts a fresh score and standard equipment.</p><div class="sectors">${LEVELS.map((l) => `<button class="sector ${l.boss ? "boss-sector" : ""}" data-level="${l.number}" ${l.number > game.unlocked ? "disabled" : ""} aria-label="Sector ${l.number}: ${l.title}${l.boss ? ", boss encounter" : ""}${l.number > game.unlocked ? ", locked" : ""}">${String(l.number).padStart(2, "0")}<small>${l.boss ? "BOSS" : l.number > game.unlocked ? "LOCKED" : "SECTOR"}</small></button>`).join("")}</div><p>01–05 Outer Rim · 06–10 Ember Nebula<br>11–15 Glass Expanse · 16–20 Event Horizon</p><div class="dialog-actions"><button class="secondary" data-action="close-map">BACK TO ${mapReturn === "menu" ? "HANGAR" : "FLIGHT"}</button></div>`,
  );
}
function onEvent(event) {
  audio.play(event.type);
  switch (event.type) {
    case "level":
      $("region-label").textContent = REGIONS[event.level.region].name;
      $("sector-label").textContent = String(event.level.number).padStart(
        2,
        "0",
      );
      toast(
        `SECTOR ${String(event.level.number).padStart(2, "0")} / ${event.level.title.toUpperCase()}`,
      );
      break;
    case "boss":
      toast(`WARNING / ${event.name.toUpperCase()} APPROACHING`);
      break;
    case "damage":
      break;
    case "pickup":
      toast(
        event.kind === "repair" ? "HULL REPAIRED +18" : "SHIELD RECHARGED +22",
      );
      break;
    case "pause":
      keys.clear();
      target = null;
      paused();
      break;
    case "resume":
      hideDialog();
      break;
    case "clear":
      save();
      showDialog(
        `<span class="eyebrow green">SECTOR ${String(game.level.number).padStart(2, "0")} SECURED${event.perfect ? " / FLAWLESS FLIGHT" : ""}</span><h2 id="dialog-title">Make the next move.</h2><p>Choose one upgrade. Each new sector also restores 20 hull and 15 shield.</p>${stats()}<div class="upgrades"><button class="upgrade" data-upgrade="weapon"><b>↗</b><strong>${game.player.weapon === 5 ? "WEAPONS MAXED" : "UPGRADE WEAPONS"}</strong><span>${game.player.weapon === 5 ? "Keep your MK V arsenal." : "More firepower. Faster shots. MK " + roman[Math.min(4, game.player.weapon)] + "."}</span></button><button class="upgrade" data-upgrade="repair"><b>+</b><strong>FULL REPAIR</strong><span>Restore hull integrity to 100.</span></button><button class="upgrade" data-upgrade="shield"><b>◇</b><strong>SHIELD CHARGE</strong><span>Refill shields to 60. Absorb the next impact.</span></button></div>`,
      );
      break;
    case "gameover":
      game.best = Math.max(game.best, game.score);
      save();
      showDialog(
        `<span class="eyebrow">SIGNAL LOST / SECTOR ${game.level.number}</span><h2 id="dialog-title">A good run. Go further.</h2>${stats()}<p>Your unlocked sectors are saved. Relaunch here with a fresh score.</p><div class="dialog-actions"><button class="primary" data-action="retry">RETRY SECTOR ↗</button><button class="secondary" data-action="new">NEW CAMPAIGN</button><button class="secondary" data-action="menu">HANGAR</button></div>`,
      );
      break;
    case "victory":
      game.best = Math.max(game.best, game.score);
      save();
      showDialog(
        `<span class="eyebrow green">ALL 20 SECTORS SECURED</span><h2 id="dialog-title">You brought the light back.</h2><p>The World Eater is gone. The frontier is yours.</p>${stats()}<div class="dialog-actions"><button class="primary" data-action="new">FLY AGAIN ↗</button><button class="secondary" data-action="menu">RETURN TO HANGAR</button></div>`,
      );
      break;
  }
}
try {
  renderer = new Renderer(ui.canvas);
  game = new Game();
  game.onEvent = onEvent;
  game.best = saved.best;
  game.unlocked = saved.unlocked;
  game.player.x = 3;
  game.player.z = 1;
  updateMenu();
} catch (error) {
  ui.menu.hidden = true;
  const message = document.createElement("div");
  message.className = "error-message";
  message.setAttribute("role", "alert");
  message.textContent = error.message;
  ui.canvas.after(message);
  throw error;
}
$("audio-btn").textContent = audio.enabled ? "SOUND ON" : "SOUND OFF";
$("audio-btn").setAttribute("aria-pressed", String(!audio.enabled));
$("audio-btn").setAttribute(
  "aria-label",
  audio.enabled ? "Mute audio" : "Enable audio",
);
$("start-btn").onclick = () => launch();
$("resume-btn").onclick = () => launch(game.unlocked);
$("map-btn").onclick = sectorMap;
$("pause-btn").onclick = () => game.pause();
$("touch-dash").onclick = () => {
  audio.unlock();
  game.dash();
};
$("audio-btn").onclick = () => {
  audio.enabled = !audio.enabled;
  audio.unlock();
  $("audio-btn").textContent = audio.enabled ? "SOUND ON" : "SOUND OFF";
  $("audio-btn").setAttribute("aria-pressed", String(!audio.enabled));
  $("audio-btn").setAttribute(
    "aria-label",
    audio.enabled ? "Mute audio" : "Enable audio",
  );
  save();
};
$("autofire-btn").onclick = () => {
  autoFire = !autoFire;
  $("autofire-btn").textContent = autoFire ? "AUTO FIRE ON" : "AUTO FIRE OFF";
  $("autofire-btn").setAttribute("aria-pressed", String(autoFire));
};
$("fullscreen-btn").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("void-runner").requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this preview.");
  }
};
ui.dialog.onclick = (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  audio.unlock();
  if (b.dataset.level) {
    launch(Number(b.dataset.level));
    return;
  }
  if (b.dataset.upgrade) {
    hideDialog();
    game.upgrade(b.dataset.upgrade);
    return;
  }
  switch (b.dataset.action) {
    case "resume":
      game.pause();
      break;
    case "menu":
      returnToMenu();
      break;
    case "new":
      launch();
      break;
    case "retry":
      launch(game.level.number);
      break;
    case "close-map":
      hideDialog();
      if (mapReturn === "playing") game.pause();
      else if (mapReturn === "paused") paused();
      break;
  }
};
// Capture controls only during flight; buttons keep their normal keyboard behavior.
window.addEventListener("keydown", (e) => {
  if (
    ![
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "ShiftLeft",
      "ShiftRight",
      "KeyP",
      "Escape",
    ].includes(e.code)
  )
    return;
  if (e.code === "Escape") {
    if (game.state === "playing") game.pause();
    else if (!ui.overlay.hidden)
      ui.dialog
        .querySelector('[data-action="close-map"],[data-action="resume"]')
        ?.click();
    return;
  }
  if (e.code === "KeyP" && !e.repeat) {
    game.pause();
    return;
  }
  if (game.state !== "playing") return;
  if (e.target instanceof HTMLButtonElement && e.code === "Space") return;
  e.preventDefault();
  keys.add(e.code);
  target = null;
  if (e.code.startsWith("Shift") && !e.repeat) game.dash();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  target = null;
  if (game.state === "playing") game.pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing") game.pause();
});
ui.overlay.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focusable = [...ui.dialog.querySelectorAll("button:not(:disabled)")];
  const first = focusable[0],
    last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
ui.canvas.addEventListener("pointerdown", (e) => {
  if (game.state !== "playing") return;
  audio.unlock();
  ui.canvas.setPointerCapture(e.pointerId);
  target = renderer.pointer(e.clientX, e.clientY);
});
ui.canvas.addEventListener("pointermove", (e) => {
  if (ui.canvas.hasPointerCapture(e.pointerId) && game.state === "playing")
    target = renderer.pointer(e.clientX, e.clientY);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  ui.canvas.addEventListener(type, () => (target = null));
ui.canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  if (game.state === "playing") game.pause();
  toast("Graphics connection lost. Reload to restore the flight deck.");
});
function frame(ms) {
  const time = ms * 0.001,
    dt = lastTime ? Math.min(0.05, time - lastTime) : 0;
  lastTime = time;
  const input = {
    x:
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft")),
    z:
      Number(keys.has("KeyW") || keys.has("ArrowUp")) -
      Number(keys.has("KeyS") || keys.has("ArrowDown")),
    fire: autoFire || keys.has("Space"),
    target,
  };
  game.step(dt, input);
  renderer.render(game, time);
  const p = game.player;
  $("score").textContent = String(game.score).padStart(6, "0");
  $("combo").textContent =
    `COMBO ×${1 + Math.min(4, Math.floor(game.combo / 5))}${game.combo > 0 ? " / " + game.combo + " HITS" : ""}`;
  $("hull-value").textContent = Math.ceil(p.hull);
  $("shield-value").textContent = Math.ceil(p.shield);
  $("hull-bar").style.width = p.hull + "%";
  $("shield-bar").style.width = (p.shield / 60) * 100 + "%";
  $("weapon-label").textContent = "INTERCEPTOR / MK " + roman[p.weapon - 1];
  $("dash-label").textContent =
    p.dash > 0 ? "DASH / " + p.dash.toFixed(1) + "s" : "DASH READY";
  $("flight-status").textContent =
    game.state === "menu"
      ? "AWAITING PILOT"
      : game.state === "playing"
        ? `WAVE ${Math.min(game.wave + 1, game.level.waves)} / ${game.level.waves}`
        : game.state.toUpperCase();
  $("boss-hud").hidden = !game.boss;
  if (game.boss) {
    $("boss-name").textContent = game.level.title.toUpperCase();
    $("boss-phase").textContent =
      game.boss.phase === 2 ? "ENRAGED / II" : "PHASE I";
    $("boss-bar").style.width =
      Math.max(0, (game.boss.hp / game.boss.maxHP) * 100) + "%";
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only diagnostics for smoke tests and performance inspection.
globalThis.voidRunner = {
  snapshot: () => ({
    state: game.state,
    level: game.level.number,
    score: game.score,
    hull: game.player.hull,
    shield: game.player.shield,
    weapon: game.player.weapon,
    enemies: game.enemies.length,
    bullets: game.bullets.length,
    player: { x: game.player.x, z: game.player.z },
    unlocked: game.unlocked,
  }),
};
