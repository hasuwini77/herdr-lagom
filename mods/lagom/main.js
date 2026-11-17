// Lagom: one mod, two roles.
//   props.role "bar"  — the strip under the terminals: the pilot agent on the left,
//                       labelled actions on the right. It also keeps the wallpaper
//                       dimming in step with the theme (see sync()).
//   props.role "look" — the Look dialog: themes, wallpaper, how readable to keep the text.
// State both roles share lives in shared("lagom.look") and shared("lagom.still").

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import * as fs from "fs/promises";
import {
  agents, spaces, theme, themes, settings, shared, setShared, run, openOverlay, closeOverlay,
  props, exec, appHome, readTextFile, writeTextFile, layout, focused, nextCommand,
} from "herdr";
import { dimming, alphaHex } from "./wcag.js";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MARK = { working: "◐", blocked: "×", done: "✓", idle: "○" };
const WORD = { working: "working", blocked: "needs you", done: "done", idle: "idle" };
const PICTURE = /\.(png|jpe?g|webp)$/i;
const FALLBACK_DIM = 0.75; // used only when the picture could not be measured
// The pictures Lagom ships, measured ahead (darkest and brightest 1%): no Python needed for these.
const KNOWN = {
  "nebula.png": { p01: [5, 1, 7], p99: [54, 67, 102] },
  "starfield.png": { p01: [7, 9, 28], p99: [37, 32, 93] },
};

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}

// The theme as its file defines it. theme() can't be used here: once a wallpaper is on,
// it reports the translucent overrides this mod wrote.
// Which theme: the Look dialog's pick, else what the layout shows. A layout theme can be
// { light, dark } (app.theme fills only the half of the picked theme's lightness, so a dark
// pick is invisible in a light appearance); Lagom writes one name instead, shown in both.
const shown = (th) => (th && typeof th === "object" ? th[settings().dark ? "dark" : "light"] : th) ?? settings().theme;
function baseTheme() {
  const name = look().theme ?? shown(layout().theme);
  return { name, colors: themes().find((t) => t.name === name)?.colors ?? theme() };
}

// The app keeps numbers as 32-bit floats, so 0.163 comes back as 0.16300000250339508.
const near = (a, b) => a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-4);
const look = () => shared("lagom.look") ?? {};
const setTheme = (name) => setShared("lagom.look", { ...look(), theme: name });
const openLook = () => openOverlay({ mod: "lagom", props: { role: "look" }, kind: "dialog", width: 540 });
const pretty = (name) => name.replace(/^lagom-/, "").replace(/\.[a-z]+$/i, "").replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());

// What the wallpaper needs under the current theme, or null without one.
function wanted() {
  const l = look();
  if (!l.image) return null;
  const { colors } = baseTheme();
  const d = l.measure ? dimming(colors, l.measure, l.target ?? 4.5) : { a: FALLBACK_DIM, got: null, bare: null, reached: true };
  return { image: l.image, colors, ...d };
}

export default class Lagom extends View {
  init(_props, cx) {
    this.role = props()?.role ?? "bar";
    this.busyUntil = 0; // a time, not a flag: a write that never returns cannot block the next one
    this.pictures = [];
    this.note = null;
    this.listPictures(cx);
    if (this.role !== "bar") return;
    cx.timer.every(30000, (cx) => cx.notify()); // the elapsed minutes
    // Keys: bind "lagom.look", "lagom.next-blocked", "lagom.wallpaper-next" or "lagom.theme-next" in keys.json.
    cx.spawn(async (cx) => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
  }

  // ---- wallpaper: keep the layout file in step with theme + picture ----------------

  // Writes the look into the shown layout when it differs from what is there. The file is
  // the single source of truth, so this is safe to call on every render.
  sync(cx) {
    const root = layout();
    if (Date.now() < this.busyUntil || !find(root, "lagom-bar")) return; // only ever touch a Lagom layout
    // A pick from Herdr's own theme menu arrives as halves: adopt the one on screen.
    const rt = root.theme, pick = look().theme;
    if (rt && typeof rt === "object" && shown(rt) && shown(rt) !== pick && this.adopted !== JSON.stringify(rt)) {
      this.adopted = JSON.stringify(rt);
      setTheme(shown(rt));
      return;
    }
    const w = wanted();
    const hex = w ? alphaHex(w.a) : null;
    const want = w
      ? { image: w.image, chrome: w.colors.chrome + hex, background: w.colors.background + hex, body: w.colors.canvas + hex,
          opacity: Math.round((1 - Math.sqrt(1 - w.a)) * 1000) / 1000, pane: "#00000000" }
      : { image: null, chrome: undefined, background: undefined, body: undefined, opacity: undefined, pane: "background" };
    const main = find(root, "main"), body = find(root, "work-body");
    const same = (!pick || rt === pick) && (root.background?.image ?? null) === want.image && root.colors?.chrome === want.chrome
      && root.colors?.background === want.background && near(root.terminal_opacity, want.opacity)
      && body?.background === want.body && main?.content?.pane?.background === want.pane;
    if (same) return;
    this.busyUntil = Date.now() + 5000;
    cx.spawn(async (cx) => {
      try {
        const path = `${appHome()}/layouts/${shared("layout")}.json`;
        const text = await readTextFile(path);
        const doc = JSON.parse(text);
        const set = (obj, key, value) => { if (value === undefined) delete obj[key]; else obj[key] = value; };
        if (pick) doc.theme = pick;
        doc.background = want.image ? { image: want.image, fit: "cover" } : "canvas";
        doc.colors = doc.colors ?? {};
        set(doc.colors, "chrome", want.chrome);
        set(doc.colors, "background", want.background);
        if (!Object.keys(doc.colors).length) delete doc.colors;
        set(doc, "terminal_opacity", want.opacity);
        set(find(doc, "work-body"), "background", want.body);
        find(doc, "main").content.pane.background = want.pane;
        await writeTextFile(path, JSON.stringify(doc, null, 2) + "\n", text);
      } catch (e) {
        console.log("lagom: could not write the layout:", String(e));
      }
      // The layout reloads within a second; hold off so one change is one write.
      this.busyUntil = Date.now() + 1500;
      cx.timer.after(1500, (cx) => cx.notify());
    });
  }

  command(name, cx) {
    if (name === "look") return openLook();
    if (name === "next-blocked") {
      const first = agents().filter((x) => x.status === "blocked").sort((x, y) => x.seq - y.seq)[0];
      if (first) run("agent.focus", { terminal: first.address });
    }
    if (name === "wallpaper-next") {
      const order = [null, ...this.pictures], now = look().image?.replace(/^backgrounds\//, "") ?? null;
      this.pick(order[(order.indexOf(now) + 1) % order.length], cx);
    }
    if (name === "theme-next") {
      const ours = themes().filter((x) => x.name.startsWith("lagom-")).map((x) => x.name);
      if (ours.length) setTheme(ours[(ours.indexOf(baseTheme().name) + 1) % ours.length]);
    }
  }

  // ---- the Look dialog's work ------------------------------------------------------

  listPictures(cx) {
    cx.spawn(async (cx) => {
      const names = await fs.readdir(`${appHome()}/backgrounds`).catch(() => []);
      this.pictures = names.filter((n) => PICTURE.test(n) && !n.startsWith("_") && !n.includes(".preview.")).sort();
      cx.notify();
    });
  }

  pick(name, cx) {
    if (!name) { setShared("lagom.look", { ...look(), image: null, measure: null }); return; }
    this.note = "Measuring the picture…";
    cx.notify();
    cx.spawn(async (cx) => {
      let measure = KNOWN[name] ?? null;
      for (const python of measure ? [] : ["python3", "python"]) { // Windows has no python3
        try {
          const r = await exec(python, [`${appHome()}/mods/lagom/measure.py`, `${appHome()}/backgrounds/${name}`], { timeout: 60000 });
          const out = JSON.parse(r.stdout);
          if (out.p99) { measure = { p01: out.p01, p99: out.p99 }; break; }
        } catch (_e) { /* next one, then the fixed dimming */ }
      }
      this.note = measure ? null : "Could not measure this picture (needs Python, and Pillow or ImageMagick unless it is an 8-bit PNG). Using a fixed 75% dimming.";
      setShared("lagom.look", { ...look(), image: `backgrounds/${name}`, measure });
      cx.notify();
    });
  }

  // ---- drawing ---------------------------------------------------------------------

  chip(t, id, label, on, action, swatch) {
    return h_flex().id(id).h(30).px(12).gap(7).flex_none().items_center().rounded(6).border(1).text_size(12.5)
      .border_color(on ? t.accent : t.input).bg(on ? t.accent : t.popover).text_color(on ? t.accent_foreground : t.foreground)
      .when(on, (el) => el.font_semibold())
      .hover((s) => s.border_color(t.accent))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(action)
      .when(Boolean(swatch), (el) => el.child(div().size(10).flex_none().rounded(5).border(1).border_color(on ? t.accent_foreground : t.input).bg(swatch)))
      .child(label);
  }

  group(t, title, chips) {
    return v_flex().gap(6).child(div().text_size(12).text_color(t.muted).child(title)).child(h_flex().flex_wrap().gap(6).children(chips));
  }

  renderLook(cx) {
    const t = theme();
    const { name } = baseTheme();
    const l = look(), w = wanted(), target = l.target ?? 4.5, still = Boolean(shared("lagom.still"));
    const list = themes().filter((x) => x.name !== "win98");
    // High contrast goes last: it is there for whoever needs it, not as a first suggestion.
    const ours = list.filter((x) => x.name.startsWith("lagom-")).sort((x, y) => (x.name === "lagom-contrast") - (y.name === "lagom-contrast")), rest = list.filter((x) => !x.name.startsWith("lagom-"));
    const themeChip = (x) => this.chip(t, `th-${x.name}`, pretty(x.name), x.name === name, () => setTheme(x.name), x.colors.accent);
    const current = l.image?.replace(/^backgrounds\//, "") ?? null;
    const readout = !w ? ["No wallpaper.", "The theme's colours apply as designed."]
      : w.got === null ? [`Dimming ${Math.round(w.a * 100)}%, not measured.`, this.note ?? ""]
      : !w.reached ? ["Target out of reach.", `This theme's own weakest text is ${w.got.toFixed(1)}:1 on a plain background. The picture is fully covered: pick AA, or a theme with stronger text.`]
      : [`Dimming ${Math.round(w.a * 100)}%  ·  weakest text ${w.got.toFixed(1)}:1  ·  target ${target}:1`, `Without dimming this picture would give ${w.bare.toFixed(1)}:1.`];
    return v_flex().id("lagom-look").w_full().p(18).gap(16).bg(t.popover).text_color(t.foreground).text_size(13)
      .child(h_flex().items_center().justify_between()
        .child(div().text_size(15).font_semibold().child("Look"))
        .child(this.chip(t, "look-close", "Close", false, () => closeOverlay(props().overlay))))
      .child(this.group(t, "Lagom themes", ours.map(themeChip)))
      .when(rest.length > 0, (el) => el.child(this.group(t, "Other installed themes", rest.map(themeChip))))
      .child(this.group(t, "Wallpaper", [
        this.chip(t, "wp-none", "None", !current, (_e, cx) => this.pick(null, cx)),
        ...this.pictures.map((n) => this.chip(t, `wp-${n}`, pretty(n), n === current, (_e, cx) => this.pick(n, cx))),
      ]))
      .child(div().text_size(12).text_color(t.muted).child("Pictures come from ~/.config/herdr-app/backgrounds. Add a file there and reopen this."))
      .child(this.group(t, "Keep text readable", [
        this.chip(t, "aa", "AA · 4.5:1", target === 4.5, () => setShared("lagom.look", { ...look(), target: 4.5 })),
        this.chip(t, "aaa", "AAA · 7:1", target === 7, () => setShared("lagom.look", { ...look(), target: 7 })),
      ]))
      .child(v_flex().p(10).gap(3).rounded(6).border(1).border_color(t.border)
        .child(div().font_semibold().child(this.note && w?.got !== null ? this.note : readout[0]))
        .when(Boolean(readout[1]), (el) => el.child(div().text_size(12).text_color(t.muted).child(readout[1]))))
      .child(this.group(t, "Motion", [
        this.chip(t, "still", still ? "Reduced: spinners stand still" : "Reduce motion", still, () => setShared("lagom.still", !still)),
      ]))
      .child(h_flex().child(this.chip(t, "open-contrast", "Check this theme's contrast", false, () => { closeOverlay(props().overlay); run("mod.open", { name: "contrast" }); })));
  }

  // The pilot: the first pinned agent (Herdr's own pin), else the working agent that changed
  // last, else whoever changed last.
  pilot(list) {
    const recent = [...list].sort((a, b) => b.seq - a.seq);
    return list.find((a) => a.pinned) ?? recent.find((a) => a.status === "working") ?? recent[0] ?? null;
  }

  action(t, id, label, onClick, tone) {
    return h_flex().id(id).h(26).px(10).flex_none().items_center().rounded(6).border(1).text_size(12)
      .border_color(tone ?? t.input).text_color(tone ?? t.foreground)
      .when(Boolean(tone), (el) => el.font_semibold())
      .hover((s) => s.bg(t.hover))
      .on_click(onClick)
      .child(label);
  }

  renderBar(cx) {
    this.sync(cx);
    const t = theme();
    const list = agents(), a = this.pilot(list), still = Boolean(shared("lagom.still"));
    const waiting = list.filter((x) => x.status === "blocked").sort((x, y) => x.seq - y.seq); // longest wait first
    const since = a && spaces().flatMap((s) => s.tabs).find((tab) => tab.id === a.tab)?.working_since;
    const mins = since ? Math.max(0, Math.floor((Date.now() - since) / 60000)) : null;
    const hasPane = Boolean(focused()?.pane);
    const hasSpace = spaces().length > 0;
    return h_flex().id("lagom-bar-root").size_full().px(10).gap(10).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(12)
      .child(div().flex_none().px(7).h(18).flex().items_center().rounded(4).bg(t.accent).text_color(t.accent_foreground).text_size(10.5).font_bold().child("PILOT"))
      // Without a space the tab bar's + can only fail ("tab.new failed: no space yet"), so offer the way in here.
      .when(!a && !hasSpace, (el) => el
        .child(div().flex_none().text_color(t.muted).child("No space open."))
        .child(this.action(t, "new-space", "+ New space", () => run("space.new"), t.accent))
        .child(div().flex_1()))
      .when(!a && hasSpace, (el) => el.child(div().flex_1().text_color(t.muted).child("No agents yet. Start one from the + in the tab bar.")))
      .when(Boolean(a), (el) => el.child(
        h_flex().id("pilot").flex_1().min_w(0).gap(8).items_center().rounded(6).hover((s) => s.bg(t.hover))
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .child(div().w(14).flex_none().text_size(13).text_color(t[a.status] ?? t.muted)
            .when(a.status === "working" && !still, (d) => d.frames(SPIN, 90)).child(MARK[a.status] ?? "·"))
          .child(div().flex_none().max_w(240).truncate().font_medium().text_color(t.foreground).child(`${a.space_name} › ${a.tab_name}`))
          .child(div().flex_none().text_color(t[a.status] ?? t.muted).child(mins !== null && a.status === "working" ? `working ${mins}m` : WORD[a.status] ?? a.status))
          .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(a.title ?? ""))))
      .when(waiting.length > 0, (el) => el.child(this.action(t, "next-blocked", `× Next blocked · ${waiting.length}`, () => run("agent.focus", { terminal: waiting[0].address }), t.blocked)))
      .when(hasPane, (el) => el
        .child(this.action(t, "split", "Split", () => run("pane.split", { direction: "right" })))
        .child(this.action(t, "zoom", "Zoom", () => run("pane.zoom"))))
      .child(this.action(t, "look", "Look", () => openLook()));
  }

  render(cx) {
    return this.role === "look" ? this.renderLook(cx) : this.renderBar(cx);
  }
}
