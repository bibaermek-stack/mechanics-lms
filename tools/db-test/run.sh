#!/usr/bin/env bash
# Apply every migration to a throwaway database, then run the SQL tests.
#
#   PGHOST=... PGPORT=... PGUSER=... tools/db-test/run.sh [test-file ...]
#   MIGRATIONS_DIR=other/dir  to run a modified copy (used to check the tests catch broken rules)
#
# Needs a PostgreSQL 15+ you may create databases on; the standard PG* variables
# say where. Everything happens in a database called mlms_test, dropped first.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=mlms_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null

run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" 2>&1 | grep -v "^NOTICE:.*\(does not exist, skipping\|already exists, skipping\)" || true; }
fail=0
ERR=$(mktemp)
trap 'rm -f "$ERR"' EXIT

psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tools/db-test/stub.sql >/dev/null
for f in "${MIGRATIONS_DIR:-supabase/migrations}"/*.sql; do
  if ! psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null 2>"$ERR"; then
    echo "MIGRATION FAILED: $f"; cat "$ERR"; exit 1
  fi
  echo "migrated  $(basename "$f")"
done

tests=("$@")
[ ${#tests[@]} -eq 0 ] && tests=(supabase/tests/*.sql)
for t in "${tests[@]}"; do
  out=$(psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$t" 2>&1) && status=ok || status=FAILED
  n=$(grep -c "NOTICE:  ok - " <<<"$out" || true)
  echo "$status  $(basename "$t")  ($n checks)"
  if [ "$status" = FAILED ]; then fail=1; grep -E "ERROR|FAILED|CONTEXT|DETAIL|HINT" <<<"$out" | head -12; fi
done
exit $fail
