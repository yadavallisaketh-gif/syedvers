// Headless check of the production build: screenshots + network/console audit.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run screenshot -- --url http://localhost:4173/ --out ../screenshots
//
// Uses playwright-core with an existing Chromium (CHROMIUM_PATH, or the Playwright browser cache).
// Exits non-zero if the page logs errors or requests anything outside localhost; warnings are
// reported but don't fail (R3F 9 itself logs a THREE.Clock deprecation warning on three r18x).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const url = arg('url', 'http://localhost:4173/')
const out = resolve(arg('out', 'screenshots'))
mkdirSync(out, { recursive: true })

const candidates = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean)
const executablePath = candidates.find((p) => existsSync(p))

const shots = [
  { name: 'desktop-chase', viewport: { width: 1440, height: 900 }, query: '?replay=S1_1230&t=42&cam=chase' },
  { name: 'desktop-orbit', viewport: { width: 1440, height: 900 }, query: '?replay=S1_1230&t=58&cam=orbit' },
  { name: 'desktop-plan', viewport: { width: 1440, height: 900 }, query: '?replay=S1_1230&t=62&cam=plan', settle: 9000 },
  { name: 'desktop-pre-blackout', viewport: { width: 1440, height: 900 }, query: '?replay=S1_1230&t=-6&cam=chase' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, query: '?replay=S1_1230&t=42&cam=chase', fullPage: true },
]

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const report = { url, external: [], errors: [], warnings: [], shots: [] }
const host = new URL(url).host

for (const s of shots) {
  const page = await browser.newPage({ viewport: s.viewport, deviceScaleFactor: 1 })
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.protocol.startsWith('http') && u.host !== host) report.external.push(req.url())
  })
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(`[${s.name}] ${m.text()}`)
    else if (m.type() === 'warning') report.warnings.push(`[${s.name}] ${m.text()}`)
  })
  page.on('pageerror', (e) => report.errors.push(`[${s.name}] pageerror: ${e.message}`))

  await page.goto(url + s.query, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 30000 })
  await page.waitForFunction(() => document.body.innerText.includes('ENGINE') || document.body.innerText.includes('SYNTHETIC'), null, { timeout: 30000 })
  await page.waitForTimeout(s.settle ?? 4000) // environment bake, shadow/AO warm-up, camera easing (software GL is slow)
  const file = join(out, `${s.name}.png`)
  await page.screenshot({ path: file, fullPage: Boolean(s.fullPage) })
  report.shots.push(file)

  if (s.name === 'desktop-chase') {
    // hotkeys: 3 -> plan, Space -> play for a moment, ArrowRight -> +1 s
    const readT = () => page.$eval('input[type=range]', (el) => Number(el.value))
    const t0 = await readT()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(150)
    const t1 = await readT()
    await page.keyboard.press('3')
    const plan = await page.$eval('[aria-label="Camera"] [aria-checked="true"]', (el) => el.textContent)
    await page.keyboard.press('Space')
    await page.waitForTimeout(4000) // software GL can drop to ~0.5 fps; leave room for a few frames
    await page.keyboard.press('Space')
    const t2 = await readT()
    const lines = await page.$eval('[role=log]', (el) => el.children.length)
    report.hotkeys = { arrowRight: +(t1 - t0).toFixed(2), cameraAfter3: plan, advancedWhilePlaying: +(t2 - t1).toFixed(2), consoleLines: lines }
  }
  await page.close()
}

await browser.close()
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(report.external.length || report.errors.length ? 1 : 0)
