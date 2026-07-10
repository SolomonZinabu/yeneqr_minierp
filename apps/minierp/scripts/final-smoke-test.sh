#!/bin/bash
# scripts/final-smoke-test.sh — start server, test everything, report.
set -e
cd /home/z/my-project/yeneqr_minierp/apps/minierp

echo "=== Starting dev server on :3000 ==="
pkill -f "next dev" 2>/dev/null || true
sleep 2
rm -f logs/dev.log
setsid bash -c 'npm run dev > logs/dev.log 2>&1' < /dev/null &
disown 2>/dev/null

for i in {1..60}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    echo "✓ Server ready after ${i}s"
    break
  fi
  sleep 1
done
sleep 5  # extra time for compilation

echo ""
echo "=== Basic ==="
curl -s -o /dev/null -w "GET /api/health → %{http_code}\n" http://localhost:3000/api/health
curl -s -o /dev/null -w "GET /login → %{http_code}\n" http://localhost:3000/login

TENANT_ID=$(npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.tenant.findUnique({where:{slug:'demo-restaurant'},select:{id:true}}).then(t=>{console.log(t?.id??'');p.\$disconnect()});" 2>&1 | tail -1)
echo "Tenant: $TENANT_ID"

echo ""
echo "=== Sign in (owner) ==="
SIGNIN_CODE=$(curl -s -c /tmp/cookies.txt -o /tmp/signin.json -w "%{http_code}" -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"owner@demo.et","password":"demo1234"}')
echo "  HTTP: $SIGNIN_CODE"
echo "  Body: $(head -c 120 /tmp/signin.json)"
echo "mini-tenant-id=$TENANT_ID" >> /tmp/cookies.txt

echo ""
echo "=== Authenticated pages ==="
for p in /dashboard /dashboard/inventory /dashboard/inventory/items /dashboard/finance /dashboard/hr /dashboard/settings /dashboard/settings/roles; do
  CODE=$(curl -s -b /tmp/cookies.txt -o /dev/null -w "%{http_code}" "http://localhost:3000$p")
  echo "  $CODE  $p"
done

echo ""
echo "=== Authenticated API ==="
for ep in /api/me /api/inventory/items /api/finance/accounts /api/hr/employees /api/permissions; do
  CODE=$(curl -s -b /tmp/cookies.txt -H "x-tenant-id: $TENANT_ID" -o /dev/null -w "%{http_code}" "http://localhost:3000$ep")
  echo "  $CODE  $ep"
done

echo ""
echo "=== RBAC: chef ==="
curl -s -c /tmp/chef_cookies.txt -o /dev/null -w "Sign in chef → %{http_code}\n" -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"chef@demo.et","password":"demo1234"}'
echo "mini-tenant-id=$TENANT_ID" >> /tmp/chef_cookies.txt
ME_RESP=$(curl -s -b /tmp/chef_cookies.txt -H "x-tenant-id: $TENANT_ID" http://localhost:3000/api/me)
echo "  /api/me: $(echo $ME_RESP | head -c 150)"

echo ""
echo "=== Server alive? ==="
pgrep -af "next dev" | head -2
curl -s -o /dev/null -w "health: %{http_code}\n" http://localhost:3000/api/health
