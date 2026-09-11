#!/bin/sh
# Role dispatch — copy this into a new engine repo.
#
# One image, two roles, so there is one thing to build and one thing to push:
#
#   api     the HTTP service. Default, so nothing else needs configuring.
#   worker  background work, if this engine has any. The Terraform module
#           sets ROLE=worker on the worker service.
#
# Both roles MUST bind $PORT. Cloud Run assigns it and health-checks it; a
# container that listens on a hardcoded port fails to start with a message
# that does not mention the port.
set -eu

PORT="${PORT:-8080}"

case "${ROLE:-api}" in
  worker)
    # Replace with this engine's worker command.
    exec ./your-worker --host 0.0.0.0 --port "$PORT"
    ;;
  api)
    # Replace with this engine's server command.
    exec ./your-server --host 0.0.0.0 --port "$PORT"
    ;;
  *)
    echo "docker-entrypoint: unknown ROLE='${ROLE}' (expected 'api' or 'worker')" >&2
    exit 64
    ;;
esac
