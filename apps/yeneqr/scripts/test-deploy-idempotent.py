#!/usr/bin/env python3
"""Simulate the deploy.sh Step 7 idempotent logic using Python's sqlite3 module."""
import sqlite3
import os
import subprocess

DB_PATH = "/tmp/test-deploy.db"
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

# Create a test DB with BranchSettings table (but no orderRouting column)
conn = sqlite3.connect(DB_PATH)
conn.execute('CREATE TABLE "BranchSettings" (id TEXT PRIMARY KEY, branchId TEXT)')
conn.commit()
conn.close()

print("=== Initial schema ===")
conn = sqlite3.connect(DB_PATH)
for row in conn.execute("PRAGMA table_info(BranchSettings)"):
    print(f"  {row}")
conn.close()
print()

# Simulate the bash logic using sqlite3 CLI semantics
# We'll use subprocess to call sqlite3 CLI if available, else use Python directly
def get_pragma_info(db_path, table):
    """Equivalent of: sqlite3 $DB_PATH 'PRAGMA table_info(BranchSettings);'"""
    conn = sqlite3.connect(db_path)
    rows = list(conn.execute(f"PRAGMA table_info({table})"))
    conn.close()
    return rows

def grep_count(rows, pattern):
    """Equivalent of: grep -c pattern"""
    count = 0
    for row in rows:
        # row format: (cid, name, type, notnull, dflt_value, pk)
        row_str = "|".join(str(c) for c in row)
        if pattern in row_str:
            count += 1
    return count

def alter_table_add_column(db_path, table, column, col_type):
    """Equivalent of: sqlite3 $DB_PATH 'ALTER TABLE ... ADD COLUMN ...'"""
    conn = sqlite3.connect(db_path)
    conn.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}')
    conn.commit()
    conn.close()

print("=== First run (should add column) ===")
rows = get_pragma_info(DB_PATH, "BranchSettings")
order_routing_exists = grep_count(rows, "orderRouting")
print(f"  orderRouting exists count: {order_routing_exists}")
if order_routing_exists == 0:
    print("  → Adding BranchSettings.orderRouting column...")
    alter_table_add_column(DB_PATH, "BranchSettings", "orderRouting", "TEXT")
    print("  ✅ orderRouting column added")
else:
    print("  ✓ BranchSettings.orderRouting already exists — skipping")
print()

print("=== Second run (should skip) ===")
rows = get_pragma_info(DB_PATH, "BranchSettings")
order_routing_exists = grep_count(rows, "orderRouting")
print(f"  orderRouting exists count: {order_routing_exists}")
if order_routing_exists == 0:
    print("  → Adding BranchSettings.orderRouting column...")
    alter_table_add_column(DB_PATH, "BranchSettings", "orderRouting", "TEXT")
    print("  ✅ orderRouting column added")
else:
    print("  ✓ BranchSettings.orderRouting already exists — skipping")
print()

print("=== Final schema ===")
conn = sqlite3.connect(DB_PATH)
for row in conn.execute("PRAGMA table_info(BranchSettings)"):
    print(f"  {row}")
conn.close()

# Clean up
os.remove(DB_PATH)
print("\n✅ Test passed — idempotent logic works correctly")
