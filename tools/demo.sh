#!/bin/sh
# Fills the Herdr window with stand-in agents so a screenshot shows every status.
# They are plain shells that print a few lines and report a status; no real agent runs.
# Usage: tools/demo.sh            (Herdr App on this machine)
#        tools/demo.sh windows    (from WSL, driving the Windows build; panes run in WSL)
# Close the "lagom-demo" space when done.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
if [ "${1:-}" = windows ]; then
  app=${HERDR_APP:?set HERDR_APP to herdr-app.exe}
  folder='C:\Users\Public'
  argv() { python3 -c 'import json,sys; print(json.dumps(["wsl.exe","--exec","sh",sys.argv[1],sys.argv[2]]))' "$here/pane.sh" "$1"; }
else
  app=${HERDR_APP:-herdr-app}
  folder=${1:-$HOME}
  argv() { python3 -c 'import json,sys; print(json.dumps(["sh",sys.argv[1],sys.argv[2]]))' "$here/pane.sh" "$1"; }
fi
step() { "$app" do "$@" >/dev/null; sleep 2; }   # a terminal needs a moment before the next one starts
step space.new --name lagom-demo --folder "$folder" --tab build --argv "$(argv orchestrator)"
step pane.split --direction right --argv "$(argv rail)"
step tab.new --name tests --argv "$(argv tests)"
step tab.new --name review --argv "$(argv review)"
step tab.select --index 1
echo "demo space ready"
