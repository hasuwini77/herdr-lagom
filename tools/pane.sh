#!/bin/sh
# One stand-in agent pane for screenshots: prints a few lines and reports a status (OSC 7501).
# No real agent runs. Usage: pane.sh <orchestrator|rail|tests|review>
set -eu
c() { printf '\033[%sm' "$1"; }          # colour
r=$(c 0); dim=$(c 90); blue=$(c 34); cyan=$(c 36); green=$(c 32); yellow=$(c 33); red=$(c 31); bold=$(c 1)
head() { printf '\033]0;%s\007\033]7501;state=%s:app=agent\007' "$2" "$1"; clear; }
case "${1:-orchestrator}" in
orchestrator)
  head working "Merging b3, waiting on rail"
  cat <<EOF

 ${dim}❯${r} ${bold}Ship the table view: sorting, sticky header, empty state${r}

 ${cyan}●${r} Split into three buckets, one worktree each
   ${dim}└${r} ${green}✓${r} b1 sorting        ${dim}feat/table-sort    merged${r}
   ${dim}└${r} ${yellow}◐${r} b2 sticky header  ${dim}feat/table-head    waiting on an answer${r}
   ${dim}└${r} ${green}✓${r} b3 empty state    ${dim}feat/table-empty   merging${r}

 ${cyan}●${r} Merging bucket b3 into feat/table
   ${dim}└ 14 tests passed, 0 failed${r}
   ${dim}└ no conflicts in src/table/${r}

 ${cyan}●${r} Waiting on b2 before the gate
   ${dim}└ the rail agent asked a question${r}

 ${dim}❯${r}
EOF
  ;;
rail)
  head blocked "Rail label clips"
  cat <<EOF

 ${cyan}●${r} Measured the header at three widths
   ${dim}└ 1440px  fits${r}
   ${dim}└ 1280px  fits${r}
   ${dim}└ 1024px  ${r}${red}label clips by 18px${r}

 ${yellow}●${r} ${bold}The rail label clips at 232px.${r}
   Shorten the text or widen the rail?

   ${blue}1.${r} Shorten to "Items"
   ${blue}2.${r} Widen the rail to 256px
   ${blue}3.${r} Wrap to two lines

 ${dim}❯${r}
EOF
  ;;
tests)
  head working "Tests green"
  cat <<EOF

 ${dim}❯${r} ${bold}Run the suite and fix what breaks${r}

 ${green}●${r} 42 tests passed in 3.1s
   ${dim}└ table/sort.test.ts      12 passed${r}
   ${dim}└ table/header.test.ts    9 passed${r}
   ${dim}└ table/empty.test.ts     7 passed${r}
   ${dim}└ a11y/contrast.test.ts   14 passed${r}

 ${dim}❯${r}
EOF
  # "done" is Herdr's word for finished while nobody was looking: stop working once the tab is hidden.
  sleep 8; printf '\033]7501;state=idle:app=agent\007'
  ;;
review)
  head idle "Review notes"
  cat <<EOF

 ${dim}●${r} Ready when you are.

 ${dim}❯${r}
EOF
  ;;
esac
exec sleep 86400
