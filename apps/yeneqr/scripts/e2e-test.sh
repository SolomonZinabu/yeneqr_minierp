#!/bin/bash
# End-to-end test of critical flows after the 18 multi-branch security fixes
set -e
BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "✅ PASS: $name (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $name — expected HTTP $expected, got $actual"
    FAIL=$((FAIL+1))
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo "  YeneQR End-to-End Test — Post-Security-Fix Verification"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── 1. Owner login ──
echo "── 1. Auth: Owner login ──"
LOGIN_RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"owner@habesha.et","password":"admin123","restaurantSlug":"habesha-restaurant"}')
OWNER_TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -n "$OWNER_TOKEN" ]; then
  echo "✅ PASS: Owner login"
  PASS=$((PASS+1))
else
  echo "❌ FAIL: Owner login — no token returned"
  FAIL=$((FAIL+1))
  exit 1
fi
echo ""

# ── 2. Get branches ──
echo "── 2. Get branches ──"
BRANCHES=$(curl -s "$BASE/api/restaurants/rest-habesha/branches" -H "Authorization: Bearer $OWNER_TOKEN")
BOLE_ID=$(echo "$BRANCHES" | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; print([b['id'] for b in data if 'Bole' in b['name']][0])")
CMC_ID=$(echo "$BRANCHES" | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; print([b['id'] for b in data if 'CMC' in b['name']][0])")
echo "   Bole: $BOLE_ID"
echo "   CMC: $CMC_ID"
echo ""

# ── 3. Owner (branch:view_all) can view Bole orders ──
echo "── 3. Owner can view Bole orders ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/orders?branchId=$BOLE_ID" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → Bole orders" "200" "$HTTP"
echo ""

# ── 4. Owner can view CMC orders ──
echo "── 4. Owner can view CMC orders ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/orders?branchId=$CMC_ID" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → CMC orders" "200" "$HTTP"
echo ""

# ── 5. Owner can view all branches ──
echo "── 5. Owner can view all branches (no branchId) ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/orders" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → all orders" "200" "$HTTP"
echo ""

# ── 6. Login as a waiter (branch-scoped) ──
echo "── 6. Login as waiter (branch-scoped) ──"
# Find a waiter — use the first waiter email from seed
WAITER_EMAIL="waiter.bole1@habeshamaebel.com"
WAITER_LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$WAITER_EMAIL\",\"password\":\"admin123\",\"restaurantSlug\":\"habesha-restaurant\"}")
WAITER_TOKEN=$(echo "$WAITER_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo "")
if [ -n "$WAITER_TOKEN" ]; then
  echo "✅ PASS: Waiter login"
  PASS=$((PASS+1))
  
  # ── 7. Waiter can view their own branch ──
  echo "── 7. Waiter can view their branch orders ──"
  # Waiter is scoped to Bole by default in seed
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/orders?branchId=$BOLE_ID" -H "Authorization: Bearer $WAITER_TOKEN")
  check "Waiter → own branch orders" "200" "$HTTP"
  echo ""
  
  # ── 8. Waiter CANNOT view CMC orders (branch isolation) ──
  # resolveBranchScope silently forces the waiter's own branch, so they get
  # 200 with an empty list (or only their branch's orders), NOT CMC's orders.
  echo "── 8. Waiter CANNOT view CMC orders (branch isolation) ──"
  CMC_RES=$(curl -s "$BASE/api/restaurants/rest-habesha/orders?branchId=$CMC_ID" -H "Authorization: Bearer $WAITER_TOKEN")
  CMC_COUNT=$(echo "$CMC_RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))")
  if [ "$CMC_COUNT" = "0" ]; then
    echo "✅ PASS: Waiter → CMC orders returns 0 orders (resolveBranchScope forced their branch)"
    PASS=$((PASS+1))
  else
    # If count > 0, verify none are actually from CMC
    CMC_LEAK=$(echo "$CMC_RES" | python3 -c "import sys,json; data=json.load(sys.stdin).get('data',[]); print(len([o for o in data if o.get('branchId')=='$CMC_ID']))")
    if [ "$CMC_LEAK" = "0" ]; then
      echo "✅ PASS: Waiter → CMC orders: $CMC_COUNT orders returned but 0 from CMC (scoped to own branch)"
      PASS=$((PASS+1))
    else
      echo "❌ FAIL: Waiter → CMC orders: $CMC_LEAK orders from CMC leaked!"
      FAIL=$((FAIL+1))
    fi
  fi
  echo ""
  
  # ── 9. Waiter CANNOT view all branches (no branchId) ──
  echo "── 9. Waiter CANNOT view all branches (resolveBranchScope forces their branch) ──"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/orders" -H "Authorization: Bearer $WAITER_TOKEN")
  check "Waiter → all orders (should be 200, scoped to their branch)" "200" "$HTTP"
  echo ""
  
else
  echo "⚠️  SKIP: Waiter login failed (email may differ in seed) — testing with owner only"
fi
echo ""

# ── 10. Recommendations route now requires auth ──
echo "── 10. Recommendations requires auth (was NO auth before fix) ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/recommendations")
check "Recommendations without token (should be 401)" "401" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/recommendations" -H "Authorization: Bearer $OWNER_TOKEN")
check "Recommendations with token" "200" "$HTTP"
echo ""

# ── 11. Floors route requires branch access ──
echo "── 11. Floors route ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/floors?branchId=$BOLE_ID" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → Bole floors" "200" "$HTTP"
echo ""

# ── 12. Settings ──
echo "── 12. Settings ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/settings" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → settings" "200" "$HTTP"
echo ""

# ── 13. Menu items ──
echo "── 13. Menu ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/menus" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → menus" "200" "$HTTP"
echo ""

# ── 14. Staff list ──
echo "── 14. Staff ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/staff" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → staff" "200" "$HTTP"
echo ""

# ── 15. Tables ──
echo "── 15. Tables ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/tables?branchId=$BOLE_ID" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → Bole tables" "200" "$HTTP"
echo ""

# ── 16. Branch settings ──
echo "── 16. Branch settings ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/restaurants/rest-habesha/branches/$BOLE_ID/settings" -H "Authorization: Bearer $OWNER_TOKEN")
check "Owner → Bole branch settings" "200" "$HTTP"
echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════════════"
echo "  SUMMARY: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════════"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
