// ============================================================
// UI vs API Audit
// ============================================================
// Walks src/components and src/app for API calls (api.get/post/put/delete),
// and src/app/api for route exports. Then prints:
//   1. API routes that NO UI file calls (orphan APIs)
//   2. UI calls to endpoints that DON'T exist as routes (broken UI calls)
//   3. File-by-file list of what each UI component calls
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/YeneQR';

// ── 1. Collect all API route files ──
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.ts' || e.name === 'route.tsx') out.push(p);
  }
  return out;
}

const routeFiles = walk(path.join(ROOT, 'src/app/api'));

// Convert route file path → URL pattern (very rough — replace [x] with {x}, drop /route.ts)
function routeToUrl(file) {
  let rel = path.relative(path.join(ROOT, 'src/app/api'), file);
  rel = rel.replace(/\\/g, '/');
  rel = rel.replace(/\/route\.tsx?$/, '');
  // Replace dynamic segments [id] → {x} (unified name so they match UI normalized calls)
  rel = rel.replace(/\[([^\]]+)\]/g, '{x}');
  // The "enuId]" typo in the codebase stays as a literal segment — leave it
  return '/api/' + rel;
}

const apiUrls = new Set();
const apiByFile = {};
for (const f of routeFiles) {
  const url = routeToUrl(f);
  apiUrls.add(url);
  apiByFile[url] = f;
}

// ── 2. Collect UI calls (api.X('...')) ──
const uiFiles = [];
function walkUi(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walkUi(p);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      uiFiles.push(p);
    }
  }
}
walkUi(path.join(ROOT, 'src'));

// Match api.get/post/put/delete/patch(`...`) or fetch(`...`)
const callRe = /(?:api\.(?:get|post|put|delete|patch)|fetch)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;

const callsByFile = {};
const allCalls = []; // { file, url }
for (const f of uiFiles) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = callRe.exec(src)) !== null) {
    const raw = m[1];
    callsByFile[f] = callsByFile[f] || [];
    callsByFile[f].push(raw);
    allCalls.push({ file: f, url: raw });
  }
}

// ── 3. Normalize UI calls to match route patterns ──
// UI usually passes template strings like `/api/restaurants/${restaurantId}/orders`
// We replace ${...} with {x} for matching against apiUrls.
function normalizeUiCall(url) {
  // Strip query string
  let u = url.split('?')[0];
  // Replace ${...} template vars with {x}
  u = u.replace(/\$\{[^}]+\}/g, '{x}');
  // Replace actual cuid/uuid/slug literals with {x} when they look like ids
  // (heuristic: 20+ char alphanumeric)
  u = u.replace(/\/[a-f0-9]{20,}/gi, '/{x}');
  u = u.replace(/\/cm[a-z0-9]{20,}/gi, '/{x}');
  return u;
}

// ── 4. Find orphan APIs (no UI caller) ──
const normalizedCalls = new Set();
for (const c of allCalls) {
  normalizedCalls.add(normalizeUiCall(c.url));
}

const orphanApis = [];
for (const apiUrl of [...apiUrls].sort()) {
  // Skip pure webhook / cron / internal routes — they legitimately have no UI caller
  if (apiUrl.includes('/webhook/') || apiUrl.includes('/cron/') || apiUrl === '/api/files/{x}' || apiUrl === '/api/events' || apiUrl === '/api/socketio' || apiUrl === '/api/billing/cron') continue;
  // Skip auth internals that are wired via api-client interceptor (refresh, etc.)
  if (apiUrl === '/api/auth/refresh') continue;
  if (!normalizedCalls.has(apiUrl)) {
    orphanApis.push(apiUrl);
  }
}

// ── 5. Find broken UI calls (no matching route) ──
const brokenCalls = [];
const seen = new Set();
for (const c of allCalls) {
  const norm = normalizeUiCall(c.url);
  if (seen.has(norm + '|' + c.file)) continue;
  seen.add(norm + '|' + c.file);
  if (!apiUrls.has(norm)) {
    // Special case: the "enuId]" typo route — skip
    if (norm.includes('menus/enuId]')) continue;
    brokenCalls.push({ file: path.relative(ROOT, c.file), url: c.url, normalized: norm });
  }
}

// ── 6. Print report ──
console.log('============================================================');
console.log('  UI vs API AUDIT REPORT');
console.log('============================================================');
console.log('');
console.log(`API routes found:     ${apiUrls.size}`);
console.log(`UI files scanned:     ${uiFiles.length}`);
console.log(`UI → API calls found: ${allCalls.length}`);
console.log(`Unique normalized:    ${normalizedCalls.size}`);
console.log('');

console.log('============================================================');
console.log(`  ORPHAN APIs — routes with no UI caller (${orphanApis.length})`);
console.log('============================================================');
orphanApis.forEach(u => console.log('  ' + u));

console.log('');
console.log('============================================================');
console.log(`  BROKEN UI CALLS — UI calls with no matching route (${brokenCalls.length})`);
console.log('============================================================');
brokenCalls.forEach(c => console.log(`  ${c.file}`));
brokenCalls.forEach(c => console.log(`     url: ${c.url}`));
brokenCalls.forEach(c => console.log(`     norm: ${c.normalized}`));

console.log('');
console.log('============================================================');
console.log('  Per-file UI → API call map (only files with calls)');
console.log('============================================================');
for (const f of Object.keys(callsByFile).sort()) {
  const rel = path.relative(ROOT, f);
  console.log('');
  console.log('--- ' + rel + ' ---');
  for (const url of callsByFile[f]) {
    const norm = normalizeUiCall(url);
    const exists = apiUrls.has(norm) || norm.includes('menus/enuId]');
    console.log(`  [${exists ? 'OK' : 'MISS'}] ${url}`);
  }
}
