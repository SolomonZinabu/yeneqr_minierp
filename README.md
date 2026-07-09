# yeneqr_minierp

Monorepo containing two related but independently-deployable products:

## Apps

### `apps/yeneqr` — YeneQR
QR-ordering platform for restaurants. Customer-facing menu, POS, kitchen display,
loyalty, promotions, multi-branch. Next.js 16 + SQLite + PM2 (single-instance).

- **Port:** 3000 (dev) / 3200 (prod)
- **DB:** SQLite at `db/custom.db` (dev) or `/srv/www/yeneqr.techbee.et/YeneQR/yeneqr.db` (prod)
- **Status:** Production-running. See `apps/yeneqr/README.md` for app-specific docs.

### `apps/minierp` — Mini ERP
Restaurant back-office — inventory ledger, suppliers, POs, GL with auto-posting
engine, Ethiopian-compliant payroll. Multi-tenant SaaS. Next.js 16 + Postgres +
Better-Auth.

- **Port:** 3100 (dev)
- **DB:** Postgres (embedded-postgres on port 5433 for dev; Supabase or self-hosted for prod)
- **Status:** Phase 0 (foundation) complete. Phase 1 (SCM Core) pending.

## Architecture

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│         YeneQR                  │         │        Mini ERP                   │
│  (sales channel / POS)          │         │  (back-office / system of record) │
│                                 │         │                                  │
│  - QR ordering                  │         │  - Inventory ledger               │
│  - Payments (StarPay, cash)     │         │  - Suppliers, POs, GRs            │
│  - Kitchen display              │         │  - GL + auto-posting engine       │
│  - Loyalty, promotions          │         │  - HR + Ethiopian payroll         │
│                                 │         │  - P&L, Balance Sheet             │
│  dispatchPOSWebhook() ────────────────►  /api/integrations/yeneqr/webhook    │
│  (order.created, payment.       │         │  (validates X-API-Key, stores     │
│   received, refund.issued,      │         │   IntegrationEvent for async      │
│   order.status_changed)         │         │   processing)                     │
└─────────────────────────────────┘         └──────────────────────────────────┘
```

The two apps integrate via YeneQR's `dispatchPOSWebhook` outbound event bus.
YeneQR can run standalone (without Mini ERP) — the webhook dispatch is
fire-and-forget and silently no-ops if no integrations are configured.

Mini ERP can also run standalone (without YeneQR) — restaurants that use a
different POS can push events via the same webhook contract, or enter sales
manually via the Z-report UI (planned for Phase 4).

## SSO (planned)

Both apps share a cookie domain (e.g. `.techbee.et`) so a logged-in YeneQR
user automatically authenticates against the Mini ERP. YeneQR's
`Restaurant.externalErpTenantId` column links a YeneQR restaurant to its
Mini ERP tenant.

## Development

```bash
# Install all workspace dependencies
npm install

# Run both apps in parallel (use two terminals or a process manager)
npm run dev:yeneqr    # → http://localhost:3000
npm run dev:minierp   # → http://localhost:3100

# Type-check both
npm run typecheck

# Run tests in both
npm run test
```

See `apps/yeneqr/README.md` and `apps/minierp/README.md` for app-specific setup.

## Repo Layout

```
.
├── apps/
│   ├── yeneqr/           # QR-ordering platform
│   └── minierp/          # Mini ERP back-office
├── package.json          # Workspace root
├── README.md             # This file
└── .gitignore
```

## Status (as of this commit)

- **YeneQR**: contains a one-time ERP integration change (4 webhook wire-ins
  + `externalErpTenantId` column on `Restaurant`). This change is dormant —
  the dispatch fires but no integrations are configured, so YeneQR behaves
  exactly as before unless an admin explicitly provisions an ERP link.
  Future work will continue on top of this state.
- **Mini ERP**: Phase 0 foundation only. Auth, multi-tenant schema,
  webhook ingestion, and provisioning endpoints are wired. No business
  modules yet (inventory/finance/HR are placeholders).
