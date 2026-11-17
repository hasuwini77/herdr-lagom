// Contrast: scores a theme's text colours against WCAG 2.2 AA.
// Opens as a dialog (mod.open {name: "contrast"}). It starts on the shown theme; the chips
// score any other installed theme without switching to it. It reads themes(), nothing else.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, themes, settings, props, closeOverlay } from "herdr";

const rgb = (h) => {
  h = String(h).replace("#", "").slice(0, 6);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const SURFACES = ["background", "canvas", "chrome", "surface", "popover", "raised", "hover", "selected"];
const TEXT = ["foreground", "muted", "dim", "accent", "working", "blocked", "done", "idle"];
const AA_TEXT = 4.5, AA_EDGE = 3;

// One row per check: what is drawn, on what, the ratio and the bar it has to clear.
function score(c) {
  const rows = [];
  for (const name of TEXT) {
    if (!c[name]) continue;
    // A text colour is only as good as the worst surface it can land on.
    const worst = SURFACES.filter((s) => c[s]).map((s) => ({ s, r: ratio(c[name], c[s]) })).sort((a, b) => a.r - b.r)[0];
    rows.push({ group: "Panel text", label: name, on: worst.s, fg: c[name], bg: c[worst.s], r: worst.r, need: AA_TEXT });
  }
  for (let i = 1; i <= 15; i++) {
    const fg = c[`ansi${i}`];
    if (fg) rows.push({ group: "Terminal colours", label: `ansi ${i}`, on: "background", fg, bg: c.background, r: ratio(fg, c.background), need: AA_TEXT });
  }
  if (c.accent_foreground) rows.push({ group: "Controls", label: "button text", on: "accent", fg: c.accent_foreground, bg: c.accent, r: ratio(c.accent_foreground, c.accent), need: AA_TEXT });
  if (c.input) rows.push({ group: "Controls", label: "control edge", on: "canvas", fg: c.input, bg: c.canvas, r: ratio(c.input, c.canvas), need: AA_EDGE });
  return rows;
}

export default class Contrast extends View {
  init() { this.pick = null; }

  render() {
    const t = theme();
    const all = themes();
    const name = this.pick ?? settings().theme;
    const colors = all.find((x) => x.name === name)?.colors ?? t;
    const rows = score(colors), failed = rows.filter((r) => r.r < r.need).length;
    const chip = (x) => {
      const on = x.name === name;
      return h_flex().id(`ct-${x.name}`).h(28).px(10).flex_none().items_center().rounded(6).border(1).text_size(12)
        .border_color(on ? t.accent : t.input).bg(on ? t.accent : t.popover).text_color(on ? t.accent_foreground : t.foreground)
        .when(on, (el) => el.font_semibold())
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { this.pick = x.name; cx.notify(); })
        .child(x.name);
    };
    const row = (r, i) => {
      const ok = r.r >= r.need;
      return h_flex().id(`row-${i}`).h(30).gap(10).items_center().text_size(12.5)
        .child(div().w(40).h(22).flex_none().flex().items_center().justify_center().rounded(4).border(1).border_color(t.border).bg(r.bg).text_color(r.fg).font_semibold().child("Aa"))
        .child(div().w(110).flex_none().truncate().child(r.label))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(`on ${r.on}`))
        .child(div().w(64).flex_none().child(`${r.r.toFixed(2)}:1`))
        .child(div().w(54).flex_none().text_color(t.muted).child(`≥ ${r.need}`))
        .child(div().w(52).flex_none().font_semibold().text_color(ok ? t.done : t.blocked).child(ok ? "✓ Pass" : "× Fail"));
    };
    const groups = ["Panel text", "Terminal colours", "Controls"].map((g) => ({ g, rows: rows.filter((r) => r.group === g) })).filter((x) => x.rows.length);
    let n = 0;
    return v_flex().id("contrast").w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground).text_size(13)
      .child(h_flex().items_center().justify_between()
        .child(v_flex()
          .child(div().text_size(15).font_semibold().child(`Contrast · ${name}`))
          .child(div().text_color(failed ? t.blocked : t.done).child(failed ? `× ${failed} of ${rows.length} checks fail WCAG AA` : `✓ All ${rows.length} checks pass WCAG AA`)))
        .child(h_flex().id("ct-close").h(28).px(10).items_center().rounded(6).border(1).border_color(t.input).text_size(12)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => closeOverlay(props().overlay)).child("Close")))
      .child(h_flex().flex_wrap().gap(6).children(all.map(chip)))
      .child(div().text_size(12).text_color(t.muted).child("Each text colour is scored on the surface where it reads worst. Text needs 4.5:1, control edges 3:1."))
      .child(v_flex().id("ct-list").flex_1().min_h(0).gap(2).overflow_y_scrollbar().children(
        groups.flatMap(({ g, rows }) => [
          div().pt(8).pb(2).text_size(12).font_semibold().text_color(t.muted).child(g),
          ...rows.map((r) => row(r, n++)),
        ])));
  }
}
