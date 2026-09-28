#!/bin/sh
# Freeze a released version of a game as a playable copy at versions/<game>/<version>/.
#
#   tools/freeze-version.sh <game-folder> <version> [git-ref]
#   tools/freeze-version.sh blow-up 1.3 blow-up-v1.3
#
# The copy is taken from git (the tag or commit, default HEAD), not the working tree, so it is
# exactly what shipped. It is never edited afterwards. The script:
#   - drops developer-only files (tests, tools, balance runs, planning notes);
#   - points "../" links (shelf, feedback, other games) three levels up;
#   - gives the copy its own saved-game space, so old versions and the current game never read
#     or overwrite each other's progress (localStorage keys get a "<game>@<version>:" prefix);
#   - hides it from search engines and adds a thin "old version" strip linking to the current game.
# Afterwards, add a row to versions/index.html.
set -eu

game=${1:?game folder, e.g. blow-up}
ver=${2:?version, e.g. 1.3}
ref=${3:-HEAD}
root=$(git rev-parse --show-toplevel)
dest="$root/versions/$game/$ver"

[ -e "$dest" ] && { echo "already frozen: versions/$game/$ver (frozen copies are never overwritten)" >&2; exit 1; }
git -C "$root" cat-file -e "$ref:$game/index.html" 2>/dev/null || { echo "no $game/index.html at $ref" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$root" archive "$ref" "$game" | tar -x -C "$tmp"
cd "$tmp/$game"
rm -rf tools ./*.test.js balance.js PLAN.md PLAYTEST.md CLAUDE.md DECISIONS.md KNOWN-BUGS.md tests

inject_head="<meta name=\"robots\" content=\"noindex\">
<script>/* Frozen copy: keep this version's saved games separate. */
(function(){try{var P='$game@$ver:',S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;
S.getItem=function(k){return g.call(this,P+k)};S.setItem=function(k,v){return s.call(this,P+k,v)};
S.removeItem=function(k){return r.call(this,P+k)}}catch(e){}})();</script>"
inject_body="<div style=\"font:13px/1.4 system-ui,sans-serif;background:#2b2140;color:#f3eefc;padding:6px 12px;text-align:center\">Old version $ver, kept so we can compare. Saved games here are separate. <a style=\"color:#d9c8ff\" href=\"../../../$game/\">Play the current version</a> · <a style=\"color:#d9c8ff\" href=\"../\">All versions</a></div>"

for f in *.html; do
  HEAD_INJ="$inject_head" BODY_INJ="$inject_body" perl -0pi -e '
    s{((?:href|src)=")\.\./}{$1../../../}g;
    s{(<meta charset="[^"]*">)}{$1\n$ENV{HEAD_INJ}};
    s{(<body[^>]*>)}{$1\n$ENV{BODY_INJ}} if $ARGV eq "index.html";
  ' "$f"
done
grep -q "$game@$ver:" index.html || { echo "could not inject into index.html (no <meta charset>?)" >&2; exit 1; }

mkdir -p "$(dirname "$dest")"
cp -R "$tmp/$game" "$dest"
echo "frozen: versions/$game/$ver  (from $ref)"
echo "next: add it to versions/index.html"
