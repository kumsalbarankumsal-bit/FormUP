import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { SPEED } from "../src/data/drills/speed.js";
import { SKILLS, nextDrill, applyDrill, logosTex, drillOf, LG } from "../src/lib/drills.js";
import { freshState } from "../src/lib/learn.js";
import { rng } from "../src/lib/util.js";

const kx = (t, where) => { try { katex.renderToString(t, { throwOnError: true, strict: "ignore" }); } catch (e) { assert.fail(`${where}: ${e.message.split("\n")[0]} ⟶ ${t}`); } };
const rich = (s, where) => String(s).split("$").forEach((p, i) => { if (i % 2) kx(p, where); });

test("Hız soruları: her beceri, her seviye; tek doğru, KaTeX derlenir, sayılar doğru", () => {
  const r = rng(11);
  for (const S of SPEED) for (const lv of [1, 2, 3]) for (let i = 0; i < 250; i++) {
    const g = S.gen(r, lv);
    rich(g.q, `${S.id}/${lv} q`); rich(g.qe, `${S.id}/${lv} qe`);
    kx(g.a, `${S.id}/${lv} a`);
    for (const t of g.traps || []) kx(t.t, `${S.id}/${lv} trap`);
    if (g.opts) assert.equal(g.opts.filter((o) => o.ok).length, 1, `${S.id}/${lv}: tek doğru`);
    if (typeof g.n === "number") assert.ok(Number.isFinite(g.n), `${S.id}: n sonlu`);
  }
});

test("Hız soruları: bilinen cevaplar", () => {
  const S = Object.fromEntries(SPEED.map((x) => [x.id, x]));
  // Sabit tohumla birkaç üreteci bağımsız hesapla doğrula
  const r = rng(3);
  for (let i = 0; i < 300; i++) {
    const g = S.mul.gen(r, 2); const [a, b] = g.q.match(/\d+/g).map(Number); assert.equal(g.n, a * b);
    const h = S.lin.gen(r, 2); assert.ok(Number.isInteger(h.n));
    const d = S.div.gen(r, 3); const [x, y] = d.q.match(/\d+/g).map(Number); assert.equal(d.n * y, x);
  }
});

test("LOGOS cevap metni TeX'e çevrilir ve derlenir", () => {
  const cases = { "0*x + -49": "-49", "-1*x + 59": "-x + 59", "8*x^2 + 11*x + 1": "8x^{2} + 11x + 1", "(x + 5)*(x - 2)": "(x + 5)(x - 2)", "sqrt(160)": "\\sqrt{160}", "-1/9": "-\\frac{1}{9}", "4.8": "4{,}8" };
  for (const [a, b] of Object.entries(cases)) assert.equal(logosTex(a), b, a);
  for (const B of LG.BECERILER) for (const sv of [1, 2, 3]) for (let i = 0; i < 60; i++) {
    const q = LG.goreveDonustur(B.uret(sv), "elemeli");
    if (q.gorev !== "elemeli") continue;
    for (const o of q.secenekler) kx(logosTex(o.metin), `${B.id}/${sv} ${o.metin}`);
  }
});

test("Antrenman motoru: tekrar etmeyen sorular, seviye uyarlaması", () => {
  let s = { ...freshState(), settings: { ...freshState().settings, unlockAll: true } };
  const r = rng(9);
  const keys = new Set();
  for (let i = 0; i < 1500; i++) {
    const q = nextDrill(s, r, []);
    assert.ok(q, "soru üretilmeli");
    assert.ok(!keys.has(q.hash), `tekrar: ${q.key}`);
    keys.add(q.hash);
    if (q.src === "speed") assert.equal(q.opts.filter((o) => o.ok).length, 1, q.key);
    s = { ...s, drill: applyDrill(s, q, i % 5 !== 0, 1500) };
  }
  const d = drillOf(s);
  assert.ok(Object.values(d.sk).some((x) => x.lv > 1), "hızlı ve doğru gidince seviye artar");
  assert.ok(SKILLS.length >= 60);
});
