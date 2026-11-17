#!/bin/sh
# shot.sh <name> -> shots/<name>.png : the Herdr App window only, via the app's own `shot` (WSL driving the Windows build).
set -eu
here=$(cd "$(dirname "$0")/.." && pwd); mkdir -p "$here/shots"
app=${HERDR_APP:?set HERDR_APP to herdr-app.exe}
"$app" shot 'C:\Users\Public\lagom-shot.png' >/dev/null
mv /mnt/c/Users/Public/lagom-shot.png "$here/shots/$1.png"
