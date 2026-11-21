/* İşlem ve hafıza antrenmanı: iki soru bankası tek motor.
   1) LOGOS (26 beceri × 3 seviye, cihazda üretilip doğrulanır; tipik hatadan türetilmiş çeldiriciler, hata avı)
   2) Hız soruları (SPEED: zihinden işlem, kesir-yüzde, üs-kök-log, trigonometri, dizi, olasılık, türev-integral)
   Her beceri için seviye kendiliğinden ayarlanır: hızlı ve doğru gidersen zorlaşır, takılırsan kolaylaşır.
   Görülen her soru hatırlanır (Bloom filtresi); aynı soru bir daha gelmez. Havuzu tükenen beceri dinlenmeye alınır. */
import * as LG from "../data/logos/engine.js";
import { SPEED, SPEED_BY_ID, num } from "../data/drills/speed.js";
import { rng, shuffle, hashStr } from "./util.js";

/* Görülen sorular: Bloom filtresi (2^19 bit ≈ 64 KB; 60.000 soruda yanlış-pozitif < %1).
   Bir yıldan uzun süre aynı sorunun tekrar gelmemesini sağlar; yer kaplamaz. */
const BITS = 1 << 19, K = 8;
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
let bCache = { s: null, a: null };
function bloomOf(d) {
  if (d.bloom && bCache.s === d.bloom) return bCache.a;
  const a = new Uint8Array(BITS / 8);
  if (d.bloom) { const bin = atob(d.bloom); for (let i = 0; i < bin.length && i < a.length; i++) a[i] = bin.charCodeAt(i); }
  bCache = { s: d.bloom || null, a };
  return a;
}
function bloomIdx(key) { const h1 = fnv(key), h2 = (hashStr(key) | 1) >>> 0; const out = []; for (let i = 0; i < K; i++) out.push((h1 + Math.imul(i, h2)) >>> 0 & (BITS - 1)); return out; }
const bloomHas = (a, key) => bloomIdx(key).every((i) => a[i >> 3] & (1 << (i & 7)));
function bloomAdd(a, key) { const b = new Uint8Array(a); for (const i of bloomIdx(key)) b[i >> 3] |= 1 << (i & 7); return b; }
function b64(a) { let s = ""; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); }
/* Ezber bilgisi türleri (12², sin 30°, 3/4 = 0,75 …): bunların havuzu doğası gereği küçüktür ve
   hafızayı diri tutmak için aralıklı dönmeleri gerekir → en fazla haftada bir aynı soru. */
const RECALL = new Set(["s:log", "s:sq", "s:cube", "s:root", "s:trig", "s:rad", "s:conv", "l:t4-4", "l:t4-5", "l:t3-3", "l:t2-3"]);
const week = () => Math.floor(Date.now() / (7 * 864e5));
const LOGOS_SEC = { 0: [20, 28, 36], 1: [30, 40, 55], 2: [35, 50, 70], 3: [40, 55, 75], 4: [35, 45, 60] };

export function drillOf(s) {
  const d = s.drill || {};
  return { sk: d.sk || {}, bloom: d.bloom || "", n: d.n || 0 };
}
const stat = (d, id) => d.sk[id] || { lv: 1, n: 0, ok: 0, st: 0, ms: 0, last: 0 };
const acc = (x) => (x.n ? x.ok / x.n : 0.5);

/** Tüm beceriler: { id, src, name, en, kademe, on } */
export const SKILLS = [
  ...SPEED.map((x) => ({ id: "s:" + x.id, src: "speed", name: x.tr, en: x.en, key: x.id })),
  ...LG.BECERILER.map((b) => ({ id: "l:" + b.id, src: "logos", name: b.ad, en: "", key: b.id, kademe: b.kademe, on: b.on.map((o) => "l:" + o), kart: b.kart })),
];
export const SKILL = Object.fromEntries(SKILLS.map((k) => [k.id, k]));

/** LOGOS becerisi açık mı? Önkoşullar biraz çalışılmış olmalı (ya da öğrenci ileri seviyede başladı) */
function unlocked(d, k, s) {
  if (k.src !== "logos" || !k.on || !k.on.length) return true;
  if (s.settings && (s.settings.start === "good" || s.settings.unlockAll)) return true;
  return k.on.every((o) => { const x = stat(d, o); return x.n >= 4 && acc(x) >= 0.6; });
}

/** Sıradaki beceri: zayıf olanlara, uzun süredir görülmeyenlere ve yenilere ağırlık */
export function pickSkill(s, r, recent = [], filter = () => true) {
  const d = drillOf(s);
  const now = Date.now();
  const list = SKILLS.filter((k) => filter(k) && unlocked(d, k, s) && !recent.slice(-3).includes(k.id));
  let tot = 0;
  const w = list.map((k) => {
    const x = stat(d, k.id);
    const weak = 1 + 2 * (1 - acc(x));
    const stale = x.last ? Math.min(3, 1 + (now - x.last) / 864e5) : 1.6;
    const fresh = x.n < 3 ? 1.4 : 1;
    const v = weak * stale * fresh * (k.src === "logos" ? 1.15 : 1);
    tot += v;
    return v;
  });
  let t = r() * tot;
  for (let i = 0; i < list.length; i++) { t -= w[i]; if (t <= 0) return list[i]; }
  return list[0];
}

/* ---------- soru kurma ---------- */
function speedQuestion(k, lv, r) {
  const S = SPEED_BY_ID[k.key];
  const g = S.gen(r, lv);
  let opts;
  if (g.opts) opts = g.opts.map((o) => ({ t: o.t, ok: !!o.ok }));
  else {
    opts = [{ t: g.a, ok: true }];
    const has = (t) => opts.some((o) => o.t.replace(/\s/g, "") === t.replace(/\s/g, ""));
    for (const tr of g.traps || []) if (tr && tr.t && !has(tr.t) && opts.length < 4) opts.push({ t: tr.t, ok: false, why: tr.why });
    if (typeof g.n === "number" && Number.isFinite(g.n)) {
      const n = g.n;
      const step = Math.abs(n) >= 100 ? 10 : 1;
      for (const v of shuffle([n + step, n - step, n + 2 * step, n - 2 * step, n * 2, n + 5 * step, -n], r)) {
        if (opts.length >= 4) break;
        const t = num(v);
        if (!has(t) && Number.isFinite(v)) opts.push({ t, ok: false, why: "Hesap hatası" });
      }
    }
    for (const t of shuffle(g.pool || [], r)) { if (opts.length >= 4) break; if (!has(t)) opts.push({ t, ok: false }); }
    opts = shuffle(opts, r);
  }
  const body = g.opts ? `${g.q}|${g.opts.map((o) => o.t).sort().join(",")}` : `${g.q}|${g.a}`;
  return { src: "speed", skill: k.id, lv, q: g.q, qe: g.qe, opts, sec: S.sec[lv - 1], key: `${k.id}|${body}${RECALL.has(k.id) ? `|w${week()}` : ""}` };
}

function logosQuestion(k, lv, r) {
  const b = LG.BID[k.key];
  const base = b.uret(lv);
  const want = r() < 0.22 ? "hataAvi" : "elemeli";
  let q = LG.goreveDonustur(base, want);
  if (q.gorev !== want) q = LG.goreveDonustur(base, want === "hataAvi" ? "elemeli" : "hataAvi");
  if (q.gorev === "klasik") return null; // çoktan seçmeliye çevrilemeyen (sistem, formül düzenleme): atla
  const key = `${k.id}|${LG.parcaMetin(base.parcalar)}|${base.talimat}${RECALL.has(k.id) ? `|w${week()}` : ""}`;
  return { src: "logos", skill: k.id, lv, task: q.gorev, L: q, sec: LOGOS_SEC[b.kademe][lv - 1] * (q.gorev === "hataAvi" ? 1.2 : 1), key };
}

/** Yeni, daha önce görülmemiş bir soru üret */
export function nextDrill(s, r = Math.random, recent = [], filter = () => true, extraSeen = null) {
  const d = drillOf(s);
  const bloom = bloomOf(d);
  const seenKey = (key) => bloomHas(bloom, key) || (extraSeen && extraSeen.has(key));
  const tired = new Set(); // bu çağrıda yalnızca görülmüş soru veren beceriler
  for (let attempt = 0; attempt < 24; attempt++) {
    const k = pickSkill(s, r, recent, (x) => filter(x) && !tired.has(x.id));
    if (!k) return null;
    let q = null;
    // önce kendi seviyesinde dene; o seviyede yeni soru kalmadıysa bir üst seviyeye geç
    for (let lv = stat(d, k.id).lv; lv <= 3; lv++) {
      let cand = null;
      for (let t = 0; t < 4 && !cand; t++) {
        try { cand = k.src === "speed" ? speedQuestion(k, lv, r) : logosQuestion(k, lv, r); } catch (e) { cand = null; }
        if (cand && seenKey(cand.key)) cand = null;
      }
      if (cand) { q = cand; break; }
    }
    if (!q) { if (attempt < 22) { tired.add(k.id); continue; } try { q = k.src === "speed" ? speedQuestion(k, stat(d, k.id).lv, r) : logosQuestion(k, stat(d, k.id).lv, r); } catch (e) { q = null; } if (!q) continue; }
    const h = q.key;
    if (q.src === "speed" && q.opts.filter((o) => o.ok).length !== 1) continue;
    q.hash = h;
    return q;
  }
  return null;
}

/** Cevaptan sonra beceri istatistiği ve seviye uyarlaması (saf: yeni drill durumu döner) */
export function applyDrill(s, q, ok, ms) {
  const d = drillOf(s);
  const x = { ...stat(d, q.skill) };
  x.n++; if (ok) x.ok++;
  x.ms = x.ms ? Math.round(x.ms * 0.7 + ms * 0.3) : Math.round(ms);
  x.last = Date.now();
  const fast = ms <= q.sec * 1000;
  if (ok && fast) { x.st = Math.max(0, x.st) + 1; if (x.st >= 4 && x.lv < 3) { x.lv++; x.st = 0; } }
  else if (!ok) { x.st = Math.min(0, x.st) - 1; if (x.st <= -2 && x.lv > 1) { x.lv--; x.st = 0; } }
  const bloom = b64(bloomAdd(bloomOf(d), q.hash));
  return { sk: { ...d.sk, [q.skill]: x }, bloom, n: d.n + 1 };
}

/** LOGOS cevap metnini TeX'e çevir ("8*x^2 + -3*x" → "8x^{2} - 3x") */
export function logosTex(s) {
  let t = String(s).replace(/\s+/g, " ").trim();
  t = t.replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}").replace(/√(\d+)/g, "\\sqrt{$1}");
  t = t.replace(/\+\s*-\s*/g, "- ").replace(/-\s*-\s*/g, "+ ");
  t = t.replace(/(^|[\s(+\-=<>,])0\*[a-z](\^\d+)?\s*([+-]\s*)?/g, (m, a, b, c) => a + (c && c.includes("-") ? "-" : ""));
  t = t.replace(/(^|[\s(+\-=<>,])1\*([a-z])/g, "$1$2");
  t = t.replace(/(\d)\*([a-z(\\])/g, "$1$2").replace(/\)\*\(/g, ")(").replace(/\*/g, " \\cdot ");
  t = t.replace(/\^\(([^()]*)\)/g, "^{$1}").replace(/\^(-?\d+)/g, "^{$1}");
  t = t.replace(/(-?)(\d+)\/(\d+)/g, (m, sg, a, b) => `${sg}\\frac{${a}}{${b}}`);
  t = t.replace(/<=|≤/g, " \\le ").replace(/>=|≥/g, " \\ge ").replace(/°/g, "^\\circ").replace(/\bpi\b|π/g, "\\pi");
  t = t.replace(/−/g, "-").replace(/\./g, "{,}");
  return t.trim() || "0";
}

export const HATA = LG.HATA_TURU;
export const GOREV_AD = LG.GOREV_AD;
export { LG };
export const drillRng = (seed) => rng(seed);
