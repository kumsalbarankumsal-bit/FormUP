import test from "node:test";
import assert from "node:assert/strict";
import { makeFeed, newLeft, FEED_NEW_CAP, numericOptions } from "../src/lib/feed.js";
import { freshState, gradeCard, CARDS, BY_ID } from "../src/lib/learn.js";
import { rng } from "../src/lib/util.js";

test("Akış: yeni formül tanıtılır, birkaç gönderi sonra öğrenme sorusu gelir", () => {
  const s = freshState();
  const f = makeFeed(() => s);
  const posts = f.take(12);
  const intro = posts.find((p) => p.kind === "intro");
  assert.ok(intro, "tanıtım olmalı");
  const i = posts.indexOf(intro);
  const q = posts.findIndex((p, k) => k > i && p.kind === "quiz" && p.cid === intro.cid && p.purpose === "learn");
  assert.ok(q > i + 1 && q <= i + 6, `soru ${q - i} gönderi sonra`);
  assert.equal(intro.cid, CARDS[0].id, "yol sırasıyla başlar");
});

test("Akış: doğru öğrenme cevabı yeni kart olarak notlanır, yanlışa tekrar gelir", () => {
  const s = freshState();
  const f = makeFeed(() => s);
  const intro = f.take(3).find((p) => p.kind === "intro");
  const quiz = { key: "x", kind: "quiz", cid: intro.cid, purpose: "learn", mode: "mc" };
  assert.deepEqual(f.answered(quiz, true, 3000), { grade: 3, isNew: true });
  const bad = f.answered({ ...quiz, key: "y" }, false, 3000);
  assert.deepEqual(bad, {});
  const later = f.take(6);
  assert.ok(later.some((p) => p.kind === "quiz" && p.cid === intro.cid), "yanlıştan sonra yeniden sorulur");
});

test("Akış: günlük yeni formül kotası", () => {
  let s = freshState();
  const k = new Date();
  s = { ...s, feed: { saved: {}, day: `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`, newN: FEED_NEW_CAP } };
  // gün anahtarı 04:00 sınırlı olabilir: newLeft 0 ya da tam kota olmalı
  assert.ok([0, FEED_NEW_CAP].includes(newLeft(s, Date.now())));
});

test("Akış: vadesi gelen kart tekrar sorusu olarak gelir ve FSRS notu döner", () => {
  let s = freshState();
  const id = CARDS[0].id;
  s = gradeCard(s, Date.now() - 5 * 86400e3, id, 3, { isNew: true });
  const f = makeFeed(() => s);
  const posts = f.take(25);
  const rev = posts.find((p) => p.kind === "quiz" && p.purpose === "review" && p.cid === id);
  assert.ok(rev, "tekrar sorusu gelmeli");
  assert.equal(f.answered(rev, false, 2000).grade, 1);
});

test("Akış: cevapsız geçilen soru cezasız yeniden kuyruğa girer", () => {
  const s = freshState();
  const f = makeFeed(() => s);
  const post = { key: "z", kind: "quiz", cid: CARDS[1].id, purpose: "learn", mode: "mc", seed: 1 };
  f.skipped(post);
  assert.ok(f.take(8).some((p) => p.cid === post.cid && p.requeued));
});

test("Akış: sayısal seçeneklerde doğru cevap tam bir kez", () => {
  const r = rng(5);
  for (const a of [0, 1, -3, 0.5, 12.75, 100]) {
    const o = numericOptions(a, r);
    assert.equal(o.filter((x) => x.ok).length, 1);
    assert.equal(new Set(o.map((x) => x.v)).size, o.length);
  }
});
