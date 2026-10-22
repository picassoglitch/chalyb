#!/usr/bin/env bash
# The whole e2e suite with no secrets: a local build, the fake Supabase and every tool in mock mode.
# Used by CI (.github/workflows/ci.yml); run it locally the same way: `bash scripts/e2e-mock.sh [playwright args]`.
set -euo pipefail

PORT="${PORT:-3123}"
MOCK_PORT="${MOCK_SUPABASE_PORT:-59999}"
LOGS="${E2E_LOGS:-${RUNNER_TEMP:-/tmp}/e2e-mock-logs}"  # outside test-results/, which Playwright wipes
mkdir -p "$LOGS"

export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$MOCK_PORT"
export NEXT_PUBLIC_SUPABASE_ANON_KEY=local SUPABASE_SERVICE_ROLE_KEY=local
export E2E_USE_MOCK_ADAPTERS=1
# Without a key every risk notice fails to save ("No pudimos guardar tu respuesta").
export CONSENT_ENCRYPTION_KEY="${CONSENT_ENCRYPTION_KEY:-$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')}"
for tool in chalybclip chalybcrypto chalybobs chalybbot chalybpicks chalybrealtor chalybtrade; do  # = TOOL_SLUGS (tests/ci-e2e-mock.test.ts)
  export "TOOL_HUB_MODE_${tool^^}=mock"
done

for port in "$PORT" "$MOCK_PORT"; do
  # A leftover server on these ports would answer for the new build and hide failures.
  ss -ltnH "sport = :$port" | grep -q . && { echo "port $port is busy; stop that server first"; exit 1; }
done

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; done
  # next-server can outlive its group; a listener on our ports started from this checkout goes too.
  for port in "$PORT" "$MOCK_PORT"; do
    for pid in $(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do
      [[ "$(readlink "/proc/$pid/cwd")" == "$PWD" ]] && kill "$pid" 2>/dev/null || true
    done
  done
}
trap cleanup EXIT

MOCK_SUPABASE_PORT="$MOCK_PORT" setsid node e2e/mock-supabase/server.mjs >"$LOGS/mock-supabase.log" 2>&1 &
mock_pid=$!
pids+=("$mock_pid")

if [[ "${SKIP_BUILD:-}" != 1 ]]; then pnpm build >"$LOGS/build.log" 2>&1 || { tail -40 "$LOGS/build.log"; exit 1; }; fi
PORT="$PORT" setsid pnpm start >"$LOGS/server.log" 2>&1 &
server_pid=$!
pids+=("$server_pid")

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && curl -s -o /dev/null "http://127.0.0.1:$MOCK_PORT/" && break
  sleep 1
done
curl -sf -o /dev/null "http://127.0.0.1:$PORT/" || { echo "server did not start"; tail -40 "$LOGS/server.log"; exit 1; }
curl -s -o /dev/null "http://127.0.0.1:$MOCK_PORT/" || { echo "mock supabase did not start"; tail -40 "$LOGS/mock-supabase.log"; exit 1; }

export E2E_BASE_URL="http://localhost:$PORT"
export E2E_CLIPS_MODE=mock E2E_TOOLS_MODE=mock E2E_MOCK_BACKEND=1
# Every account the mock serves; a role left out here would have its specs skipped, not failed.
# Not covered here: E2E_TRIAL_FLOW (paid checkout), screenshot runs and the smoke project.
for role in free trial pro pro_annual past_due cancelled vip admin; do
  export "E2E_${role^^}_EMAIL=$role@example.com" "E2E_${role^^}_PASSWORD=mock-pass-123"
done

setsid pnpm exec playwright test "$@" &
pw_pid=$!
pids+=("$pw_pid")  # its own group, so cleanup also stops the browsers
# If the mock or the app dies mid-run every later test fails slowly; stop at once and say which.
wait -n -p done_pid "$pw_pid" "$mock_pid" "$server_pid" && status=0 || status=$?
if [[ "${done_pid:-}" != "$pw_pid" ]]; then
  echo "$([[ "${done_pid:-}" == "$mock_pid" ]] && echo 'mock supabase' || echo 'app server') exited during the run"
  exit 1
fi
exit "$status"
