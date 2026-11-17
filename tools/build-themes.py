#!/usr/bin/env python3
"""Writes the Lagom theme files and proves every text colour clears WCAG AA on every surface.
Usage: build-themes.py <themes-dir>"""
import json, sys, os

T = {
 "lagom-neon": dict(light=False,
   background="#05080f", canvas="#05080f", chrome="#080c16", surface="#0c1220", popover="#0c1220", raised="#151d30",
   hover="#1a2440", selected="#1d2a4a", border="#2f3a55", input="#6f7ea3",
   foreground="#e9eefb", muted="#a9b4cc", dim="#8f9bb8", accent="#5fd7ff", accent_foreground="#021018",
   working="#ffb454", blocked="#ff8fa3", done="#7ef0a8", idle="#a9b4cc", unknown="#8f9bb8", selection="#1f3a5c",
   ansi=["#1a2233","#ff7a90","#7ef0a8","#ffd166","#6fb1ff","#d59bff","#5fd7ff","#c9d3ea",
         "#8f9bb8","#ff9aab","#a2f5c1","#ffe08f","#93c5ff","#e2b8ff","#8fe4ff","#f2f6ff"]),
 "lagom-palenight": dict(light=False,
   background="#292d3e", canvas="#1f2233", chrome="#242837", surface="#2a2e40", popover="#2a2e40", raised="#34394f",
   hover="#363b53", selected="#383e58", border="#444a66", input="#7f87b0",
   foreground="#e4e8fb", muted="#b0b6d6", dim="#b0b6d6", accent="#d2a6ef", accent_foreground="#1b1d2b",
   working="#ffcb6b", blocked="#ff8b92", done="#c3e88d", idle="#b0b6d6", unknown="#b0b6d6", selection="#4a5178",
   ansi=["#3a3f58","#ff8b92","#c3e88d","#ffcb6b","#82aaff","#c792ea","#89ddff","#d0d5ee",
         "#a3aad0","#ffa3a9","#d4f0a8","#ffd88a","#9dbcff","#d6adf0","#a6e6ff","#ffffff"]),
 "lagom-graphite": dict(light=False,
   background="#0b0d10", canvas="#0f1216", chrome="#151920", surface="#1b2028", popover="#1b2028", raised="#232a34",
   hover="#28303c", selected="#2c3542", border="#343d4a", input="#6b7789",
   foreground="#e8ebf0", muted="#aab3c0", dim="#a3adbb", accent="#7cc4ff", accent_foreground="#06121d",
   working="#ffb454", blocked="#ff9a9a", done="#7ee0a0", idle="#aab3c0", unknown="#a3adbb", selection="#27405c",
   ansi=["#232a34","#ff9a9a","#7ee0a0","#ffd166","#7cc4ff","#d2a8ff","#6fdcea","#cdd3dc",
         "#98a2b1","#ffb0b0","#a0ecba","#ffe08f","#a3d5ff","#e0c2ff","#98e8f2","#f4f6f9"]),
 "lagom-moss": dict(light=False,
   background="#0a0f0c", canvas="#0e1411", chrome="#121a16", surface="#18221d", popover="#18221d", raised="#213028",
   hover="#24352d", selected="#283a31", border="#33443a", input="#6c8474",
   foreground="#e6efe8", muted="#a6b8ab", dim="#a0b4a5", accent="#9be28a", accent_foreground="#08140a",
   working="#f0c060", blocked="#ff9a8c", done="#8fe3a6", idle="#a6b8ab", unknown="#a0b4a5", selection="#2a4a38",
   ansi=["#213028","#ff9a8c","#8fe3a6","#f0c060","#8cc4e8","#d7a8e0","#7fd9c8","#cfdcd2",
         "#93a898","#ffb3a8","#abedbd","#f5d184","#a9d4ef","#e2bfe9","#9fe5d8","#f4faf5"]),
 "lagom-paper": dict(light=True,
   background="#ffffff", canvas="#f3f4f7", chrome="#e9ebf0", surface="#ffffff", popover="#ffffff", raised="#eef0f4",
   hover="#e2e5eb", selected="#d9dde6", border="#c9ced8", input="#6a7484",
   foreground="#161a20", muted="#4a5462", dim="#545e6d", accent="#0a5aa8", accent_foreground="#ffffff",
   working="#7d5200", blocked="#b0241c", done="#17683a", idle="#4a5462", unknown="#545e6d", selection="#cfe2f7",
   ansi=["#161a20","#b0241c","#17683a","#7d5200","#0a5aa8","#7a2e9e","#0b6b78","#545e6d",
         "#4a5462","#9c1f18","#145c33","#6e4800","#094f94","#6b288b","#095e69","#161a20"]),
 "lagom-contrast": dict(light=False,
   background="#000000", canvas="#000000", chrome="#000000", surface="#000000", popover="#000000", raised="#1a1a1a",
   hover="#262626", selected="#333333", border="#ffffff", input="#ffffff",
   foreground="#ffffff", muted="#e6e6e6", dim="#d9d9d9", accent="#ffe14a", accent_foreground="#000000",
   working="#ffe14a", blocked="#ff9d94", done="#8dffb0", idle="#e6e6e6", unknown="#d9d9d9", selection="#4d4d00",
   ansi=["#333333","#ff9d94","#8dffb0","#ffe14a","#9cc7ff","#e6b3ff","#8ff0ff","#ffffff",
         "#d9d9d9","#ffb8b1","#b0ffc8","#ffeb85","#b9d8ff","#efccff","#b3f5ff","#ffffff"]),
}
SURF = ["background","canvas","chrome","surface","popover","raised","hover","selected"]
TEXT = ["foreground","muted","dim","accent","working","blocked","done","idle","unknown"]

def lum(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    c=[v/12.92 if v<=.03928 else ((v+.055)/1.055)**2.4 for v in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def ratio(a,b):
    x,y=lum(a),lum(b); return (max(x,y)+.05)/(min(x,y)+.05)

out=sys.argv[1]; os.makedirs(out,exist_ok=True); bad=0
for name,t in T.items():
    colors={k:v for k,v in t.items() if k not in("light","ansi","selection")}
    colors["solid"]=t["accent"]; colors["solid_foreground"]=t["accent_foreground"]
    doc={"background":t["background"],"foreground":t["foreground"],"selection":t["selection"],
         "cursor":t["accent"],"ansi":t["ansi"],"colors":colors}
    json.dump(doc,open(os.path.join(out,name+".json"),"w"),indent=2)
    worst=min((ratio(t[x],t[s]),x,s) for x in TEXT for s in SURF)
    # ANSI colours 1-15 as text on the terminal background (0 is a background shade)
    aw=min((ratio(c,t["background"]),i) for i,c in enumerate(t["ansi"]) if i!=0)
    btn=ratio(t["accent_foreground"],t["accent"]); ctl=ratio(t["input"],t["canvas"])
    ok = worst[0]>=4.5 and aw[0]>=4.5 and btn>=4.5 and ctl>=3
    bad+=not ok
    print(f"{'ok  ' if ok else 'FAIL'} {name:16} ui text {worst[0]:.2f} ({worst[1]} on {worst[2]}) · ansi {aw[0]:.2f} (#{aw[1]}) · button {btn:.2f} · control edge {ctl:.2f}")
sys.exit(1 if bad else 0)
