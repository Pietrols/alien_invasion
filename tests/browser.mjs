/** Optional browser checks: npm install --no-save playwright@1.62.1 first. */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(import.meta.dirname, "..");

test(
  "3D browser flight, pause, controls, map, persistence and responsive layout",
  { timeout: 60000 },
  async () => {
    const server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/render-fixture") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html><body style="margin:0;background:#080c16"><canvas id="fixture" style="display:block;width:100vw;height:100vh"></canvas></body></html>',
        );
        return;
      }
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + "/")) {
        res.writeHead(403).end();
        return;
      }
      try {
        const body = await readFile(file);
        res.setHeader(
          "Content-Type",
          {
            ".mjs": "application/javascript",
            ".css": "text/css",
            ".html": "text/html",
          }[extname(file)] || "application/octet-stream",
        );
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.BROWSER_EXECUTABLE || undefined,
        args: [
          "--no-sandbox",
          "--use-gl=angle",
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
        ],
      });
      const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(
        () => globalThis.voidRunner?.snapshot().state === "menu",
      );
      assert.equal(await page.locator("#start-btn").isVisible(), true);
      const screenshots = process.env.SCREENSHOT_DIR;
      if (screenshots) {
        await mkdir(screenshots, { recursive: true });
        await page.screenshot({ path: resolve(screenshots, "hangar.png") });
      }
      await page.locator("#start-btn").click();
      await page.waitForFunction(() => voidRunner.snapshot().enemies >= 2);
      await page.keyboard.press("KeyP");
      assert.equal(
        await page.evaluate(() => voidRunner.snapshot().state),
        "paused",
      );
      const frozen = await page.evaluate(() => voidRunner.snapshot());
      await page.waitForTimeout(250);
      assert.deepEqual(
        await page.evaluate(() => voidRunner.snapshot()),
        frozen,
      );
      await page.locator('[data-action="resume"]').click();
      await page.keyboard.down("KeyD");
      await page.waitForFunction(() => voidRunner.snapshot().player.x > 2);
      await page.keyboard.up("KeyD");
      await page.keyboard.press("Shift");
      await page.waitForFunction(() =>
        document.getElementById("dash-label").textContent.includes("s"),
      );
      if (screenshots)
        await page.screenshot({ path: resolve(screenshots, "combat.png") });
      await page.keyboard.press("KeyP");
      await page.locator('[data-action="menu"]').click();
      await page.locator("#map-btn").click();
      assert.equal(await page.locator("[data-level]").count(), 20);
      assert.equal(await page.locator("[data-level]:disabled").count(), 19);
      await page.locator('[data-action="close-map"]').click();
      await page.locator("#audio-btn").click();
      await page.reload();
      assert.equal(await page.locator("#audio-btn").textContent(), "SOUND OFF");
      // Validate saved checkpoints, including the final sector, without a production cheat API.
      await page.evaluate(() =>
        localStorage.setItem(
          "void-runner.v1",
          JSON.stringify({ best: 4200, unlocked: 20, audio: false }),
        ),
      );
      await page.reload();
      await page.locator("#map-btn").click();
      assert.equal(await page.locator("[data-level]:disabled").count(), 0);
      await page.locator('[data-level="20"]').click();
      assert.equal(await page.evaluate(() => voidRunner.snapshot().level), 20);
      await page.keyboard.press("KeyP");
      await page.locator('[data-action="menu"]').click();
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `overflow at ${width}px`,
        );
      }
      if (screenshots)
        await page.screenshot({ path: resolve(screenshots, "tablet.png") });
      const touch = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const mobile = await touch.newPage();
      await mobile.goto(`http://127.0.0.1:${server.address().port}`);
      await mobile.locator("#start-btn").tap();
      assert.equal(await mobile.locator("#touch-dash").isVisible(), true);
      await mobile.locator("#touch-dash").tap();
      await mobile.waitForFunction(() =>
        document.getElementById("dash-label").textContent.includes("s"),
      );
      mobile.on("pageerror", (e) => errors.push(e.message));
      const box = await mobile.locator("#scene").boundingBox();
      await mobile.mouse.move(
        box.x + box.width * 0.7,
        box.y + box.height * 0.65,
      );
      await mobile.mouse.down();
      await mobile.waitForFunction(() => voidRunner.snapshot().player.x > 1);
      await mobile.mouse.up();
      await mobile.keyboard.press("KeyP");
      const fixture = await browser.newPage({
        viewport: { width: 1024, height: 768 },
      });
      fixture.on("pageerror", (e) => errors.push(e.message));
      await fixture.goto(
        `http://127.0.0.1:${server.address().port}/render-fixture`,
      );
      const graphics = await fixture.evaluate(async () => {
        const { Game } = await import("/web/game.mjs");
        const { Renderer } = await import("/web/renderer.mjs");
        const canvas = document.getElementById("fixture"),
          renderer = new Renderer(canvas),
          g = new Game({ seed: 42 }),
          results = [];
        for (const level of [5, 10, 15, 20]) {
          g.reset(level);
          g.wave = g.level.waves;
          g.spawnBoss();
          g.boss.hp = g.boss.maxHP / 2;
          g.boss.fire = 0;
          g.step(0.01);
          renderer.render(g, 4);
          const pixel = new Uint8Array(4);
          renderer.gl.readPixels(
            canvas.width / 2,
            canvas.height / 2,
            1,
            1,
            renderer.gl.RGBA,
            renderer.gl.UNSIGNED_BYTE,
            pixel,
          );
          results.push({
            level,
            error: renderer.gl.getError(),
            pixel: [...pixel],
            bullets: g.bullets.length,
          });
        }
        return results;
      });
      for (const result of graphics) {
        assert.equal(result.error, 0);
        assert.ok(result.pixel.slice(0, 3).some((v) => v > 0));
        assert.ok(result.bullets > 0);
      }
      if (screenshots)
        await fixture.screenshot({
          path: resolve(screenshots, "world-eater.png"),
        });
      assert.deepEqual(errors, []);
      console.log(
        "Verified WebGL render, flight inputs, dash, pause, map, persisted settings and 320–1440px layouts.",
      );
    } finally {
      await browser?.close();
      await new Promise((r) => server.close(r));
    }
  },
);
