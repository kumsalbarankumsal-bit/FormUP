/* Akış: Reels gibi dikey, tam ekran, sonsuz öğrenme akışı.
   Her gönderi bir formülün bir yüzü: tanıtım (hikâye adımları), bilgi, tuzak, terim, canlı hesap,
   laboratuvar ya da hızlı soru. Çift dokun = kaydet (yıldız patlaması). Basılı tut = hikâyeyi durdur. */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Star, Info, FlaskConical, Volume2, VolumeX, Check, X, ChevronDown, Sparkles, Flame, Gift, Bookmark, Languages, Zap } from "lucide-react";
import { Formula, Field, Rich, Tex, plain } from "../lib/tex.jsx";
import { Bi, Sheet, sparkleAt } from "./common.jsx";
import Pi from "./Pi.jsx";
import LiveCalc from "./LiveCalc.jsx";
import { LAB_MAP } from "../labs/index.js";
import { BY_ID, UNIT, GEN, mcOptions, tfCandidate, nameOptions, whichOptions, clozeBank, today } from "../lib/learn.js";
import { makeFeed, feedOf, newLeft, numericOptions, FACT_LABEL, FEED_NEW_CAP } from "../lib/feed.js";
import { SKILL, logosTex, HATA, LG } from "../lib/drills.js";
import { rng, pick, vibrate } from "../lib/util.js";
import { play } from "../lib/sound.js";

const MODE_LETTER = { mc: "m", tf: "t", name: "r", which: "w", cloze: "z", apply: "a" };
const PURPOSE = {
  learn: ["Hızlı soru", "Quick check", "⚡"], review: ["Tekrar zamanı", "Review time", "⏰"],
  practice: ["Pratik", "Practice", "🎯"], prove: ["Kanıtla!", "Prove it!", "🛡️"],
};
const REDUCED = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- konuşma (İngilizce telaffuz) ---------- */
function speak(text, lang = "en-US") {
  try {
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(plain(text).replace(/~/g, ""));
    u.lang = lang; u.rate = 0.92; u.pitch = 1.05;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { /* desteklenmiyor */ }
}

/* ---------- kelime kelime beliren metin ---------- */
function Words({ text, d0 = 0, className = "" }) {
  if (!text) return null;
  const parts = String(text).replace(/^~/, "").split("$");
  const toks = [];
  parts.forEach((p, i) => {
    if (i % 2) toks.push({ m: p });
    else p.split(/(\s+)/).forEach((w) => { if (w) toks.push(/^\s+$/.test(w) ? { s: w } : { t: w }); });
  });
  let n = 0;
  return (
    <span className={"words " + className} style={{ "--d0": `${d0}ms` }}>
      {toks.map((t, i) => (t.s ? t.s : <span key={i} className="w" style={{ "--i": n++ }}>{t.m != null ? <Tex tex={t.m} /> : t.t}</span>))}
    </span>
  );
}

/* =====================================================================
   Akış kabı
   ===================================================================== */
export default function Feed({ state, now, act, memo }) {
  const S = state.settings;
  const scroller = useRef(null);
  if (!memo.current) memo.current = { modes: {}, mode: "foryou" };
  const M = memo.current;
  M.state = state;
  const [mode, setModeRaw] = useState(M.mode);
  const sess = useMemo(() => {
    if (!M.modes[mode]) {
      const engine = makeFeed(() => M.state, { labMap: LAB_MAP, mode });
      M.modes[mode] = { engine, posts: engine.take(4), results: {}, active: 0, seen: {}, combo: 0 };
    }
    return M.modes[mode];
  }, [mode]); // eslint-disable-line
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);
  const [active, setActive] = useState(sess.active);
  const [fx, setFx] = useState([]);
  const [lab, setLab] = useState(null);
  const [voice, setVoice] = useState(!!M.voice);
  const [hint, setHint] = useState(!M.hinted);
  const shownAt = useRef(Date.now());
  const goalRef = useRef(null);

  const setMode = (m) => { if (m === mode) return; sess.active = active; M.mode = m; setModeRaw(m); };
  useEffect(() => { setActive(sess.active); const el = scroller.current; if (el) el.scrollTop = sess.active * el.clientHeight; }, [sess]); // eslint-disable-line

  // açılışta kaldığı yere dön
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollTop = sess.active * el.clientHeight; }, []); // eslint-disable-line

  // aktif gönderi takibi
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (i === sess.active) return;
    const prev = sess.posts[sess.active];
    // cevaplanmadan geçilen soru: cezasız, sonra yeniden
    if (prev && prev.kind === "quiz" && !sess.results[prev.key] && i > sess.active) sess.engine.skipped(prev);
    sess.active = i;
    setActive(i);
    shownAt.current = Date.now();
    if (hint) { setHint(false); M.hinted = true; }
    vibrate(6, S.haptics);
    if (S.sound) play("tap", true);
    // sonsuz akış: sona yaklaşınca yenilerini ekle
    if (i >= sess.posts.length - 3 && sess.posts[sess.posts.length - 1].kind !== "empty") {
      sess.posts = sess.posts.concat(sess.engine.take(4));
      rerender();
    }
  }, [sess, hint, S.haptics, S.sound]); // eslint-disable-line

  // günlük hedef akış içinde dolarsa kutlama gönderisi
  const xpToday = today(state, now).xp || 0;
  useEffect(() => {
    if (goalRef.current != null && goalRef.current < S.goal && xpToday >= S.goal) {
      const post = { key: `goal${Date.now()}`, kind: "goal", seed: 1 };
      sess.posts = [...sess.posts.slice(0, sess.active + 1), post, ...sess.posts.slice(sess.active + 1)];
      rerender();
    }
    goalRef.current = xpToday;
  }, [xpToday]); // eslint-disable-line

  // klavye: ↑ ↓ j k boşluk
  useEffect(() => {
    const k = (e) => {
      if (document.querySelector(".scrim")) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const el = scroller.current;
      if (!el) return;
      if (e.key === "ArrowDown" || e.key === "j" || (e.key === " " && !e.target.closest?.("button"))) { e.preventDefault(); el.scrollTo({ top: (sess.active + 1) * el.clientHeight, behavior: "smooth" }); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); el.scrollTo({ top: Math.max(0, sess.active - 1) * el.clientHeight, behavior: "smooth" }); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sess]);

  const addFx = (x, y, kind, text) => {
    if (REDUCED && kind !== "xp") return;
    const id = Math.random();
    setFx((f) => [...f, { id, x, y, kind, text }]);
    setTimeout(() => setFx((f) => f.filter((q) => q.id !== id)), kind === "like" ? 1100 : 1000);
  };
  const goNext = () => { const el = scroller.current; if (el) el.scrollTo({ top: (sess.active + 1) * el.clientHeight, behavior: "smooth" }); };

  const like = (post, x, y) => {
    if (!post.cid) return;
    const saved = !!feedOf(state).saved[post.cid];
    if (!saved) act.toggleSave(post.cid);
    addFx(x, y, "like");
    vibrate([8, 30, 14], S.haptics);
    if (S.sound) play("correct", true);
  };

  /** Soru cevaplandı */
  const answer = (post, ok, e, extra = {}) => {
    if (sess.results[post.key]) return;
    const ms = Date.now() - shownAt.current;
    sess.combo = ok ? sess.combo + 1 : 0;
    const combo = sess.combo;
    const base = post.mode === "apply" ? 9 : 5;
    const xp = ok ? base + Math.min(combo - 1, 5) : 0;
    sess.results[post.key] = { ok, xp, combo, ...extra };
    const out = sess.engine.answered(post, ok, ms);
    act.answer({ cid: post.cid, mode: MODE_LETTER[post.mode] || "m", ok, ms, xp, combo, trap: !!extra.trap });
    if (out.known) act.known(post.cid);
    else if (out.grade) act.grade(post.cid, out.grade, out.isNew ? { isNew: true } : {});
    if (out.isNew || out.known) act.learnedNew();
    play(ok ? "correct" : "wrong", S.sound);
    vibrate(ok ? 12 : [30, 40, 30], S.haptics);
    const x = e && e.clientX ? e.clientX : window.innerWidth / 2, y = e && e.clientY ? e.clientY : window.innerHeight / 2;
    if (ok) { addFx(x, y, "xp", `+${xp} XP`); if (e && e.clientX) sparkleAt(e.clientX, e.clientY, 14); }
    if (ok && combo >= 3 && combo % 3 === 0) addFx(window.innerWidth / 2, window.innerHeight * 0.35, "combo", `${combo}`);
    // tahmin edilen yeni gönderiler: kuyruk değişmiş olabilir; sondaki üretilmemiş kısım zaten tembel
    rerender();
  };

  /** İşlem antrenmanı cevaplandı: XP (hızlıysa bonus), beceri seviyesi uyarlanır, soru "görüldü" olur */
  const answerDrill = (post, ok, e, extra = {}) => {
    if (sess.results[post.key]) return;
    const ms = Date.now() - shownAt.current;
    const q = post.d;
    const fast = ok && ms <= q.sec * 1000;
    sess.combo = ok ? sess.combo + 1 : 0;
    const combo = sess.combo;
    const xp = ok ? 4 + (fast ? 3 : 0) + Math.min(combo - 1, 5) : 0;
    sess.results[post.key] = { ok, xp, combo, ms, fast, ...extra };
    sess.engine.drillAnswered();
    act.answer({ cid: null, mode: "d", ok, ms, xp, combo });
    act.drill(q, ok, ms);
    play(ok ? "correct" : "wrong", S.sound);
    vibrate(ok ? (fast ? [8, 30, 8] : 12) : [30, 40, 30], S.haptics);
    const x = e && e.clientX ? e.clientX : window.innerWidth / 2, y = e && e.clientY ? e.clientY : window.innerHeight / 2;
    if (ok) { addFx(x, y, "xp", fast ? `⚡ +${xp} XP` : `+${xp} XP`); if (e && e.clientX) sparkleAt(e.clientX, e.clientY, fast ? 20 : 12); }
    if (ok && combo >= 3 && combo % 3 === 0) addFx(window.innerWidth / 2, window.innerHeight * 0.35, "combo", `${combo}`);
    rerender();
  };

  const claimKnown = (post) => {
    const q = sess.engine.claimKnown(post.cid);
    sess.posts = [...sess.posts.slice(0, sess.active + 1), q, ...sess.posts.slice(sess.active + 1)];
    rerender();
    setTimeout(goNext, 60);
  };

  const openLab = (id, cid) => { setLab({ id, cid }); act.lab(id); };
  const toggleVoice = () => { const v = !voice; setVoice(v); M.voice = v; if (!v) try { window.speechSynthesis.cancel(); } catch (e) { /* */ } };

  const combo = sess.combo;
  const saved = feedOf(state).saved;
  const left = newLeft(state, now);

  return (
    <div className="reels-root">
      <div className="reels-top">
        <div className="reels-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "foryou"} className={mode === "foryou" ? "on" : ""} onClick={() => setMode("foryou")}>Sana özel<span lang="en">For you</span></button>
          <button role="tab" aria-selected={mode === "speed"} className={mode === "speed" ? "on" : ""} onClick={() => setMode("speed")}>Hız<span lang="en">Speed</span></button>
          <button role="tab" aria-selected={mode === "saved"} className={mode === "saved" ? "on" : ""} onClick={() => setMode("saved")}>Kayıtlı<span lang="en">Saved</span></button>
        </div>
        <div className="reels-stats">
          {combo >= 2 && <span className="r-combo" key={combo}><Flame size={15} />{combo}</span>}
          <span className="r-goal" title="Bugünkü XP">
            <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--gold)" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${Math.min(1, xpToday / S.goal) * 94.2} 94.2`} transform="rotate(-90 18 18)" style={{ transition: "stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)" }} />
            </svg>
            <b className="num">{xpToday}</b>
          </span>
          <button className="r-icon" onClick={toggleVoice} aria-pressed={voice} aria-label={voice ? "Sesli telaffuzu kapat" : "Sesli telaffuzu aç"}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        </div>
      </div>

      <div className="reels" ref={scroller} onScroll={onScroll} aria-label="Öğrenme akışı">
        {sess.posts.map((p, i) => (Math.abs(i - active) <= 2
          ? <Reel key={p.key} post={p} index={i} active={i === active} state={state} result={sess.results[p.key]} saved={!!(p.cid && saved[p.cid])}
            voice={voice} onAnswer={answer} onDrill={answerDrill} onLike={like} onKnown={claimKnown} onLab={openLab} act={act} sess={sess} left={left} goNext={goNext} addFx={addFx} />
          : <section key={p.key} className="reel ghost" aria-hidden="true" />))}
      </div>

      {hint && active === 0 && !sess.results[(sess.posts[0] || {}).key] && <div className="swipe-hint" aria-hidden="true"><ChevronDown size={22} /><span>Kaydır · Swipe</span></div>}

      <div className="fx-layer" aria-hidden="true">
        {fx.map((f) => (
          f.kind === "like" ? (
            <span key={f.id} className="fx-like" style={{ left: f.x, top: f.y }}>
              <Star size={96} fill="currentColor" strokeWidth={1.2} />
              {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--a": `${i * 36}deg` }} />)}
            </span>
          ) : f.kind === "combo" ? (
            <span key={f.id} className="fx-combo" style={{ left: f.x, top: f.y }}><Flame size={30} /> {f.text}× <small>kombo</small></span>
          ) : (
            <span key={f.id} className="fx-xp" style={{ left: f.x, top: f.y }}>{f.text}</span>
          )
        ))}
      </div>

      {lab && LAB_MAP[lab.id] && (
        <Sheet onClose={() => setLab(null)} label="Laboratuvar">
          {React.createElement(LAB_MAP[lab.id], { card: BY_ID[lab.cid] })}
        </Sheet>
      )}
    </div>
  );
}

/* =====================================================================
   Tek gönderi
   ===================================================================== */
function Reel({ post, index, active, state, result, saved, voice, onAnswer, onDrill, onLike, onKnown, onLab, act, sess, left, goNext, addFx }) {
  const c = post.cid ? BY_ID[post.cid] : null;
  const u = c ? UNIT[c.u] : null;
  const dk = post.kind === "drill" ? SKILL[post.d.skill] : null;
  const planet = u ? u.planet : dk ? (dk.src === "speed" ? ["#FF9B3D", "#7A2E12"] : ["#38D3B5", "#123C5A"]) : ["#7C5CFF", "#2A1B6B"];
  const tap = useRef({ t: 0, x: 0, y: 0, timer: null });
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(!!sess.seen[post.key]);
  const tapHandler = useRef(null);

  useEffect(() => {
    if (!active) return;
    if (!sess.seen[post.key]) { sess.seen[post.key] = 1; setSeen(true); }
    if (voice && c && (post.kind === "intro" || (post.kind === "fact" && post.fact === "term"))) {
      const t = setTimeout(() => speak(post.kind === "intro" ? c.ne : (c.t[0] || [])[0]), 650);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [active]); // eslint-disable-line

  const onPointerUp = (e) => {
    setPaused(false);
    if (e.target.closest("button, input, a, .no-dbl, .lab-slider, [role=slider]")) return;
    const T = tap.current, t = Date.now();
    if (t - T.t < 300 && Math.hypot(e.clientX - T.x, e.clientY - T.y) < 40) {
      clearTimeout(T.timer); T.t = 0;
      onLike(post, e.clientX, e.clientY);
      return;
    }
    T.t = t; T.x = e.clientX; T.y = e.clientY;
    const x = e.clientX, w = e.currentTarget.clientWidth;
    clearTimeout(T.timer);
    T.timer = setTimeout(() => { tapHandler.current && tapHandler.current(x < w * 0.33 ? -1 : 1); }, 240);
  };

  // her gönderi farklı görünsün: ışık lekelerinin yeri ve vurgu rengi gönderiye göre değişir
  const sd = post.seed || 1;
  const accent = { intro: "#F2B01E", quiz: "#6B4FE0", chest: "#F2B01E", legend: "#C98A00", goal: "#0E9F6E", drill: dk && dk.src === "speed" ? "#FFB020" : "#6B4FE0" }[post.kind]
    || (post.fact === "trap" ? "#E5533D" : post.fact === "term" ? "#2D6FE0" : post.fact === "hook" ? "#E08A1E" : "#2D9FE0");
  const style = { "--c1": planet[0], "--c2": planet[1], "--c3": accent, "--bx": `${(sd % 37) - 18}vmax`, "--by": `${((sd >> 5) % 31) - 15}vmax`, "--rot": `${sd % 360}deg` };
  const cls = "reel" + (active ? " on" : "") + (seen ? " seen" : "") + (paused ? " paused" : "") + ` k-${post.kind}`;
  let body, caption = null;
  const ctx = { post, c, u, active, result, onAnswer, onDrill, state, tapHandler, paused, onKnown, onLab, left, goNext, act, addFx };
  switch (post.kind) {
    case "intro": body = <IntroBody {...ctx} />; caption = c.use || c.k || c.n; break;
    case "fact": body = <FactBody {...ctx} />; caption = post.fact === "use" || post.fact === "cond" ? null : c.use || c.k; break;
    case "quiz": body = <QuizBody {...ctx} />; caption = result ? (result.ok ? "Süper! Kaydırmaya devam ⤵" : c.w) : "Kaydırmadan önce cevapla 👀"; break;
    case "drill": body = <DrillBody {...ctx} />; break;
    case "chest": body = <ChestBody {...ctx} />; break;
    case "legend": body = <LegendBody {...ctx} />; break;
    case "goal": body = <GoalBody {...ctx} />; break;
    default: body = <EmptyBody {...ctx} />;
  }

  return (
    <section className={cls} style={style} aria-roledescription="gönderi" aria-label={c ? plain(c.n) : post.kind}
      onPointerDown={() => setPaused(true)} onPointerUp={onPointerUp} onPointerCancel={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
      <div className="reel-bg" aria-hidden="true"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="stars" /><i className="vignette" /></div>
      <div className="reel-inner">
        <div className="reel-body">{body}</div>
        {c && (
          <aside className="rail">
            <div className={"rail-pi" + (result ? (result.ok ? " happy" : " sad") : "")}>
              <Pi mood={result ? (result.ok ? "party" : "sad") : post.kind === "intro" ? "happy" : "idle"} outfit={state.settings.outfit} size={44} />
            </div>
            <button className={"rail-btn" + (saved ? " on" : "")} onClick={(e) => { act.toggleSave(c.id); if (!saved) { sparkleAt(e.clientX, e.clientY, 10); vibrate(10, state.settings.haptics); } }} aria-pressed={saved} aria-label="Kaydet">
              <span className="ri"><Star size={27} fill={saved ? "currentColor" : "none"} /></span><span className="rl">{saved ? "Kayıtlı" : "Kaydet"}</span>
            </button>
            <button className="rail-btn" onClick={() => act.openCard(c.id)} aria-label="Ayrıntı">
              <span className="ri"><Info size={26} /></span><span className="rl">Detay</span>
            </button>
            {c.lab && LAB_MAP[c.lab] && (
              <button className="rail-btn" onClick={() => onLab(c.lab, c.id)} aria-label="Laboratuvar">
                <span className="ri"><FlaskConical size={25} /></span><span className="rl">Lab</span>
              </button>
            )}
            <button className="rail-btn" onClick={() => speak(post.kind === "fact" && post.fact === "term" ? c.t[0][0] : c.ne)} aria-label="İngilizcesini dinle">
              <span className="ri"><Volume2 size={25} /></span><span className="rl">Dinle</span>
            </button>
            <span className="disc" aria-hidden="true"><i /></span>
          </aside>
        )}
        {dk && (
          <aside className="rail">
            <div className={"rail-pi" + (result ? (result.ok ? " happy" : " sad") : "")}>
              <Pi mood={result ? (result.ok ? "party" : "sad") : "think"} outfit={state.settings.outfit} size={44} />
            </div>
            <div className="rail-lv" aria-label={`Seviye ${post.d.lv}`}>{[1, 2, 3].map((i) => <i key={i} className={i <= post.d.lv ? "on" : ""} />)}<span className="rl">Seviye</span></div>
            <span className="disc" aria-hidden="true"><i /></span>
          </aside>
        )}
        {dk && (
          <footer className="caption">
            <div className="cap-head"><b>pi.formup</b><span className="verified"><Check size={10} strokeWidth={4} /></span><span className="cap-tag">#{dk.src === "speed" ? "İşlemHızı" : "LOGOS"}</span><span className="cap-tag gold">{dk.name}</span></div>
            <div className="cap-text">{result ? (result.ok ? (result.fast ? "Şimşek gibi! Kaydır ⤵" : "Doğru! Bir dahakine daha hızlı ⚡") : "Bu türü yakında tekrar göreceksin.") : "Hızlı ol: süre dolmadan cevapla ⏱"}</div>
            <div className="cap-music"><span className="note">♪</span><span className="marquee"><span>İşlem Antrenmanı · {dk.name} · Seviye {post.d.lv} · İşlem Antrenmanı · {dk.name} · Seviye {post.d.lv} ·&nbsp;</span></span></div>
          </footer>
        )}
        {c && (
          <footer className="caption">
            <div className="cap-head"><b>pi.formup</b><span className="verified"><Check size={10} strokeWidth={4} /></span><span className="cap-tag">#{u.tr.replace(/\s+/g, "")}</span>{c.bk && <span className="cap-tag gold">IB {c.bk === "0.0" ? "ön bilgi" : c.bk}</span>}</div>
            {caption && <div className="cap-text"><Rich text={caption} /></div>}
            <div className="cap-music"><span className="note">♪</span><span className="marquee"><span>Formül Evreni · {u.tr} · {u.en} · Formül Evreni · {u.tr} · {u.en} ·&nbsp;</span></span></div>
          </footer>
        )}
      </div>
    </section>
  );
}

/* ---------- tanıtım: hikâye gibi adım adım ---------- */
function IntroBody({ c, active, tapHandler, paused, post, onKnown, left, state }) {
  const steps = useMemo(() => {
    const s = ["name", "formula"];
    if (c.use || c.usee) s.push("use"); else if (c.k || c.ke) s.push("cond");
    if (c.h) s.push("hook");
    return s;
  }, [c.id]); // eslint-disable-line
  const [step, setStep] = useState(post.storyDone ? steps.length - 1 : 0);
  const DUR = 2600;
  const clock = useRef({ start: 0, spent: 0 });
  useEffect(() => { if (!active) return; tapHandler.current = (d) => setStep((x) => Math.max(0, Math.min(steps.length - 1, x + d))); }, [active, steps.length]); // eslint-disable-line
  useEffect(() => { clock.current.spent = 0; if (step >= steps.length - 1) post.storyDone = true; }, [step]); // eslint-disable-line
  // basılı tutunca durur, bırakınca kaldığı yerden devam eder (hikâye gibi)
  useEffect(() => {
    if (!active || step >= steps.length - 1) return undefined;
    if (paused) { clock.current.spent += performance.now() - clock.current.start; return undefined; }
    clock.current.start = performance.now();
    const t = setTimeout(() => setStep((x) => x + 1), Math.max(0, DUR - clock.current.spent));
    return () => clearTimeout(t);
  }, [active, paused, step, steps.length]);
  const on = (k) => steps.indexOf(k) > -1 && steps.indexOf(k) <= step;
  const done = step >= steps.length - 1;
  return (
    <div className="post intro">
      <div className="story-bars" aria-hidden="true">
        {steps.map((s, i) => <i key={s} className={i < step ? "full" : i === step && active ? "run" : ""} style={{ "--dur": `${DUR}ms` }} />)}
      </div>
      <div className="p-chip rv" style={{ "--i": 0 }}><Sparkles size={14} /> Yeni formül <span lang="en">New formula</span></div>
      <h2 className="p-title rv" style={{ "--i": 1 }}><Rich text={c.n} /></h2>
      <div className="p-sub rv" lang="en" style={{ "--i": 2 }}><Rich text={c.ne} /></div>
      <div className={"p-formula wipe" + (on("formula") ? " go" : "")}>
        <div className="glass"><Formula f={c} size="auto" /></div>
      </div>
      <div className={"p-text stp" + (on("use") || on("cond") ? " go" : "")}>
        {on("use") && <><Words text={c.use} /><div className="p-en" lang="en"><Words text={c.usee} d0={400} /></div></>}
        {on("cond") && <><Words text={c.k} /><div className="p-en" lang="en"><Words text={c.ke} d0={400} /></div></>}
      </div>
      {c.h && <div className={"p-hook stp" + (on("hook") ? " go" : "")}><span className="hl"><Rich text={c.h} /></span></div>}
      <div className={"p-actions stp" + (done ? " go" : "")}>
        <button className="pill-btn" onClick={() => onKnown(post)}><Zap size={15} /> Zaten biliyorum</button>
        <span className="p-later">Birazdan soracağım <span lang="en">· quiz soon</span></span>
      </div>
      {left <= 0 && <div className="p-cap-note">Bugünlük {FEED_NEW_CAP} yeni formül kotası doldu; yeni formüller yarın.</div>}
    </div>
  );
}

/* ---------- bilgi gönderileri ---------- */
function FactBody({ c, post, active, onLab, tapHandler }) {
  const k = post.fact;
  const [lbl, lblEn, emo] = FACT_LABEL[k] || FACT_LABEL.formula;
  const head = (
    <>
      <div className="p-chip rv" style={{ "--i": 0 }}><span className="emo">{emo}</span> {lbl} <span lang="en">{lblEn}</span></div>
      <div className="p-name rv" style={{ "--i": 1 }}><Rich text={c.n} /> <span lang="en" className="p-name-en">· <Rich text={c.ne} /></span></div>
    </>
  );
  if (k === "trap") return <TrapFact c={c} head={head} active={active} />;
  if (k === "term") return <TermFact c={c} head={head} active={active} tapHandler={tapHandler} />;
  const map = { use: [c.use, c.usee], cond: [c.k, c.ke], why: [c.w, c.we], example: [c.e, null], story: [c.s, null] };
  return (
    <div className={`post fact f-${k}`}>
      {head}
      <div className="p-formula wipe go small"><div className="glass"><Formula f={c} size="auto" /></div></div>
      {map[k] && (
        <div className="p-text big">
          <Words text={map[k][0]} d0={250} />
          {map[k][1] && <div className="p-en" lang="en"><Words text={map[k][1]} d0={700} /></div>}
        </div>
      )}
      {k === "hook" && <div className="p-hook go big rv" style={{ "--i": 3 }}><span className="hl"><Rich text={c.h} /></span></div>}
      {k === "formula" && (
        <div className="p-text">
          {(c.k || c.ke) && <><Words text={c.k} d0={250} /><div className="p-en" lang="en"><Words text={c.ke} d0={600} /></div></>}
          {post.recap && <div className="p-recap rv" style={{ "--i": 5 }}>Bir dahaki soruda bu var 😉 <span lang="en">This one is coming back</span></div>}
        </div>
      )}
      {k === "calc" && (
        <div className="p-calc rv no-dbl" style={{ "--i": 3 }}><LiveCalc card={c} /></div>
      )}
      {k === "lab" && (
        <button className="p-lab rv" style={{ "--i": 3 }} onClick={() => onLab(c.lab, c.id)}>
          <span className="p-lab-ic"><FlaskConical size={34} /></span>
          <span><b>Laboratuvarı aç</b><small lang="en">Open the interactive lab</small></span>
        </button>
      )}
    </div>
  );
}

function TrapFact({ c, head, active }) {
  const wrong = useMemo(() => pick(c.x.filter((x) => !x.startsWith("~")).concat(c.x[0]), Math.random), [c.id]); // eslint-disable-line
  return (
    <div className="post fact f-trap">
      {head}
      <div className="trap-row bad rv" style={{ "--i": 2 }}>
        <div className="glass"><Formula f={c} rhs={wrong} size="auto" /></div>
        <span className="strike" /><span className="stamp no"><X size={16} strokeWidth={3} /> YANLIŞ</span>
      </div>
      <div className="trap-row good rv" style={{ "--i": 4 }}>
        <div className="glass"><Formula f={c} size="auto" /></div>
        <span className="stamp yes"><Check size={16} strokeWidth={3} /> DOĞRU</span>
      </div>
      {(c.w || c.we) && <div className="p-text"><Words text={c.w} d0={1500} /><div className="p-en" lang="en"><Words text={c.we} d0={1900} /></div></div>}
    </div>
  );
}

function TermFact({ c, head, active, tapHandler }) {
  const [en, tr] = useMemo(() => pick(c.t, Math.random), [c.id]); // eslint-disable-line
  const [flip, setFlip] = useState(false);
  useEffect(() => { if (active) tapHandler.current = () => setFlip((f) => !f); }, [active]); // eslint-disable-line
  useEffect(() => { if (!active) return undefined; const t = setTimeout(() => setFlip(true), 2600); return () => clearTimeout(t); }, [active]);
  return (
    <div className="post fact f-term">
      {head}
      <div className={"term-card rv" + (flip ? " flipped" : "")} style={{ "--i": 2 }}>
        <div className="tface front"><small>English</small><b lang="en"><Rich text={en} /></b><span className="tap">Dokun, çevir · tap to flip</span></div>
        <div className="tface back"><small>Türkçesi</small><b><Rich text={tr} /></b><span className="tap" lang="en"><Rich text={en} /></span></div>
      </div>
      <div className="p-formula wipe go small"><div className="glass"><Formula f={c} size="auto" /></div></div>
    </div>
  );
}

/* ---------- soru gönderileri ---------- */
function QuizBody({ c, post, result, onAnswer, active, state }) {
  const r = useMemo(() => rng(post.seed), [post.key]); // eslint-disable-line
  const [lbl, lblEn, emo] = PURPOSE[post.purpose] || PURPOSE.practice;
  let mode = post.mode;
  if (mode === "apply" && !(c.g && GEN[c.g])) mode = "mc";
  if ((mode === "mc" || mode === "tf") && !(c.x && c.x.length)) mode = "name";
  if (mode === "cloze" && !(c.b && c.b.blanks.length)) mode = "name";
  if (mode === "which" && !c.q) mode = "name";
  const P = { ...post, mode };
  const head = (
    <>
      <div className={"p-chip rv q-" + post.purpose} style={{ "--i": 0 }}><span className="emo">{emo}</span> {lbl} <span lang="en">{lblEn}</span></div>
    </>
  );
  return (
    <div className={"post quiz m-" + mode + (result ? (result.ok ? " was-ok" : " was-bad") : "")}>
      {head}
      {mode === "mc" && <ChoiceQuiz c={c} post={P} result={result} onAnswer={onAnswer} r={r}
        q={<><div className="p-name rv" style={{ "--i": 1 }}><Rich text={c.n} /></div><div className="p-formula go"><div className="glass"><Formula f={c} hideRhs size="auto" /></div></div></>}
        opts={() => mcOptions(c, r).map((o) => ({ ok: o.ok, node: <Field v={o.v} /> }))} />}
      {mode === "name" && <ChoiceQuiz c={c} post={P} result={result} onAnswer={onAnswer} r={r}
        q={<><div className="p-ask rv" style={{ "--i": 1 }}>Bu hangi formül? <span lang="en">Name it</span></div><div className="p-formula go"><div className="glass"><Formula f={c} size="auto" /></div></div></>}
        opts={() => nameOptions(c, r).map((o) => ({ ok: o.ok, node: <Bi tr={o.c.n} en={o.c.ne} /> }))} />}
      {mode === "which" && <ChoiceQuiz c={c} post={P} result={result} onAnswer={onAnswer} r={r}
        q={<div className="p-scn rv" style={{ "--i": 1 }}><Words text={c.q} /><div className="p-en" lang="en"><Words text={c.qe} d0={300} /></div></div>}
        opts={() => whichOptions(c, r).map((o) => ({ ok: o.ok, node: <Formula f={o.c} size="sm" /> }))} />}
      {mode === "apply" && <ApplyQuiz c={c} post={P} result={result} onAnswer={onAnswer} r={r} />}
      {mode === "tf" && <SwipeTF c={c} post={P} result={result} onAnswer={onAnswer} r={r} active={active} />}
      {mode === "cloze" && <ClozeQuiz c={c} post={P} result={result} onAnswer={onAnswer} r={r} />}
      {result && <Verdict c={c} result={result} mode={mode} />}
    </div>
  );
}

function ChoiceQuiz({ c, post, result, onAnswer, q, opts }) {
  const list = useMemo(opts, [post.key]); // eslint-disable-line
  return (
    <>
      {q}
      <div className="r-opts">
        {list.map((o, i) => {
          const cls = !result ? "" : o.ok ? " right" : result.pick === i ? " wrong" : " dim";
          return (
            <button key={i} className={"r-opt rv" + cls} style={{ "--i": 3 + i }} disabled={!!result}
              onClick={(e) => onAnswer(post, o.ok, e, { pick: i })}>
              <span className="o">{o.node}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ApplyQuiz({ c, post, result, onAnswer, r }) {
  const gen = useMemo(() => GEN[c.g](r), [post.key]); // eslint-disable-line
  const opts = useMemo(() => numericOptions(gen.a, r), [post.key]); // eslint-disable-line
  const show = (v) => String(v).replace(".", ",");
  return (
    <>
      <div className="p-name rv" style={{ "--i": 1 }}><Rich text={c.n} /></div>
      <div className="p-scn rv" style={{ "--i": 2 }}><Words text={gen.q} /><div className="p-en" lang="en"><Words text={gen.qe} d0={350} /></div></div>
      <div className="r-opts grid2">
        {opts.map((o, i) => {
          const cls = !result ? "" : o.ok ? " right" : result.pick === i ? " wrong" : " dim";
          return (
            <button key={i} className={"r-opt num rv" + cls} style={{ "--i": 4 + i }} disabled={!!result} onClick={(e) => onAnswer(post, o.ok, e, { pick: i })}>
              <span className="o">{show(o.v)}{gen.unit ? <small> {gen.unit}</small> : null}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Doğru/yanlış: kartı sağa (doğru) ya da sola (yanlış) fırlat */
function SwipeTF({ c, post, result, onAnswer, r }) {
  const cand = useMemo(() => tfCandidate(c, r), [post.key]); // eslint-disable-line
  const card = useRef(null);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState(0);
  const decide = (v, e) => {
    if (result) return;
    setFly(v ? 1 : -1);
    setTimeout(() => onAnswer(post, v === cand.ok, e, { said: v, trap: !cand.ok && !v }), 180);
  };
  const down = (e) => { if (result) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.on && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my)) { d.on = true; try { card.current.setPointerCapture(e.pointerId); } catch (er) { /* */ } }
    if (d.on) setDx(mx);
  };
  const up = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || !d.on) { setDx(0); return; }
    if (Math.abs(dx) > 90) decide(dx > 0, e); else setDx(0);
  };
  const t = fly ? fly * 520 : dx;
  const shown = result ? (result.said ? 1 : -1) : 0;
  return (
    <>
      <div className="p-ask rv" style={{ "--i": 1 }}>Doğru mu? <span lang="en">True or false?</span></div>
      <div className="swipe-zone no-dbl rv" style={{ "--i": 2 }}>
        <span className={"sz-label left" + (dx < -30 || shown < 0 ? " lit" : "")}><X size={18} strokeWidth={3} /> Yanlış</span>
        <span className={"sz-label right" + (dx > 30 || shown > 0 ? " lit" : "")}>Doğru <Check size={18} strokeWidth={3} /></span>
        <div ref={card} className={"swipe-card" + (fly || result ? " gone" : "")} style={{ transform: result ? `translateX(${shown * 520}px) rotate(${shown * 24}deg)` : `translateX(${t}px) rotate(${t / 18}deg)`, transition: drag.current && drag.current.on ? "none" : undefined, "--tint": dx > 0 ? "var(--mint)" : "var(--coral)", "--tintA": Math.min(1, Math.abs(dx) / 120) }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDx(0); }}>
          <div className="sc-name"><Rich text={c.n} /></div>
          <div className="sc-f"><Formula f={c} rhs={cand.v} size="auto" /></div>
          <div className="sc-hint">← yanlış · doğru →</div>
        </div>
        {result && <div className="swipe-after"><div className="glass"><Formula f={c} size="auto" /></div></div>}
      </div>
      <div className="tf-btns">
        <button className="tf-b no" disabled={!!result} onClick={(e) => decide(false, e)} aria-label="Yanlış"><X size={30} strokeWidth={3} /></button>
        <button className="tf-b yes" disabled={!!result} onClick={(e) => decide(true, e)} aria-label="Doğru"><Check size={30} strokeWidth={3} /></button>
      </div>
    </>
  );
}

function ClozeQuiz({ c, post, result, onAnswer, r }) {
  const bank = useMemo(() => clozeBank(c, r), [post.key]); // eslint-disable-line
  const [fill, setFill] = useState(result ? result.fill || [] : []);
  const blanks = c.b.blanks;
  const res = result && result.marks;
  let bi = 0;
  const skel = c.b.skel.replace(/\[\[(.+?)\]\]/g, () => {
    const i = bi++;
    const token = fill[i] != null ? bank[fill[i]].v : null;
    if (res) return `\\htmlClass{${res[i] ? "blank-ok" : "blank-bad"}}{\\boxed{${token}}}`;
    if (token != null) return `\\boxed{${token}}`;
    return i === fill.length ? "\\htmlClass{blank-on}{\\boxed{\\,?\\,}}" : "\\boxed{\\phantom{0}}";
  });
  const tap = (k, e) => {
    if (result || fill.includes(k)) return;
    const nf = [...fill, k];
    setFill(nf);
    play("tick", true);
    if (nf.length === blanks.length) {
      const marks = nf.map((bk, i) => bank[bk].v.replace(/\s+/g, "") === blanks[i].replace(/\s+/g, ""));
      setTimeout(() => onAnswer(post, marks.every(Boolean), e, { marks, fill: nf }), 260);
    }
  };
  return (
    <>
      <div className="p-name rv" style={{ "--i": 1 }}><Rich text={c.n} /></div>
      <div className="p-formula go"><div className="glass"><span className="formula formula-lg"><Field v={c.l} /><Tex tex={c.o === ":" ? ":" : c.o || "="} /><Tex tex={skel} /></span></div></div>
      <div className="r-bank">
        {bank.map((t, k) => (
          <button key={t.key} className={"r-token rv" + (fill.includes(k) ? " used" : "")} style={{ "--i": 3 + k }} disabled={!!result} onClick={(e) => tap(k, e)}><Tex tex={t.v} /></button>
        ))}
      </div>
      {!result && fill.length > 0 && <button className="r-undo" onClick={() => setFill((f) => f.slice(0, -1))}>Geri al · undo</button>}
    </>
  );
}

function Verdict({ c, result, mode }) {
  const praise = useMemo(() => pick(["Harika!", "Tam isabet!", "Süpersin!", "İşte bu!", "Bravo!"], Math.random), []);
  return (
    <div className={"verdict " + (result.ok ? "ok" : "no")}>
      <div className="v-head">
        {result.ok ? <><Check size={22} strokeWidth={3} /> {praise}</> : <><X size={22} strokeWidth={3} /> Doğrusu bu <span lang="en">· here's the right one</span></>}
        {result.ok && <span className="v-xp">+{result.xp} XP</span>}
      </div>
      {!result.ok && <div className="glass small"><Formula f={c} size="auto" /></div>}
      <div className="v-next"><ChevronDown size={18} /> kaydır</div>
    </div>
  );
}

/* ---------- özel gönderiler ---------- */
function ChestBody({ post, active, act, addFx, state }) {
  const [open, setOpen] = useState(!!post.opened);
  const tapOpen = (e) => {
    if (open) return;
    post.opened = true;
    setOpen(true);
    act.dust(post.amount);
    play("level", state.settings.sound);
    vibrate([10, 40, 10, 40, 20], state.settings.haptics);
    sparkleAt(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, 24);
    addFx(window.innerWidth / 2, window.innerHeight * 0.42, "xp", `+${post.amount} ✦`);
  };
  return (
    <div className="post special chest">
      <div className="p-chip rv" style={{ "--i": 0 }}><Gift size={14} /> Sürpriz <span lang="en">Surprise</span></div>
      <button className={"chest-box" + (open ? " open" : "")} onClick={tapOpen} aria-label="Sandığı aç">
        <span className="lid" /><span className="box" /><span className="glow" />
        {open && Array.from({ length: 8 }, (_, i) => <i key={i} className="coin" style={{ "--a": `${-80 + i * 22}deg`, "--d": `${i * 40}ms` }}>✦</i>)}
      </button>
      <h2 className="p-title rv" style={{ "--i": 2 }}>{open ? `+${post.amount} yıldız tozu!` : "Sandığı aç"}</h2>
      <div className="p-sub rv" lang="en" style={{ "--i": 3 }}>{open ? "Spend it in Pi's wardrobe" : "Tap the chest"}</div>
    </div>
  );
}

function LegendBody({ post }) {
  const k = post.rank;
  const unlocked = post.have >= k.xp;
  return (
    <div className="post special legend">
      <div className="p-chip rv" style={{ "--i": 0 }}>📜 Matematikçi kartı <span lang="en">Legend card</span></div>
      <div className="legend-mono rv" style={{ "--i": 1 }}>{k.mono}</div>
      <h2 className="p-title rv" style={{ "--i": 2 }}>{k.tr}</h2>
      {k.en !== k.tr && <div className="p-sub rv" lang="en" style={{ "--i": 3 }}>{k.en}</div>}
      <div className="p-text big"><Words text={k.who} d0={300} /><div className="p-en" lang="en"><Words text={k.whoEn} d0={800} /></div></div>
      <div className={"legend-lock rv" + (unlocked ? " ok" : "")} style={{ "--i": 6 }}>{unlocked ? "Bu rütbeyi kazandın ✓" : `Rütbe için ${k.xp - post.have} XP daha`}</div>
    </div>
  );
}

function GoalBody({ state }) {
  return (
    <div className="post special goal">
      <div className="rv" style={{ "--i": 0 }}><Pi mood="party" outfit={state.settings.outfit} size={130} /></div>
      <h2 className="p-title rv" style={{ "--i": 1 }}>Günlük hedef tamam!</h2>
      <div className="p-sub rv" lang="en" style={{ "--i": 2 }}>Daily goal done! Keep the streak alive.</div>
      <div className="goal-ring rv" style={{ "--i": 3 }}><Flame size={40} /></div>
    </div>
  );
}

function EmptyBody({ post, state }) {
  const saved = post.reason === "saved";
  return (
    <div className="post special empty-post">
      <div className="rv" style={{ "--i": 0 }}><Pi mood="think" outfit={state.settings.outfit} size={110} /></div>
      <h2 className="p-title rv" style={{ "--i": 1 }}>{saved ? "Henüz kaydın yok" : "Hepsini gördün!"}</h2>
      <div className="p-text rv" style={{ "--i": 2 }}>
        {saved
          ? <>Bir gönderiye <b>çift dokun</b> ya da ★'a bas; burada toplansın. <span lang="en" className="p-en">Double-tap any post to save it.</span></>
          : <>Tüm formüller tanıtıldı. Tekrarlar vakti gelince burada belirecek. <span lang="en" className="p-en">Every formula is introduced.</span></>}
      </div>
      {saved && <div className="rv" style={{ "--i": 3 }}><Bookmark size={36} /></div>}
    </div>
  );
}

/* =====================================================================
   İşlem antrenmanı (LOGOS + hız bankası)
   ===================================================================== */
/** LOGOS ifade ağacı (kesir, üs, kök) */
function Parca({ p }) {
  if (p === null || p === undefined) return null;
  if (typeof p === "string" || typeof p === "number") return <span style={{ whiteSpace: "pre-wrap" }}>{String(p)}</span>;
  if (Array.isArray(p)) return <>{p.map((x, i) => <Parca key={i} p={x} />)}</>;
  if (p.k === "kesir") return <span className="lg-frac"><span><Parca p={p.p} /></span><i /><span><Parca p={p.q} /></span></span>;
  if (p.k === "us") return <span><Parca p={p.t} /><sup className="lg-sup"><Parca p={p.u} /></sup></span>;
  if (p.k === "kok") return <span className="lg-root"><span className="lg-rad">√</span><span className="lg-under"><Parca p={p.i} /></span></span>;
  return null;
}

/** Süre halkası: hedef süre boyunca azalır */
function TimerRing({ sec, running, done }) {
  return (
    <span className={"d-timer run" + (done ? " stop" : "")} style={{ "--sec": `${sec}s` }} aria-label={`Hedef süre ${Math.round(sec)} saniye`}>
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" className="trk" />
        <circle cx="22" cy="22" r="18" className="val" transform="rotate(-90 22 22)" />
      </svg>
      <b>{Math.round(sec)}<small>sn</small></b>
    </span>
  );
}

const short = (t) => String(t).replace(/\\[a-z]+|[{}\s]/g, "").length <= 9;

function DrillBody({ post, active, result, onDrill, state }) {
  const q = post.d;
  const k = SKILL[q.skill];
  const showEn = state.settings.showEn;
  const L = q.L;
  const head = (
    <div className="d-head rv" style={{ "--i": 0 }}>
      <span className={"p-chip d-chip " + q.src}>{q.src === "speed" ? <><Zap size={14} /> İşlem hızı</> : <>🧩 LOGOS · {LG.GOREV_AD[q.task] || "Seç"}</>}</span>
      <TimerRing sec={q.sec} running={active && !result} done={!!result} />
    </div>
  );
  const skillLine = <div className="d-skill rv" style={{ "--i": 1 }}>{k.name}{k.en ? <span lang="en"> · {k.en}</span> : null}</div>;

  if (q.src === "speed") {
    const grid = q.opts.every((o) => short(o.t));
    return (
      <div className="post drill">
        {head}{skillLine}
        <div className={"d-q rv" + (q.q.replace(/\$[^$]*\$/g, "").trim().length > 3 ? " wordy" : "")} style={{ "--i": 2 }}><Rich text={q.q} /></div>
        {showEn && q.qe && q.qe !== q.q && <div className="p-en d-en rv" lang="en" style={{ "--i": 3 }}><Rich text={q.qe} /></div>}
        <div className={"r-opts" + (grid ? " grid2" : "")}>
          {q.opts.map((o, i) => {
            const cls = !result ? "" : o.ok ? " right" : result.pick === i ? " wrong" : " dim";
            return (
              <button key={i} className={"r-opt d-opt rv" + (grid ? " num" : "") + cls} style={{ "--i": 4 + i }} disabled={!!result}
                onClick={(e) => onDrill(post, o.ok, e, { pick: i, why: o.why })}><span className="o"><Tex tex={o.t} /></span></button>
            );
          })}
        </div>
        {result && <DrillVerdict post={post} result={result} />}
      </div>
    );
  }

  if (q.task === "hataAvi") {
    return (
      <div className="post drill">
        {head}{skillLine}
        <div className="d-ins rv" style={{ "--i": 2 }}>Çözümün <b>bir satırı</b> bozuk. Hangisi? <span lang="en">One line is wrong. Which?</span></div>
        <div className="d-q logos small rv" style={{ "--i": 3 }}><Parca p={L.parcalar} /></div>
        <div className="hunt">
          {L.satirlar.map((row, i) => {
            const cls = !result ? "" : i === L.bozukIdx ? " bad" : result.pick === i ? " wrong" : " dim";
            return (
              <button key={i} className={"hunt-row rv" + cls} style={{ "--i": 4 + i }} disabled={!!result}
                onClick={(e) => onDrill(post, i === L.bozukIdx, e, { pick: i, tur: i === L.bozukIdx ? null : "dikkat-denetim" })}>
                <span className="ln">{i + 1}</span>
                <span className="hr-main"><span className="mono">{LG.guzel(row.i)}</span><small>{row.a}</small></span>
              </button>
            );
          })}
        </div>
        {result && <DrillVerdict post={post} result={result} />}
      </div>
    );
  }

  const grid = L.secenekler.every((o) => short(logosTex(o.metin)));
  return (
    <div className="post drill">
      {head}{skillLine}
      <div className="d-ins rv" style={{ "--i": 2 }}>{L.talimat}</div>
      <div className="d-q logos rv" style={{ "--i": 3 }}><Parca p={L.parcalar} /></div>
      <div className={"r-opts" + (grid ? " grid2" : "")}>
        {L.secenekler.map((o, i) => {
          const cls = !result ? "" : o.dogru ? " right" : result.pick === i ? " wrong" : " dim";
          return (
            <button key={i} className={"r-opt d-opt rv" + (grid ? " num" : "") + cls} style={{ "--i": 4 + i }} disabled={!!result}
              onClick={(e) => onDrill(post, !!o.dogru, e, { pick: i, tur: o.dogru ? null : o.tur || "hesap-hatasi" })}><span className="o"><Tex tex={logosTex(o.metin)} /></span></button>
          );
        })}
      </div>
      {result && <DrillVerdict post={post} result={result} />}
    </div>
  );
}

function DrillVerdict({ post, result }) {
  const q = post.d;
  const sec = (result.ms / 1000).toFixed(1).replace(".", ",");
  const tur = result.tur && HATA[result.tur];
  const steps = q.src === "logos" ? (q.L.adimlar || []) : [];
  const right = q.src === "speed" ? q.opts.find((o) => o.ok).t : q.task === "hataAvi" ? null : logosTex(q.L.dogru);
  return (
    <div className={"verdict d-verdict " + (result.ok ? "ok" : "no")}>
      <div className="v-head">
        {result.ok ? <>{result.fast ? <Zap size={20} /> : <Check size={22} strokeWidth={3} />} {result.fast ? "Şimşek!" : "Doğru"} <span className="v-time">{sec} sn</span></>
          : <><X size={22} strokeWidth={3} /> {tur ? tur.ad : result.why || "Olmadı"}</>}
        {result.ok && <span className="v-xp">+{result.xp} XP</span>}
      </div>
      {!result.ok && (tur || result.why) && <div className="v-why">{tur ? tur.aciklama : `Tipik hata: ${result.why}.`}</div>}
      {!result.ok && right && <div className="v-right">Doğrusu: <Tex tex={right} /></div>}
      {!result.ok && q.task === "hataAvi" && <div className="v-right">Bozuk satır: <b>{q.L.bozukIdx + 1}</b></div>}
      {steps.length > 0 && !result.ok && (
        <ol className="d-steps">
          {steps.map((st, i) => <li key={i} style={{ "--i": i }}><span className="mono">{LG.guzel(st.i)}</span><small>{st.a}</small></li>)}
        </ol>
      )}
      <div className="v-next"><ChevronDown size={18} /> kaydır</div>
    </div>
  );
}
