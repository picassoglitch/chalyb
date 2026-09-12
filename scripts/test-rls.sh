#!/usr/bin/env bash
#
# Run the privilege-guard regression test (supabase/tests/privilege_guard_test.sql)
# against a throwaway Postgres.
#
# WHY A SHELL SCRIPT AND NOT VITEST
# What is under test is Postgres behaviour — row-level security, column
# grants, a SECURITY DEFINER function's privileges. None of it is reachable
# from Node without a real database, and mocking it would test the mock.
#
# TWO MODES
#   ./scripts/test-rls.sh
#       Boots a scratch cluster in a temp directory with pg_ctl, runs the
#       fixture + migrations + test, and tears the cluster down. Needs a
#       local PostgreSQL install (any version 14+).
#
#   DATABASE_URL=postgres://… ./scripts/test-rls.sh
#       Runs against a database you point it at — e.g. `supabase db start`,
#       or a Supabase branch. It CREATES TWO TEST USERS and rolls its own
#       transaction back, but the fixture itself writes: never point this at
#       production.
#
# Exit code is the verdict: 0 means every check passed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$REPO_ROOT/supabase/migrations"
TESTS="$REPO_ROOT/supabase/tests"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install the PostgreSQL client, or run this against a" >&2
  echo "database with DATABASE_URL=postgres://… ./scripts/test-rls.sh" >&2
  exit 1
fi

run_sql() {
  psql "$@" -v ON_ERROR_STOP=1 --quiet
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "▸ Running against DATABASE_URL"
  PSQL_TARGET=("$DATABASE_URL")
else
  command -v pg_ctl >/dev/null 2>&1 || {
    PATH="$PATH:$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"
    export PATH
  }
  command -v pg_ctl >/dev/null 2>&1 || {
    echo "pg_ctl not found and DATABASE_URL is unset — nothing to run against." >&2
    exit 1
  }

  if [[ "$(id -u)" -eq 0 ]]; then
    echo "initdb refuses to run as root. Either run this as a normal user, or" >&2
    echo "point it at a database:  DATABASE_URL=postgres://… $0" >&2
    exit 1
  fi

  CLUSTER_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chalyb-rls-XXXXXX")"
  PGPORT_LOCAL="${PGPORT:-55432}"
  cleanup() {
    pg_ctl -D "$CLUSTER_DIR/data" stop -m immediate >/dev/null 2>&1 || true
    rm -rf "$CLUSTER_DIR"
  }
  trap cleanup EXIT

  echo "▸ Booting a scratch cluster in $CLUSTER_DIR"
  initdb -D "$CLUSTER_DIR/data" -A trust -U postgres >/dev/null
  pg_ctl -D "$CLUSTER_DIR/data" -l "$CLUSTER_DIR/pg.log" \
    -o "-p $PGPORT_LOCAL -k $CLUSTER_DIR" start >/dev/null

  createdb -h "$CLUSTER_DIR" -p "$PGPORT_LOCAL" -U postgres chalyb_rls_test
  PSQL_TARGET=(-h "$CLUSTER_DIR" -p "$PGPORT_LOCAL" -U postgres -d chalyb_rls_test)
fi

echo "▸ Loading the fixture"
run_sql "${PSQL_TARGET[@]}" -f "$TESTS/fixtures/profiles_fixture.sql" >/dev/null

echo "▸ Applying migrations under test"
for migration in \
  0032_profiles_privilege_guard \
  0033_grant_token_pack_rpc \
  0034_subscription_cancel_at_period_end
do
  run_sql "${PSQL_TARGET[@]}" -f "$MIGRATIONS/$migration.sql" >/dev/null
  echo "    $migration"
done

# Re-apply 0032 last: it has to stay idempotent, and re-running it after a
# later migration added columns must NOT hand those columns back to the
# client. That ordering is a live foot-gun, so the test exercises it.
echo "▸ Re-applying 0032 (idempotency + ordering)"
run_sql "${PSQL_TARGET[@]}" -f "$MIGRATIONS/0032_profiles_privilege_guard.sql" >/dev/null

echo "▸ Running the checks"
psql "${PSQL_TARGET[@]}" -v ON_ERROR_STOP=1 -f "$TESTS/privilege_guard_test.sql"
