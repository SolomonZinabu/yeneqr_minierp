// ============================================================
// API Consistency Audit
// ============================================================
// Scans every route.ts under src/app/api/restaurants/[id]/ and reports
// which patterns each route uses for:
//   1. Auth: requireAuth vs getAuthContext vs none
//   2. Permission: requirePerm usage
//   3. Branch scope: verifyBranchAccess vs resolveBranchScope vs neither
//   4. Response shape: { data } vs raw vs { error }
//   5. Error handling: try/catch vs bare throw
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/YeneQR/src/app/api';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.ts') out.push(p);
  }
  return out;
}

const routes = walk(path.join(ROOT, 'restaurants', '[id]'));
console.log(`Scanning ${routes.length} routes under /api/restaurants/[id]/...\n`);

const findings = [];
const stats = {
  requireAuth: 0,
  getAuthContext: 0,
  noAuth: 0,
  requirePerm: 0,
  verifyBranchAccess: 0,
  resolveBranchScope: 0,
  noBranchCheck: 0,
  tryCatch: 0,
  noTryCatch: 0,
  rateLimited: 0,
  auditLogged: 0,
};

for (const route of routes) {
  const src = fs.readFileSync(route, 'utf8');
  const rel = path.relative(ROOT, route);

  // Skip webhook routes (they use signature verification, not JWT)
  if (rel.includes('webhook')) continue;

  const handlers = (src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) || []).map(h => h.replace('export async function ', ''));

  const uses = {
    requireAuth: src.includes('requireAuth('),
    getAuthContext: src.includes('getAuthContext('),
    requirePerm: src.includes('requirePerm('),
    verifyBranchAccess: src.includes('verifyBranchAccess('),
    resolveBranchScope: src.includes('resolveBranchScope('),
    tryCatch: src.includes('try {') || src.includes('try{'),
    rateLimit: src.includes('checkRateLimit(') || src.includes('RATE_LIMITS'),
    auditLog: src.includes('logStaffAction(') || src.includes('logSettingsChange(') || src.includes('AuditLog'),
  };

  // Determine auth pattern
  let authPattern;
  if (uses.requireAuth && uses.getAuthContext) authPattern = 'mixed (both)';
  else if (uses.requireAuth) { authPattern = 'requireAuth'; stats.requireAuth++; }
  else if (uses.getAuthContext) { authPattern = 'getAuthContext'; stats.getAuthContext++; }
  else { authPattern = '⚠️ NONE'; stats.noAuth++; }

  // Branch check pattern
  let branchPattern;
  if (uses.verifyBranchAccess && uses.resolveBranchScope) branchPattern = 'both';
  else if (uses.verifyBranchAccess) { branchPattern = 'verifyBranchAccess'; stats.verifyBranchAccess++; }
  else if (uses.resolveBranchScope) { branchPattern = 'resolveBranchScope'; stats.resolveBranchScope++; }
  else { branchPattern = '⚠️ none'; stats.noBranchCheck++; }

  if (uses.requirePerm) stats.requirePerm++;
  if (uses.tryCatch) stats.tryCatch++; else stats.noTryCatch++;
  if (uses.rateLimit) stats.rateLimited++;
  if (uses.auditLog) stats.auditLogged++;

  findings.push({
    route: rel,
    handlers: handlers.join(','),
    auth: authPattern,
    perm: uses.requirePerm ? '✓' : '⚠️ no',
    branch: branchPattern,
    rateLimit: uses.rateLimit ? '✓' : '—',
    audit: uses.auditLog ? '✓' : '—',
  });
}

// Print report
console.log('═══════════════════════════════════════════════════════════');
console.log('  API CONSISTENCY AUDIT REPORT');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('Summary statistics:');
console.log(`  Routes scanned:              ${findings.length}`);
console.log(`  Auth: requireAuth:           ${stats.requireAuth}`);
console.log(`  Auth: getAuthContext:        ${stats.getAuthContext}`);
console.log(`  Auth: ⚠️ NONE:               ${stats.noAuth}`);
console.log(`  Permission check (requirePerm): ${stats.requirePerm}/${findings.length}`);
console.log(`  Branch: verifyBranchAccess: ${stats.verifyBranchAccess}`);
console.log(`  Branch: resolveBranchScope: ${stats.resolveBranchScope}`);
console.log(`  Branch: ⚠️ none:             ${stats.noBranchCheck}`);
console.log(`  Rate limited:                ${stats.rateLimited}/${findings.length}`);
console.log(`  Audit logged:                ${stats.auditLogged}/${findings.length}`);
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  ROUTES WITH ⚠️ ISSUES');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Routes with no auth
const noAuth = findings.filter(f => f.auth.includes('NONE'));
if (noAuth.length > 0) {
  console.log('── ⚠️ Routes with NO auth check ──');
  noAuth.forEach(f => console.log(`  ${f.route} [${f.handlers}]`));
  console.log('');
}

// Routes with no branch check
const noBranch = findings.filter(f => f.branch === '⚠️ none');
if (noBranch.length > 0) {
  console.log('── ⚠️ Routes with NO branch scoping ──');
  noBranch.forEach(f => console.log(`  ${f.route} [${f.handlers}]`));
  console.log('');
}

// Routes with no permission check
const noPerm = findings.filter(f => f.perm === '⚠️ no');
if (noPerm.length > 0) {
  console.log('── ⚠️ Routes with NO permission check (requirePerm) ──');
  noPerm.forEach(f => console.log(`  ${f.route} [${f.handlers}]`));
  console.log('');
}

// Routes using getAuthContext instead of requireAuth
const getCtx = findings.filter(f => f.auth === 'getAuthContext');
if (getCtx.length > 0) {
  console.log('── ℹ️ Routes using getAuthContext (not requireAuth) ──');
  getCtx.forEach(f => console.log(`  ${f.route} [${f.handlers}]`));
  console.log('');
}

// Full table
console.log('═══════════════════════════════════════════════════════════');
console.log('  FULL ROUTE TABLE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('Route'.padEnd(55) + 'Auth'.padEnd(18) + 'Perm'.padEnd(8) + 'Branch'.padEnd(22) + 'Rate'.padEnd(6) + 'Audit');
console.log('-'.repeat(120));
findings.forEach(f => {
  console.log(
    f.route.padEnd(55) +
    f.auth.padEnd(18) +
    f.perm.padEnd(8) +
    f.branch.padEnd(22) +
    f.rateLimit.padEnd(6) +
    f.audit
  );
});
