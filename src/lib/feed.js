/* Akış (Reels tarzı öğrenme): sonsuz, dikey kaydırmalı gönderi üreticisi.
   Uygulamanın ilkeleri korunur:
   - Yeni formüller yol sırasıyla gelir; tanıtımdan birkaç gönderi sonra küçük bir soru gelir,
     doğru cevaplanınca formül öğrenilmiş sayılır (FSRS'e "yeni" olarak girer).
   - Vadesi gelen tekrarlar soru gönderisi olarak araya serpiştirilir ve FSRS ile notlanır.
   - Günlük yeni formül kotası vardır; kota dolunca akış pekiştirmeye döner (aralıklı tekrar bozulmaz).
   - Cevaplanmadan geçilen soru cezalandırılmaz, biraz sonra yeniden sorulur.
   Saf mantık: React yok. Durumu getState() ile her seferinde taze okur. */
import { CARDS, BY_ID, GEN, dueIds, learned, currentR } from "./learn.js";
import { RANKS } from "../data/v2/meta.js";
import { shuffle, pick, rng, dayKey } from "./util.js";

export const FEED_NEW_CAP = 15;

export function feedOf(s) {
  const f = s.feed || {};
  return { saved: f.saved || {}, day: f.day || "", newN: f.newN || 0, posts: f.posts || 0, chests: f.chests || 0 };
}
export function newLeft(s, now) {
  const f = feedOf(s);
  return Math.max(0, FEED_NEW_CAP - (f.day === dayKey(now) ? f.newN : 0));
}

/** Bir kartın akışta gösterilebilecek bilgi gönderileri */
export function factKinds(c, labMap = {}) {
  const k = [];
  if (c.use || c.usee) k.push("use");
  if (c.k || c.ke) k.push("cond");
  if (c.w || c.we) k.push("why");
  if (c.e) k.push("example");
  if (c.h) k.push("hook");
  if (c.s) k.push("story");
  if (c.x && c.x.length) k.push("trap");
  if (c.t && c.t.length) k.push("term");
  if (c.c) k.push("calc");
  if (c.lab && labMap[c.lab]) k.push("lab");
  return k;
}

/** Soru biçimi: yeni öğrenmede tanıma, sağlam hafızada hatırlama ve uygulama */
export function quizMode(c, p, purpose, r) {
  const o = [];
  const strong = p && p.reps && p.s >= 3;
  if (c.x && c.x.length) o.push("mc", "mc", "tf", "tf");
  if (c.b && c.b.blanks.length && c.b.blanks.length <= 4) o.push("cloze", "cloze");
  if (purpose !== "learn") o.push("name");
  if (c.q && purpose !== "learn") o.push("which");
  if (c.g && GEN[c.g] && (strong || purpose === "practice")) o.push("apply", "apply");
  if (!o.length) o.push("name");
  return pick(o, r);
}

/** Uygulama sorusu için 4 sayısal seçenek (doğru + inandırıcı çeldiriciler) */
export function numericOptions(a, r) {
  const fmt = (v) => {
    const x = Math.round(v * 1e4) / 1e4;
    return Object.is(x, -0) ? 0 : x;
  };
  const right = fmt(a);
  const cands = [a + 1, a - 1, a * 2, a / 2, -a, a + 10, a - 10, a * 10, a / 10, a + 2, a * 1.5, a + 0.5]
    .map(fmt).filter((v) => Number.isFinite(v) && v !== right);
  const uniq = [...new Set(shuffle(cands, r))].slice(0, 3);
  return shuffle([{ v: right, ok: true }, ...uniq.map((v) => ({ v, ok: false }))], r);
}

let keySeq = 0;
const mk = (kind, extra = {}) => ({ key: `p${++keySeq}`, kind, seed: Math.floor(Math.random() * 1e9), ...extra });

/**
 * Akış üreticisi.
 * getState(): güncel uygulama durumu. labMap: mevcut laboratuvarlar. mode: "foryou" | "saved".
 */
export function makeFeed(getState, { labMap = {}, mode = "foryou" } = {}) {
  const r = rng(Date.now() % 1e9);
  let idx = 0, sinceIntro = 99, sinceSpecial = 0, answeredSinceChest = 0, mathIdx = 0;
  const introduced = new Map();   // cid → { wrong }
  const pending = [];             // { at, post }
  const recent = [];              // son gösterilen kart kimlikleri
  const reviewed = new Set();     // bu oturumda tekrar sorusu sorulan kartlar
  const factUsed = new Map();     // cid → Set(kind)

  const touch = (cid) => { recent.push(cid); if (recent.length > 8) recent.shift(); };
  const isRecent = (cid) => recent.slice(-4).includes(cid);
  const schedule = (gap, post) => pending.push({ at: idx + gap, post });

  function factPost(cid) {
    const c = BY_ID[cid];
    const kinds = factKinds(c, labMap);
    if (!kinds.length) return null;
    const used = factUsed.get(cid) || new Set();
    const fresh = kinds.filter((k) => !used.has(k));
    const kind = pick(fresh.length ? fresh : kinds, r);
    used.add(kind); factUsed.set(cid, used);
    touch(cid);
    return mk("fact", { cid, fact: kind });
  }
  function quizPost(cid, purpose) {
    const s = getState();
    const c = BY_ID[cid];
    touch(cid);
    return mk("quiz", { cid, purpose, mode: quizMode(c, s.cards[cid], purpose, r) });
  }
  function introPost(s) {
    const c = CARDS.find((x) => { const p = s.cards[x.id]; return !(p && (p.reps || p.sus)) && !introduced.has(x.id); });
    if (!c) return null;
    introduced.set(c.id, { wrong: false });
    sinceIntro = 0;
    touch(c.id);
    // pekiştirme: araya bir bilgi gönderisi, sonra öğrenme sorusu
    schedule(2, factPost(c.id) || mk("fact", { cid: c.id, fact: "formula" }));
    schedule(3 + Math.floor(r() * 2), mk("quiz", { cid: c.id, purpose: "learn", mode: quizMode(c, null, "learn", r) }));
    return mk("intro", { cid: c.id });
  }
  function special() {
    const s = getState();
    if (answeredSinceChest >= 5 && r() < 0.5) { answeredSinceChest = 0; return mk("chest", { amount: 3 + Math.floor(r() * 6) }); }
    const ranks = RANKS.filter((x) => x.who);
    const rank = ranks[mathIdx++ % ranks.length];
    return mk("legend", { rank, have: s.xp });
  }

  function nextForYou() {
    const s = getState();
    const now = Date.now();
    const L = learned(s);
    const due = dueIds(s, now).filter((id) => !reviewed.has(id) && !isRecent(id) && !pending.some((p) => p.post.cid === id));
    const pendingLearn = pending.filter((p) => p.post.purpose === "learn").length;
    const canNew = newLeft(s, now) > 0 && pendingLearn < 2 && sinceIntro >= 3;
    const freshIds = [...introduced.keys()].filter((id) => !isRecent(id));
    const factPool = freshIds.concat(Object.keys(feedOf(s).saved), L.filter((id) => !isRecent(id)));
    const w = {
      due: due.length ? 38 : 0,
      intro: canNew ? (L.length < 10 ? 46 : 26) : 0,
      fact: factPool.length ? 30 : 0,
      practice: L.length ? 12 : 0,
      special: sinceSpecial >= 12 ? 14 : 0,
    };
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    if (!total) return introPost(s) || mk("empty", { reason: "done" });
    let x = r() * total, pickKey = "fact";
    for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0 && v > 0) { pickKey = k; break; } }

    if (pickKey === "special") { sinceSpecial = 0; return special(); }
    if (pickKey === "due") {
      const id = due[0];
      reviewed.add(id);
      return quizPost(id, "review");
    }
    if (pickKey === "intro") return introPost(s) || factOrPractice(s, factPool, L);
    if (pickKey === "practice") {
      // en zayıf hatırlananlardan biri
      const pool = L.filter((id) => !isRecent(id) && !s.cards[id].sus)
        .sort((a, b) => (currentR(s.cards[a], now) ?? 1) - (currentR(s.cards[b], now) ?? 1)).slice(0, 8);
      if (pool.length) return quizPost(pick(pool, r), "practice");
    }
    return factOrPractice(s, factPool, L);
  }
  function factOrPractice(s, factPool, L) {
    // yeni tanıtılanlara ağırlık ver
    const fresh = [...introduced.keys()].filter((id) => !isRecent(id));
    const pool = fresh.length && r() < 0.6 ? fresh : factPool;
    for (let i = 0; i < 6 && pool.length; i++) {
      const p = factPost(pick(pool, r));
      if (p) return p;
    }
    if (L.length) return quizPost(pick(L, r), "practice");
    return introPost(s) || mk("empty", { reason: "done" });
  }

  function nextSaved() {
    const s = getState();
    const ids = Object.keys(feedOf(s).saved).filter((id) => BY_ID[id]);
    if (!ids.length) return mk("empty", { reason: "saved" });
    const pool = ids.filter((id) => !isRecent(id));
    const cid = pick(pool.length ? pool : ids, r);
    const p = s.cards[cid];
    if (p && p.reps && r() < 0.45) return quizPost(cid, "practice");
    return factPost(cid) || quizPost(cid, "practice");
  }

  return {
    mode,
    next() {
      idx++; sinceIntro++; sinceSpecial++;
      const pi = pending.findIndex((p) => p.at <= idx);
      if (pi >= 0) return pending.splice(pi, 1)[0].post;
      return mode === "saved" ? nextSaved() : nextForYou();
    },
    take(n) { const out = []; for (let i = 0; i < n; i++) { const p = this.next(); out.push(p); if (p.kind === "empty") break; } return out; },
    /** Cevap geldi: öğrenme mantığını sürdür. Döner: { grade, isNew, known } (App bunu uygular) */
    answered(post, ok, ms) {
      answeredSinceChest++;
      const s = getState();
      const p = s.cards[post.cid];
      const fresh = !(p && p.reps);
      const L = introduced.get(post.cid);
      if (post.purpose === "learn" || post.purpose === "prove") {
        if (ok) {
          if (post.purpose === "prove" && fresh) return { known: true };
          const g = L && L.wrong ? 2 : ms < 12000 ? 3 : 2;
          return { grade: g, isNew: fresh };
        }
        if (L) L.wrong = true; else introduced.set(post.cid, { wrong: true });
        schedule(1, mk("fact", { cid: post.cid, fact: "formula", recap: true }));
        schedule(3, mk("quiz", { cid: post.cid, purpose: "learn", mode: quizMode(BY_ID[post.cid], null, "learn", r) }));
        return {};
      }
      if (post.purpose === "review") {
        if (!ok) {
          schedule(1, mk("fact", { cid: post.cid, fact: "formula", recap: true }));
          schedule(4, mk("quiz", { cid: post.cid, purpose: "practice", mode: quizMode(BY_ID[post.cid], p, "practice", r) }));
        }
        return { grade: ok ? (ms < 12000 ? 3 : 2) : 1 };
      }
      return {};
    },
    /** "Zaten biliyorum": hemen bir kanıt sorusu */
    claimKnown(cid) {
      const i = pending.findIndex((p) => p.post.cid === cid && p.post.purpose === "learn");
      if (i >= 0) pending.splice(i, 1);
      return mk("quiz", { cid, purpose: "prove", mode: quizMode(BY_ID[cid], null, "learn", r) });
    },
    /** Cevaplanmadan geçilen soru: cezasız, biraz sonra yeniden */
    skipped(post) {
      if (post.requeued) return;
      schedule(4, { ...post, key: `p${++keySeq}`, requeued: true });
    },
  };
}

/** Dolgu: gönderi türüne göre alt başlık */
export const FACT_LABEL = {
  use: ["Ne işe yarar?", "What is it for?", "🎯"],
  cond: ["Ne zaman geçerli?", "When does it hold?", "📌"],
  why: ["Neden böyle?", "Why is it true?", "💡"],
  example: ["Örnekle gör", "See an example", "✍️"],
  hook: ["Hafıza kancası", "Memory hook", "🧠"],
  story: ["Hikâyesi", "The story", "📜"],
  trap: ["Bu tuzağa düşme", "Don't fall for this", "⚠️"],
  term: ["İngilizce terim", "English term", "🔤"],
  calc: ["Sayılarla oyna", "Play with numbers", "🎛️"],
  lab: ["Laboratuvar", "Lab", "🧪"],
  formula: ["Bir daha bak", "Look again", "👀"],
};
