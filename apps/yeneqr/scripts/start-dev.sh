#!/usr/bin/env bash
# ============================================================
# Yene QR — Sandbox / Development Server Start Script
# Started by PM2 (ecosystem: yeneqr-dev process)
# ============================================================
set -e
# cd to the repo root (parent of the scripts/ directory this file lives in)
cd "$(dirname "$0")/.."

# Use Next.js dev server in the sandbox for fast HMR + on-the-fly TS
exec npx next dev -p 3000 -H 0.0.0.0
