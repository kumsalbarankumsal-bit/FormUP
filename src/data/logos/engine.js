/* LOGOS soru motoru — kaynak: github.com/kumsalbarankumsal-bit/logos (src/App.jsx).
   26 beceri × 3 seviye; sorular cihazda üretilir ve doğrulanır. FormUp Akış'ına taşındı.
   Tek değişiklik: mathjs yerine küçük bir ifade değerlendirici (hesapla) kullanılır.
   Üreteç, doğrulama, hata teşhisi ve görev dönüştürme bölümleri birebir alındı; arayüz kodu alınmadı. */
/* eslint-disable */
import { hesapla } from "./expr.js";

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sec = (a) => a[Math.floor(Math.random() * a.length)];
const isaretli = () => (Math.random() < 0.5 ? 1 : -1);
const sifirsiz = (a, b) => {
  let v = 0;
  while (v === 0) v = rnd(a, b);
  return v;
};
const ebob = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
};
function kesirSade(p, q) {
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = ebob(p, q) || 1;
  return [p / g, q / g];
}
function kesirStr(p, q) {
  const [a, b] = kesirSade(p, q);
  return b === 1 ? String(a) : `${a}/${b}`;
}
const eksi = (s) => String(s).replace(/-/g, "\u2212");

function normalle(s) {
  if (s === null || s === undefined) return "";
  let t = String(s).trim();
  if (!t) return "";
  t = t
    .replace(/\u2212|–|—/g, "-")
    .replace(/×|·|∙/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  // Türkçe ondalık virgülü (1,5) — ama liste virgülünü bozma
  t = t.replace(/(\d),(\d)/g, "$1.$2");
  t = t.replace(/π/g, "pi");
  t = t.replace(/²/g, "^2").replace(/³/g, "^3");
  t = t.replace(/√\s*\(/g, "sqrt(");
  t = t.replace(/√\s*(\d+(?:\.\d+)?)/g, "sqrt($1)");
  t = t.replace(/√\s*([a-zA-Z])/g, "sqrt($1)");
  t = t.replace(/√/g, "sqrt");
  t = t.replace(/\|/g, "");
  // örtük çarpma
  t = t.replace(/(\d)(\()/g, "$1*$2");
  t = t.replace(/\)(\d)/g, ")*$1");
  t = t.replace(/\)\(/g, ")*(");
  t = t.replace(/(\d)(?=[a-zA-Z])(?!qrt)/g, "$1*");
  return t;
}

function degerlendir(ifade, degerler) {
  try {
    const v = hesapla(ifade, degerler || {});
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

function degiskenler(s) {
  const m = String(s).match(/[a-zA-Z]+/g) || [];
  const fonk = ["sqrt", "abs", "pi", "e"];
  const out = new Set();
  m.forEach((w) => {
    if (fonk.includes(w)) return;
    w.split("").forEach((c) => out.add(c));
  });
  return [...out];
}

/** İki ifade cebirsel olarak eşdeğer mi? */
function esdeger(kullanici, dogru) {
  const a = normalle(kullanici);
  const b = normalle(dogru);
  if (!a) return false;
  if (a === b) return true;
  const dv = [...new Set([...degiskenler(a), ...degiskenler(b)])];
  if (dv.length === 0) {
    const va = degerlendir(a);
    const vb = degerlendir(b);
    if (va === null || vb === null) return false;
    return Math.abs(va - vb) < 1e-7;
  }
  if (dv.length > 4) return false;
  let esles = 0;
  for (let i = 0; i < 6; i++) {
    const d = {};
    dv.forEach((v, j) => {
      d[v] = 1.31 + i * 0.87 + j * 0.53;
    });
    const va = degerlendir(a, d);
    const vb = degerlendir(b, d);
    if (va === null || vb === null) return false;
    if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(vb))) return false;
    esles++;
  }
  return esles > 0;
}

/** Çoklu kök: "2, -3" ~ "-3 ve 2" */
function esdegerKume(kullanici, dogru) {
  const parcala = (s) =>
    String(s)
      .split(/[,;]|\bve\b|\bveya\b/gi)
      .map((x) => x.replace(/x\s*=/gi, "").trim())
      .filter(Boolean);
  const A = parcala(kullanici);
  const B = parcala(dogru);
  if (A.length !== B.length) return false;
  const kullanildi = new Array(B.length).fill(false);
  for (const a of A) {
    let bulundu = false;
    for (let j = 0; j < B.length; j++) {
      if (!kullanildi[j] && esdeger(a, B[j])) {
        kullanildi[j] = true;
        bulundu = true;
        break;
      }
    }
    if (!bulundu) return false;
  }
  return true;
}

/** x=..., y=... */
function esdegerSistem(kullanici, dogru) {
  const al = (s, h) => {
    const m = String(s).match(new RegExp(h + "\\s*=\\s*(-?[0-9./\\s]+)", "i"));
    return m ? m[1].trim() : null;
  };
  const kx = al(kullanici, "x");
  const ky = al(kullanici, "y");
  if (kx === null || ky === null) return false;
  return esdeger(kx, al(dogru, "x")) && esdeger(ky, al(dogru, "y"));
}

/** x<3 biçimi */
function esdegerEsitsizlik(kullanici, dogru) {
  const ayir = (s) => {
    const m = String(s).replace(/\s+/g, "").match(/^x(<=|>=|<|>|≤|≥)(.+)$/i);
    if (!m) return null;
    let op = m[1].replace("≤", "<=").replace("≥", ">=");
    return { op, deger: m[2] };
  };
  const A = ayir(kullanici);
  const B = ayir(dogru);
  if (!A || !B) return false;
  return A.op === B.op && esdeger(A.deger, B.deger);
}

/** a<x<b biçimi */
function esdegerAralik(kullanici, dogru) {
  const ayir = (s) => {
    const m = String(s)
      .replace(/\s+/g, "")
      .match(/^(-?[\d./]+)(<=|<|≤)x(<=|<|≤)(-?[\d./]+)$/i);
    return m ? [m[1], m[4]] : null;
  };
  const A = ayir(kullanici);
  const B = ayir(dogru);
  if (!A || !B) return false;
  return esdeger(A[0], B[0]) && esdeger(A[1], B[1]);
}

function cevapDogruMu(kullanici, soru) {
  const g = soru.giris || "sayi";
  const hepsi = [soru.dogru, ...(soru.kabul || [])];
  if (g === "coklu") return hepsi.some((d) => esdegerKume(kullanici, d));
  if (g === "sistem") return hepsi.some((d) => esdegerSistem(kullanici, d));
  if (g === "esitsizlik") return hepsi.some((d) => esdegerEsitsizlik(kullanici, d));
  if (g === "aralik") return hepsi.some((d) => esdegerAralik(kullanici, d));
  const temiz = String(kullanici).replace(/^[a-z]\s*=\s*/i, "");
  return hepsi.some((d) => esdeger(temiz, String(d).replace(/^[a-z]\s*=\s*/i, "")));
}

/* ---------- Soldan sağa değerlendirici (işlem önceliği hatası tespiti) ---------- */
function soldanSaga(ifade) {
  try {
    const tk = String(ifade).match(/\d+\.?\d*|[+\-*/()^]/g);
    if (!tk) return null;
    let i = 0;
    const uygula = (a, op, b) => {
      if (op === "+") return a + b;
      if (op === "-") return a - b;
      if (op === "*") return a * b;
      if (op === "/") return b === 0 ? NaN : a / b;
      if (op === "^") return Math.pow(a, b);
      return b;
    };
    function grup() {
      let val = null;
      let op = null;
      while (i < tk.length) {
        const t = tk[i];
        if (t === ")") {
          i++;
          break;
        }
        if (t === "(") {
          i++;
          const v = grup();
          val = val === null ? (op === "-" ? -v : v) : uygula(val, op, v);
          op = null;
        } else if ("+-*/^".includes(t)) {
          op = t;
          i++;
        } else {
          const v = parseFloat(t);
          i++;
          val = val === null ? (op === "-" ? -v : v) : uygula(val, op, v);
          op = null;
        }
      }
      return val;
    }
    const r = grup();
    return typeof r === "number" && isFinite(r) ? r : null;
  } catch (e) {
    return null;
  }
}

/* ---------- Hata türü sözlüğü ---------- */
const HATA_TURU = {
  "islem-onceligi": {
    ad: "İşlem önceliği",
    aciklama: "Soldan sağa gitmişsin. Önce parantez, sonra üs, sonra çarpma-bölme, en son toplama-çıkarma gelir.",
  },
  isaret: {
    ad: "İşaret hatası",
    aciklama: "Sonucun işareti ters. Negatiflerin çarpımı/bölümü ve iki eksinin yan yana gelişini yeniden gözden geçir.",
  },
  dagitma: {
    ad: "Dağıtma hatası",
    aciklama: "Parantezin önündeki işareti içerideki bütün terimlere dağıtmamışsın.",
  },
  "kesir-toplama": {
    ad: "Kesir toplama hatası",
    aciklama: "Payları ve paydaları ayrı ayrı toplamışsın. Önce paydaları eşitlemen gerekir.",
  },
  "us-kurali": {
    ad: "Üs kuralı hatası",
    aciklama: "Aynı tabanlı çarpımda üsler toplanır, çarpılmaz. Üssün üssü alınırken çarpılır.",
  },
  "kok-dagitma": {
    ad: "Kök dağıtma hatası",
    aciklama: "Kök, toplama üzerine dağılmaz. Kök yalnızca çarpım ve bölüm üzerine dağılır.",
  },
  "terim-tasima": {
    ad: "Terim taşıma hatası",
    aciklama: "Terimi eşitliğin karşısına atarken işaretini değiştirmemişsin.",
  },
  "esitsizlik-yonu": {
    ad: "Eşitsizlik yönü",
    aciklama: "Negatif bir sayıyla çarptığında ya da böldüğünde eşitsizliğin yönü değişir.",
  },
  "yanlis-sadelestirme": {
    ad: "Yanlış sadeleştirme",
    aciklama: "Toplama üzerinden sadeleştirme yapılamaz. Yalnızca çarpanlar sadeleşir.",
  },
  ozdeslik: {
    ad: "Özdeşlik hatası",
    aciklama: "Orta terimi atlamışsın. (a+b)² = a² + 2ab + b² — üç terim vardır, iki değil.",
  },
  "dikkat-denetim": {
    ad: "Denetim kaçağı",
    aciklama: "Bozuk satırı bulamadın. Kendi çözümünü de aynı gözle taramıyorsun demektir — hatanın asıl kaynağı burası.",
  },
  "hesap-hatasi": {
    ad: "Hesap hatası",
    aciklama: "Yöntem doğru görünüyor, aritmetikte kaymışsın. Adımları yavaşlatıp tekrar dene.",
  },
};

function hatayiTeshis(kullanici, soru) {
  const tuz = soru.tuzaklar || {};
  for (const tur of Object.keys(tuz)) {
    const d = tuz[tur];
    if (d === null || d === undefined) continue;
    try {
      if (soru.giris === "coklu" ? esdegerKume(kullanici, d) : esdeger(kullanici, d)) return tur;
    } catch (e) {
      /* yoksay */
    }
  }
  return "hesap-hatasi";
}

const mk = (o) => {
  const q = { giris: "sayi", kabul: [], tuzaklar: {}, adimlar: [], ipuclari: [], ...o };
  // Dejenere tuzakları ayıkla: doğru cevapla çakışan bir tuzak teşhis üretemez.
  const temiz = {};
  Object.keys(q.tuzaklar || {}).forEach((k) => {
    const t = q.tuzaklar[k];
    if (t === null || t === undefined) return;
    try {
      if (cevapDogruMu(String(t), q)) return;
    } catch (e) {
      /* yoksay */
    }
    temiz[k] = t;
  });
  q.tuzaklar = temiz;
  return q;
};

/* ---- Kademe 0 ---- */
function g_t0_1(sv) {
  if (sv === 1) {
    const a = rnd(4, 45), b = rnd(4, 45), op = sec(["+", "-"]);
    const d = op === "+" ? a + b : a - b;
    return mk({
      parcalar: [`${a} ${op === "+" ? "+" : "−"} ${b}`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { isaret: String(-d) },
      adimlar: [{ i: `${a} ${op} ${b}`, a: "Doğrudan işlem." }, { i: String(d), a: "Sonuç." }],
      ipuclari: ["Sayı doğrusunda düşün: sağa mı gidiyorsun, sola mı?", "Aynı işaretliler toplanır; ters işaretlilerde büyükten küçük çıkarılır.", `${a} sayısından başla.`],
    });
  }
  if (sv === 2) {
    const a = sifirsiz(-30, 30), b = sifirsiz(-30, 30), c = rnd(4, 25);
    const d = a + b - c;
    return mk({
      parcalar: [`(${eksi(a)}) + (${eksi(b)}) − ${c}`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { isaret: String(-d) },
      adimlar: [
        { i: `(${eksi(a)}) + (${eksi(b)}) = ${eksi(a + b)}`, a: "İlk iki terimi topla." },
        { i: `${eksi(a + b)} − ${c} = ${eksi(d)}`, a: "Son terimi çıkar." },
      ],
      ipuclari: ["Parantezleri kaldırıp tek satır hâline getir.", "Pozitifleri kendi arasında, negatifleri kendi arasında topla.", `Önce (${eksi(a)}) + (${eksi(b)}) hesapla.`],
    });
  }
  const a = rnd(5, 40), b = rnd(3, 25), c = rnd(3, 25), d0 = rnd(3, 25);
  const d = a + b - c - d0;
  return mk({
    parcalar: [`${a} − (−${b}) + (−${c}) − ${d0}`],
    talimat: "Sonucu bul.",
    dogru: String(d),
    tuzaklar: { isaret: String(a - b - c - d0) },
    adimlar: [
      { i: `${a} + ${b} − ${c} − ${d0}`, a: "İki eksi artıya döner: −(−b) = +b." },
      { i: String(d), a: "Soldan sağa topla-çıkar." },
    ],
    ipuclari: ["Önce çift işaretleri sadeleştir.", "−(−b) ifadesi +b olur.", `İfade ${a} + ${b} − ${c} − ${d0} hâline gelir.`],
  });
}

function g_t0_2(sv) {
  if (sv === 1) {
    const a = rnd(3, 12) * isaretli(), b = rnd(3, 12) * isaretli();
    const d = a * b;
    return mk({
      parcalar: [`(${eksi(a)}) × (${eksi(b)})`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { isaret: String(-d) },
      adimlar: [{ i: `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(d)}`, a: "Önce mutlak değerleri çarp." }, { i: eksi(d), a: d < 0 ? "Ters işaretliler → sonuç negatif." : "Aynı işaretliler → sonuç pozitif." }],
      ipuclari: ["İşaretleri ayrı, sayıları ayrı düşün.", "Aynı işaret → pozitif; ters işaret → negatif.", `${Math.abs(a)} × ${Math.abs(b)} kaç eder?`],
    });
  }
  if (sv === 2) {
    const b = rnd(2, 9), c = rnd(2, 9), a = b * c * rnd(2, 6) * isaretli();
    const d = (a / b) * c * -1;
    return mk({
      parcalar: [`(${eksi(a)}) ÷ ${b} × (−${c})`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { isaret: String(-d) },
      adimlar: [{ i: `${eksi(a)} ÷ ${b} = ${eksi(a / b)}`, a: "Soldan sağa: önce bölme." }, { i: `${eksi(a / b)} × (−${c}) = ${eksi(d)}`, a: "Sonra çarpma." }],
      ipuclari: ["Çarpma ve bölme eşit önceliktedir; soldan sağa yürü.", "Kaç tane eksi var? Çift sayıda eksi → pozitif.", `Önce ${eksi(a)} ÷ ${b} hesapla.`],
    });
  }
  const b = rnd(2, 6), c = rnd(2, 8), e = rnd(2, 5), a = b * rnd(2, 5) * isaretli();
  return mk({
    parcalar: [`(${eksi(a)}) ÷ (−${b}) × (−${c}) × (−${e})`],
    talimat: "Sonucu bul.",
    dogru: String((a / -b) * -c * -e),
    tuzaklar: { isaret: String(-((a / -b) * -c * -e)) },
    adimlar: [
      { i: `Eksi sayısını say`, a: "Çarpım-bölümde eksilerin sayısı tekse sonuç negatif, çiftse pozitif." },
      { i: `${Math.abs(a)} ÷ ${b} × ${c} × ${e} = ${Math.abs((a / -b) * -c * -e)}`, a: "Mutlak değerlerle işlem yap, işareti sonda koy." },
    ],
    ipuclari: ["Önce işareti belirle, sonra sayıları çarp.", "Kaç tane negatif var?", "Tek sayıda negatif → sonuç negatif."],
  });
}

function g_t0_3(sv) {
  for (let d0 = 0; d0 < 120; d0++) {
    if (sv === 1) {
      const a = rnd(3, 40), b = rnd(2, 12), c = rnd(2, 9), op = sec(["+", "-"]);
      const ifade = `${a} ${op} ${b}*${c}`;
      const d = op === "+" ? a + b * c : a - b * c;
      const trap = op === "+" ? (a + b) * c : (a - b) * c;
      return mk({
        parcalar: [`${a} ${op === "+" ? "+" : "−"} ${b} × ${c}`],
        talimat: "Sonucu bul.",
        dogru: String(d),
        tuzaklar: { "islem-onceligi": String(trap) },
        adimlar: [{ i: `${b} × ${c} = ${b * c}`, a: "Önce çarpma." }, { i: `${a} ${op} ${b * c} = ${eksi(d)}`, a: "Sonra toplama/çıkarma." }],
        ipuclari: ["Hangi işlem önce gelir?", "Çarpma her zaman toplama-çıkarmadan önce yapılır.", `Önce ${b} × ${c} hesapla.`],
      });
    }
    if (sv === 2) {
      const a = rnd(15, 60), b = rnd(2, 9), c = rnd(2, 9), e = sec([2, 3, 4, 5]), f = e * rnd(2, 9);
      const ifade = `${a} - ${b}*${c} + ${f}/${e}`;
      const d = a - b * c + f / e;
      if (!Number.isInteger(d)) continue;
      const trap = soldanSaga(ifade);
      return mk({
        parcalar: [`${a} − ${b} × ${c} + ${f} ÷ ${e}`],
        talimat: "Sonucu bul.",
        dogru: String(d),
        tuzaklar: { "islem-onceligi": trap === null ? null : String(trap) },
        adimlar: [
          { i: `${b} × ${c} = ${b * c},  ${f} ÷ ${e} = ${f / e}`, a: "Önce çarpma ve bölmeyi bitir." },
          { i: `${a} − ${b * c} + ${f / e} = ${eksi(d)}`, a: "Kalan toplama-çıkarmayı soldan sağa yap." },
        ],
        ipuclari: ["Çarpma ve bölme, toplama ve çıkarmadan önce gelir.", "İki ayrı işlemi önce ayrı ayrı bitir.", `${b} × ${c} ve ${f} ÷ ${e} sonuçlarını bul.`],
      });
    }
    const tip = sec(["us", "iceparantez"]);
    if (tip === "us") {
      const a = rnd(5, 40), b = rnd(2, 6), c = rnd(3, 9), dd = rnd(2, 5), e = rnd(2, 20);
      const ifade = `${a} + ${b}*(${c} - ${dd})^2 - ${e}`;
      const d = a + b * Math.pow(c - dd, 2) - e;
      const trap = soldanSaga(ifade);
      if (trap === d) continue;
      return mk({
        parcalar: [`${a} + ${b} × `, { k: "us", t: `(${c} − ${dd})`, u: "2" }, ` − ${e}`],
        talimat: "Sonucu bul.",
        dogru: String(d),
        tuzaklar: { "islem-onceligi": trap === null ? null : String(trap) },
        adimlar: [
          { i: `${c} − ${dd} = ${c - dd}`, a: "En içteki parantez." },
          { i: `${c - dd}² = ${Math.pow(c - dd, 2)}`, a: "Sonra üs." },
          { i: `${b} × ${Math.pow(c - dd, 2)} = ${b * Math.pow(c - dd, 2)}`, a: "Sonra çarpma." },
          { i: `${a} + ${b * Math.pow(c - dd, 2)} − ${e} = ${eksi(d)}`, a: "En son toplama-çıkarma." },
        ],
        ipuclari: ["Sıra: parantez → üs → çarpma/bölme → toplama/çıkarma.", "En içteki parantezden başla.", `Önce ${c} − ${dd} hesapla, sonra karesini al.`],
      });
    }
    const a = rnd(20, 70), b = rnd(2, 8), c = rnd(2, 9), dd = rnd(2, 9), e = sec([2, 3, 4]), f = e * rnd(2, 8);
    const ifade = `${a} - (${b} + ${c})*${dd} + ${f}/${e}`;
    const d = a - (b + c) * dd + f / e;
    if (!Number.isInteger(d)) continue;
    const trap = soldanSaga(ifade);
    if (trap === d) continue;
    return mk({
      parcalar: [`${a} − (${b} + ${c}) × ${dd} + ${f} ÷ ${e}`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { "islem-onceligi": trap === null ? null : String(trap) },
      adimlar: [
        { i: `${b} + ${c} = ${b + c}`, a: "Parantez içi." },
        { i: `${b + c} × ${dd} = ${(b + c) * dd},  ${f} ÷ ${e} = ${f / e}`, a: "Çarpma ve bölme." },
        { i: `${a} − ${(b + c) * dd} + ${f / e} = ${eksi(d)}`, a: "Toplama-çıkarma." },
      ],
      ipuclari: ["Parantez her şeyden önce gelir.", "Parantezi bitirdikten sonra çarpma-bölmeye geç.", `Önce ${b} + ${c} hesapla.`],
    });
  }
  return g_t0_3(1);
}

function g_t0_4(sv) {
  if (sv === 1) {
    const k = rnd(2, 9), b = sifirsiz(-9, 9), a = rnd(2, 6);
    return mk({
      giris: "cebir",
      parcalar: [`${k}(${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)})`],
      talimat: "Parantezi aç ve sadeleştir.",
      dogru: `${k * a}*x + ${k * b}`,
      tuzaklar: { dagitma: `${k * a}*x + ${b}` },
      adimlar: [{ i: `${k}·${a}x = ${k * a}x`, a: "Katsayıyı ilk terime dağıt." }, { i: `${k}·(${b}) = ${k * b}`, a: "Aynı katsayıyı ikinci terime de dağıt." }],
      ipuclari: ["Dışarıdaki sayı içerideki HER terimle çarpılır.", "İkinci terimi unutma.", `${k} × ${a}x kaçtır?`],
    });
  }
  if (sv === 2) {
    const a = rnd(2, 7), b = sifirsiz(-9, 9), c = rnd(2, 7), d = sifirsiz(-9, 9);
    const px = a * 1 - c * 1, sb = a * b - c * d;
    return mk({
      giris: "cebir",
      parcalar: [`${a}(x ${b > 0 ? "+" : "−"} ${Math.abs(b)}) − ${c}(x ${d > 0 ? "+" : "−"} ${Math.abs(d)})`],
      talimat: "Parantezleri aç ve sadeleştir.",
      dogru: `${px}*x + ${sb}`,
      tuzaklar: { dagitma: `${px}*x + ${a * b + c * d}` },
      adimlar: [
        { i: `${a}x ${b >= 0 ? "+" : "−"} ${Math.abs(a * b)}`, a: "İlk parantezi aç." },
        { i: `−${c}x ${-c * d >= 0 ? "+" : "−"} ${Math.abs(c * d)}`, a: "İkinci parantezde eksi işareti İÇERİDEKİ HER terimi etkiler." },
        { i: `${px}x ${sb >= 0 ? "+" : "−"} ${Math.abs(sb)}`, a: "Benzer terimleri topla." },
      ],
      ipuclari: ["İkinci parantezin önünde eksi var; bu eksiyi iki terime de dağıt.", "Önce iki parantezi ayrı ayrı aç, sonra benzerleri topla.", `−${c} × (${d}) kaçtır? İşaretine dikkat.`],
    });
  }
  const a = rnd(2, 6), b = rnd(2, 9), c = rnd(2, 9), d = rnd(2, 6), e = rnd(2, 9);
  const px = -a * 2 - 1 + d, sb = a * b - c + -d * e;
  return mk({
    giris: "cebir",
    parcalar: [`−${a}(2x − ${b}) − (x + ${c}) + ${d}(x − ${e})`],
    talimat: "Parantezleri aç ve sadeleştir.",
    dogru: `${px}*x + ${sb}`,
    tuzaklar: { dagitma: `${px}*x + ${-a * b - c - d * e}` },
    adimlar: [
      { i: `−${2 * a}x + ${a * b}`, a: "Birinci parantez: eksi içerideki iki terimi de çevirir." },
      { i: `−x − ${c}`, a: "İkinci parantezin önündeki eksi de her terime dağılır." },
      { i: `${d}x − ${d * e}`, a: "Üçüncü parantezi aç." },
      { i: `${px}x ${sb >= 0 ? "+" : "−"} ${Math.abs(sb)}`, a: "Benzer terimleri topla." },
    ],
    ipuclari: ["Üç parantezi tek tek aç, acele etme.", "Parantez önündeki eksi, içerideki bütün terimlerin işaretini çevirir.", "x'li terimleri ve sabitleri ayrı ayrı topla."],
  });
}

function g_t0_5(sv) {
  if (sv === 1) {
    const g = sec([4, 6, 7, 8, 9, 12]), p = g * rnd(2, 9), q = g * rnd(2, 9);
    if (p === q) return g_t0_5(1);
    return mk({
      parcalar: [{ k: "kesir", p: String(p), q: String(q) }],
      talimat: "Kesri sadeleştir.",
      dogru: kesirStr(p, q),
      tuzaklar: { "yanlis-sadelestirme": kesirStr(p - g, q - g) },
      adimlar: [{ i: `EBOB(${p}, ${q}) = ${ebob(p, q)}`, a: "Pay ve paydanın ortak bölenini bul." }, { i: kesirStr(p, q), a: "İkisini de bu sayıya böl." }],
      ipuclari: ["Pay ve paydayı aynı sayıya bölebilir misin?", "En büyük ortak böleni bul.", `${p} ve ${q} kaça bölünür?`],
    });
  }
  if (sv === 2) {
    const k = sec([2, 3, 4, 5, 6]), a = rnd(2, 8), b = rnd(2, 9);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "kesir", p: `${k * a}x + ${k * b}`, q: String(k) }],
      talimat: "Sadeleştir.",
      dogru: `${a}*x + ${b}`,
      tuzaklar: { "yanlis-sadelestirme": `${a}*x + ${k * b}` },
      adimlar: [{ i: `${k}(${a}x + ${b})`, a: "Payda ortak çarpanı parantezine al." }, { i: `${a}x + ${b}`, a: "Ortak çarpan paydayla sadeleşir." }],
      ipuclari: ["Paydaki HER terim paydaya bölünmeli.", "Payı önce çarpanlarına ayır.", `Pay = ${k}(${a}x + ${b})`],
    });
  }
  const a = rnd(2, 9);
  return mk({
    giris: "cebir",
    parcalar: [{ k: "kesir", p: [{ k: "us", t: "x", u: "2" }, ` − ${a * a}`], q: `x + ${a}` }],
    talimat: "Sadeleştir.",
    dogru: `x - ${a}`,
    tuzaklar: { "yanlis-sadelestirme": `x - ${a * a}` },
    adimlar: [{ i: `(x − ${a})(x + ${a})`, a: "Pay iki kare farkıdır." }, { i: `x − ${a}`, a: `(x + ${a}) çarpanı sadeleşir.` }],
    ipuclari: ["Payı çarpanlarına ayırmadan sadeleştirme yapılamaz.", "x² − a² = (x − a)(x + a)", `Pay = (x − ${a})(x + ${a})`],
  });
}

/* ---- Kademe 1 ---- */
function g_t1_1(sv) {
  if (sv === 1) {
    const b = sec([2, 3, 4, 5, 6, 8]), d = sec([2, 3, 4, 5, 6, 8]);
    const a = rnd(1, b * 2 - 1), c = rnd(1, d * 2 - 1), op = sec(["+", "-"]);
    const p = op === "+" ? a * d + c * b : a * d - c * b, q = b * d;
    return mk({
      parcalar: [{ k: "kesir", p: String(a), q: String(b) }, ` ${op === "+" ? "+" : "−"} `, { k: "kesir", p: String(c), q: String(d) }],
      talimat: "Sonucu sadeleştirilmiş kesir olarak yaz.",
      dogru: kesirStr(p, q),
      tuzaklar: { "kesir-toplama": b === d ? null : kesirStr(op === "+" ? a + c : a - c, op === "+" ? b + d : b - d || 1) },
      adimlar: [{ i: `Payda = ${b * d}`, a: "Paydaları eşitle." }, { i: `${a * d} ${op} ${c * b} = ${p}`, a: "Payları işle." }, { i: kesirStr(p, q), a: "Sadeleştir." }],
      ipuclari: ["Paydalar eşit değilse doğrudan toplayamazsın.", "Ortak payda bul, payları ona göre genişlet.", `Ortak payda ${b * d} olabilir.`],
    });
  }
  if (sv === 2) {
    const b = sec([3, 4, 5, 6]), d = sec([2, 3, 4, 8]);
    const a = rnd(1, 9) * isaretli(), c = rnd(1, 9);
    const op = sec(["*", "/"]);
    const p = op === "*" ? a * c : a * d, q = op === "*" ? b * d : b * c;
    return mk({
      parcalar: [{ k: "kesir", p: eksi(a), q: String(b) }, ` ${op === "*" ? "×" : "÷"} `, { k: "kesir", p: String(c), q: String(d) }],
      talimat: "Sonucu sadeleştirilmiş kesir olarak yaz.",
      dogru: kesirStr(p, q),
      tuzaklar: { isaret: kesirStr(-p, q), "hesap-hatasi": op === "/" ? kesirStr(a * c, b * d) : null },
      adimlar: op === "*"
        ? [{ i: `${a}·${c} / ${b}·${d}`, a: "Pay payla, payda paydayla çarpılır." }, { i: kesirStr(p, q), a: "Sadeleştir." }]
        : [{ i: `${a}/${b} × ${d}/${c}`, a: "Bölmede ikinci kesir ters çevrilir." }, { i: kesirStr(p, q), a: "Çarp ve sadeleştir." }],
      ipuclari: [op === "*" ? "Çarpmada payda eşitlemeye gerek yok." : "Bölmede ne yapılır?", op === "*" ? "Pay × pay, payda × payda." : "İkinci kesri ters çevirip çarp.", "İşareti de takip et."],
    });
  }
  const b = sec([2, 3, 4]), d = sec([3, 5, 6]), e = sec([4, 8, 9]);
  const a = rnd(1, 5), c = rnd(1, 5), f = rnd(1, 7);
  const ort = b * d * e;
  const p = (a * ort) / b - (c * ort) / d + (f * ort) / e;
  return mk({
    parcalar: [{ k: "kesir", p: String(a), q: String(b) }, " − ", { k: "kesir", p: String(c), q: String(d) }, " + ", { k: "kesir", p: String(f), q: String(e) }],
    talimat: "Sonucu sadeleştirilmiş kesir olarak yaz.",
    dogru: kesirStr(p, ort),
    tuzaklar: { "kesir-toplama": kesirStr(a - c + f, b - d + e || 1) },
    adimlar: [{ i: `Ortak payda = ${ort}`, a: "Üç paydanın ortak katı." }, { i: `${(a * ort) / b} − ${(c * ort) / d} + ${(f * ort) / e} = ${p}`, a: "Payları genişletip işle." }, { i: kesirStr(p, ort), a: "Sadeleştir." }],
    ipuclari: ["Üç paydanın ortak katını bul.", "Her kesri o paydaya genişlet.", `Ortak payda ${ort} olabilir.`],
  });
}

function g_t1_2(sv) {
  if (sv === 1) {
    const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(2, 9);
    return mk({
      parcalar: [{ k: "kesir", p: { k: "kesir", p: String(a), q: String(b) }, q: { k: "kesir", p: String(c), q: String(d) } }],
      talimat: "Sadeleştirilmiş kesir olarak yaz.",
      dogru: kesirStr(a * d, b * c),
      tuzaklar: { "hesap-hatasi": kesirStr(a * c, b * d) },
      adimlar: [{ i: `${a}/${b} ÷ ${c}/${d}`, a: "Büyük kesir çizgisi bölme demektir." }, { i: `${a}/${b} × ${d}/${c}`, a: "Alttaki kesri ters çevir, çarp." }, { i: kesirStr(a * d, b * c), a: "Sadeleştir." }],
      ipuclari: ["Uzun kesir çizgisi ne anlama gelir?", "Bölme işlemi: alttakini ters çevir.", `${a}/${b} × ${d}/${c}`],
    });
  }
  if (sv === 2) {
    const b = sec([2, 3, 4, 5]), a = rnd(1, b - 1), c = rnd(2, 6), d = rnd(2, 6);
    const ustP = b + a, ustQ = b;
    return mk({
      parcalar: [{ k: "kesir", p: [`1 + `, { k: "kesir", p: String(a), q: String(b) }], q: { k: "kesir", p: String(c), q: String(d) } }],
      talimat: "Sadeleştirilmiş kesir olarak yaz.",
      dogru: kesirStr(ustP * d, ustQ * c),
      tuzaklar: { "kesir-toplama": kesirStr(1 + a, b) },
      adimlar: [{ i: `1 + ${a}/${b} = ${ustP}/${ustQ}`, a: "Önce payı tek kesir hâline getir." }, { i: `${ustP}/${ustQ} ÷ ${c}/${d}`, a: "Sonra bölmeyi yap." }, { i: kesirStr(ustP * d, ustQ * c), a: "Ters çevir, çarp, sadeleştir." }],
      ipuclari: ["Önce payı tek bir kesre indirge.", "1 = b/b olarak yazılabilir.", `Pay = ${ustP}/${ustQ}`],
    });
  }
  const b = sec([2, 3, 4]), a = rnd(1, 5), c = sec([2, 3, 5]), d = rnd(1, 4);
  const ustP = b * 1 + a, ustQ = b, altP = c * 1 - d, altQ = c;
  if (altP === 0) return g_t1_2(3);
  return mk({
    parcalar: [{ k: "kesir", p: [`1 + `, { k: "kesir", p: String(a), q: String(b) }], q: [`1 − `, { k: "kesir", p: String(d), q: String(c) }] }],
    talimat: "Sadeleştirilmiş kesir olarak yaz.",
    dogru: kesirStr(ustP * altQ, ustQ * altP),
    tuzaklar: { "kesir-toplama": kesirStr(1 + a, 1 - d || 1) },
    adimlar: [
      { i: `Pay: 1 + ${a}/${b} = ${ustP}/${ustQ}`, a: "Payı tek kesir yap." },
      { i: `Payda: 1 − ${d}/${c} = ${altP}/${altQ}`, a: "Paydayı tek kesir yap." },
      { i: kesirStr(ustP * altQ, ustQ * altP), a: "Böl: ters çevir ve çarp." },
    ],
    ipuclari: ["Pay ve paydayı ayrı ayrı tek kesir hâline getir.", "Sonra bölme işlemine geç.", `Pay = ${ustP}/${ustQ}, payda = ${altP}/${altQ}`],
  });
}

function g_t1_3(sv) {
  if (sv === 1) {
    const q = sec([4, 5, 8, 10, 20, 25]), p = rnd(1, q - 1);
    const ond = p / q;
    return mk({
      parcalar: [String(ond).replace(".", ",")],
      talimat: "Bu ondalık sayıyı sadeleştirilmiş kesir olarak yaz.",
      dogru: kesirStr(p, q),
      tuzaklar: {},
      adimlar: [{ i: `${String(ond).replace(".", ",")} = ${Math.round(ond * 1000)}/1000`, a: "Basamak sayısı kadar 10'un kuvvetine böl." }, { i: kesirStr(p, q), a: "Sadeleştir." }],
      ipuclari: ["Virgülden sonra kaç basamak var?", "O kadar sıfırlı 10'un kuvvetini payda yap.", "Sonra sadeleştir."],
    });
  }
  if (sv === 2) {
    const yuzde = sec([5, 12, 15, 20, 24, 25, 35, 40, 60, 75]);
    const sayi = sec([20, 40, 60, 80, 120, 200, 240, 300]);
    const d = (yuzde * sayi) / 100;
    return mk({
      parcalar: [`%${yuzde} × ${sayi}`],
      talimat: "Sonucu bul.",
      dogru: String(d),
      tuzaklar: { "hesap-hatasi": String(d * 10) },
      adimlar: [{ i: `${yuzde}/100 × ${sayi}`, a: "Yüzde, yüzde bir demektir." }, { i: String(d), a: "Sadeleştirip çarp." }],
      ipuclari: ["% işareti 'bölü 100' demektir.", `${yuzde}/100 × ${sayi}`, `Önce ${sayi}/100 = ${sayi / 100} bul.`],
    });
  }
  const bas = sec([200, 400, 500, 800, 1000, 1200]);
  const art = sec([10, 20, 25, 50]);
  const azal = sec([10, 20, 25, 50]);
  const d = bas * (1 + art / 100) * (1 - azal / 100);
  return mk({
    parcalar: [`${bas} → %${art} artış → %${azal} azalış`],
    talimat: "Son değeri bul.",
    dogru: String(d),
    tuzaklar: { "hesap-hatasi": String(bas * (1 + (art - azal) / 100)) },
    adimlar: [{ i: `${bas} × ${1 + art / 100} = ${bas * (1 + art / 100)}`, a: "Önce artışı uygula." }, { i: `${bas * (1 + art / 100)} × ${1 - azal / 100} = ${d}`, a: "Azalışı YENİ değer üzerinden uygula." }],
    ipuclari: ["İkinci yüzde, ilk sonucun üzerine uygulanır.", "Yüzdeleri doğrudan toplayıp çıkaramazsın.", `Önce ${bas} sayısını %${art} artır.`],
  });
}

function g_t1_4(sv) {
  if (sv === 1) {
    const a = rnd(2, 9), b = rnd(2, 9), k = rnd(2, 9);
    return mk({
      parcalar: [{ k: "kesir", p: String(a), q: String(b) }, " = ", { k: "kesir", p: "x", q: String(b * k) }],
      talimat: "x kaçtır?",
      dogru: String(a * k),
      tuzaklar: { "hesap-hatasi": String(a + k) },
      adimlar: [{ i: `${b} → ${b * k} için ${k} katı`, a: "Payda kaç katına çıkmış?" }, { i: `x = ${a} × ${k} = ${a * k}`, a: "Pay da aynı oranda büyür." }],
      ipuclari: ["İçler dışlar çarpımı yapabilirsin.", `${a} × ${b * k} = ${b} × x`, `Payda kaç katına çıktı?`],
    });
  }
  if (sv === 2) {
    const isci1 = sec([4, 5, 6, 8, 10, 12]), gun1 = sec([6, 9, 12, 15, 20]);
    const isci2 = sec([2, 3, 4, 6]);
    const carpim = isci1 * gun1;
    if (carpim % isci2 !== 0) return g_t1_4(2);
    return mk({
      parcalar: [`${isci1} işçi ${gun1} günde bitiriyor. ${isci2} işçi kaç günde bitirir?`],
      talimat: "Gün sayısını bul.",
      dogru: String(carpim / isci2),
      tuzaklar: { "hesap-hatasi": String((gun1 * isci2) / isci1) },
      adimlar: [{ i: `İşçi ↑ → gün ↓`, a: "Bu ters orantıdır." }, { i: `${isci1} × ${gun1} = ${isci2} × x`, a: "Ters orantıda çarpımlar eşittir." }, { i: `x = ${carpim / isci2}`, a: "Çöz." }],
      ipuclari: ["İşçi sayısı artınca süre artar mı azalır mı?", "Bu bir ters orantı.", "Ters orantıda çarpımlar sabittir."],
    });
  }
  const o1 = rnd(2, 7), o2 = rnd(2, 7), o3 = rnd(2, 7);
  const birim = rnd(3, 12);
  const toplam = (o1 + o2 + o3) * birim;
  return mk({
    parcalar: [`${toplam} TL, ${o1} : ${o2} : ${o3} oranında paylaşılıyor. En büyük pay kaçtır?`],
    talimat: "En büyük payı bul.",
    dogru: String(Math.max(o1, o2, o3) * birim),
    tuzaklar: { "hesap-hatasi": String(toplam / 3) },
    adimlar: [{ i: `Toplam oran = ${o1 + o2 + o3}`, a: "Oranları topla." }, { i: `Birim = ${toplam} ÷ ${o1 + o2 + o3} = ${birim}`, a: "Bir birimin değeri." }, { i: `${Math.max(o1, o2, o3)} × ${birim} = ${Math.max(o1, o2, o3) * birim}`, a: "En büyük payı hesapla." }],
    ipuclari: ["Önce oranların toplamını bul.", "Toplamı oran toplamına böl: bir birim ne kadar?", `Bir birim = ${birim}`],
  });
}

/* ---- Kademe 2 ---- */
function g_t2_1(sv) {
  if (sv === 1) {
    const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(2, 9);
    return mk({
      giris: "cebir",
      parcalar: [`${a}x + ${b} − ${c}x + ${d}`],
      talimat: "Benzer terimleri topla.",
      dogru: `${a - c}*x + ${b + d}`,
      tuzaklar: { "hesap-hatasi": `${a + c}*x + ${b + d}` },
      adimlar: [{ i: `(${a}x − ${c}x) + (${b} + ${d})`, a: "Benzer terimleri grupla." }, { i: `${a - c}x + ${b + d}`, a: "Katsayıları topla." }],
      ipuclari: ["x'li terimleri kendi arasında, sabitleri kendi arasında topla.", "x + x = 2x; x · x değil.", `${a}x − ${c}x kaçtır?`],
    });
  }
  if (sv === 2) {
    const a = rnd(2, 6), b = rnd(2, 9), c = rnd(2, 6), d = rnd(2, 9), e = rnd(2, 5);
    return mk({
      giris: "cebir",
      parcalar: [`${a}`, { k: "us", t: "x", u: "2" }, ` − ${b}x + ${e} + ${c}`, { k: "us", t: "x", u: "2" }, ` + ${d}x − 1`],
      talimat: "Benzer terimleri topla.",
      dogru: `${a + c}*x^2 + ${d - b}*x + ${e - 1}`,
      tuzaklar: { "hesap-hatasi": `${a + c}*x^2 + ${d + b}*x + ${e - 1}` },
      adimlar: [{ i: `(${a} + ${c})x²`, a: "x² terimleri." }, { i: `(−${b} + ${d})x`, a: "x terimleri." }, { i: `${e} − 1`, a: "Sabitler." }],
      ipuclari: ["x² ile x benzer terim DEĞİLDİR.", "Üç ayrı grup var: x², x, sabit.", "Her grubu ayrı topla."],
    });
  }
  const a = rnd(2, 5), b = rnd(2, 7), c = rnd(2, 5), d = rnd(2, 7);
  const px = a * 1 - c * 1, py = -a * b - c * d;
  return mk({
    giris: "cebir",
    parcalar: [`${a}(x − ${b}) − ${c}(x + ${d}) + ${b * c}`],
    talimat: "Aç ve sadeleştir.",
    dogru: `${px}*x + ${py + b * c}`,
    tuzaklar: { dagitma: `${px}*x + ${-a * b + c * d + b * c}` },
    adimlar: [{ i: `${a}x − ${a * b}`, a: "İlk parantez." }, { i: `−${c}x − ${c * d}`, a: "İkinci parantez: eksi iki terime de dağılır." }, { i: `${px}x + ${py + b * c}`, a: "Benzerleri topla." }],
    ipuclari: ["Önce parantezleri aç.", "İkinci parantezin önündeki eksiye dikkat.", "Sonra benzer terimleri topla."],
  });
}

function g_t2_2(sv) {
  if (sv === 1) {
    const kok = sifirsiz(-12, 12), a = sec([2, 3, 4, 5, 6, 7]), b = sifirsiz(-20, 20);
    const c = a * kok + b;
    return mk({
      parcalar: [`${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)} = ${eksi(c)}`],
      talimat: "x kaçtır?",
      dogru: String(kok),
      tuzaklar: { "terim-tasima": kesirStr(c + b, a) },
      adimlar: [{ i: `${a}x = ${eksi(c)} ${b > 0 ? "−" : "+"} ${Math.abs(b)}`, a: "Sabiti karşıya at — işaret değişir." }, { i: `${a}x = ${eksi(c - b)}`, a: "Sadeleştir." }, { i: `x = ${eksi(kok)}`, a: `Her iki tarafı ${a}'ya böl.` }],
      ipuclari: ["x'i yalnız bırakmak için önce sabitten kurtul.", "Karşıya geçen terimin işareti değişir.", `${a}x = ${eksi(c - b)}`],
    });
  }
  if (sv === 2) {
    const kok = sifirsiz(-10, 10), a = rnd(3, 9), c = rnd(2, a - 1), b = sifirsiz(-15, 15);
    const d = (a - c) * kok + b;
    return mk({
      parcalar: [`${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)} = ${c}x ${d > 0 ? "+" : "−"} ${Math.abs(d)}`],
      talimat: "x kaçtır?",
      dogru: String(kok),
      tuzaklar: { "terim-tasima": kesirStr(d + b, a + c) },
      adimlar: [{ i: `${a}x − ${c}x = ${eksi(d)} ${b > 0 ? "−" : "+"} ${Math.abs(b)}`, a: "x'leri sola, sabitleri sağa topla." }, { i: `${a - c}x = ${eksi(d - b)}`, a: "Sadeleştir." }, { i: `x = ${eksi(kok)}`, a: "Böl." }],
      ipuclari: ["Bilinmeyenleri bir tarafa, sayıları öbür tarafa topla.", "Taraf değiştiren her terimin işareti döner.", `${a - c}x = ${eksi(d - b)}`],
    });
  }
  const kok = sifirsiz(-8, 8), a = rnd(2, 6), b = sifirsiz(-9, 9), c = rnd(2, 5), d = sifirsiz(-9, 9);
  if (a === c) return g_t2_2(3);
  const e = (a - c) * kok + a * b - c * d;
  return mk({
    parcalar: [`${a}(x ${b > 0 ? "+" : "−"} ${Math.abs(b)}) − ${c}(x ${d > 0 ? "+" : "−"} ${Math.abs(d)}) = ${eksi(e)}`],
    talimat: "x kaçtır?",
    dogru: String(kok),
    tuzaklar: { dagitma: kesirStr(e - a * b - c * d, a - c) },
    adimlar: [
      { i: `${a}x ${a * b >= 0 ? "+" : "−"} ${Math.abs(a * b)} − ${c}x ${-c * d >= 0 ? "+" : "−"} ${Math.abs(c * d)} = ${eksi(e)}`, a: "Parantezleri aç (eksiyi dağıtmayı unutma)." },
      { i: `${a - c}x = ${eksi(e - a * b + c * d)}`, a: "Benzerleri topla, sabitleri karşıya at." },
      { i: `x = ${eksi(kok)}`, a: "Böl." },
    ],
    ipuclari: ["Önce iki parantezi de aç.", "İkinci parantezin önündeki eksi her iki terime dağılır.", "Sonra x'li ve sabit terimleri ayır."],
  });
}

const FORMULLER = [
  { p: ["v = ", { k: "kesir", p: "x", q: "t" }], hedef: "t", dogru: "x/v", ipucu: "Her iki tarafı t ile çarp." },
  { p: ["F = m·a"], hedef: "a", dogru: "F/m", ipucu: "Her iki tarafı m'ye böl." },
  { p: ["P = 2(a + b)"], hedef: "a", dogru: "P/2 - b", ipucu: "Önce 2'ye böl, sonra b'yi çıkar." },
  { p: ["A = ", { k: "kesir", p: "(a + b)·h", q: "2" }], hedef: "h", dogru: "2*A/(a+b)", ipucu: "Önce 2 ile çarp, sonra (a+b)'ye böl." },
  { p: ["C = 2πr"], hedef: "r", dogru: "C/(2*pi)", ipucu: "Her iki tarafı 2π'ye böl." },
  { p: ["E = m·", { k: "us", t: "c", u: "2" }], hedef: "m", dogru: "E/c^2", ipucu: "Her iki tarafı c²'ye böl." },
  { p: ["s = v·t + k"], hedef: "t", dogru: "(s - k)/v", ipucu: "Önce k'yı karşıya at, sonra v'ye böl." },
  { p: ["A = π", { k: "us", t: "r", u: "2" }], hedef: "r", dogru: "sqrt(A/pi)", ipucu: "Önce r²'yi yalnız bırak, sonra karekök al." },
  { p: ["y = m·x + n"], hedef: "x", dogru: "(y - n)/m", ipucu: "Önce n'yi karşıya at, sonra m'ye böl." },
];

function g_t2_3(sv) {
  const havuz = sv === 1 ? FORMULLER.slice(0, 3) : sv === 2 ? FORMULLER.slice(1, 7) : FORMULLER.slice(3);
  const f = sec(havuz);
  return mk({
    giris: "cebir",
    parcalar: f.p,
    talimat: `Bu formülü ${f.hedef} için düzenle. (${f.hedef} = ?)`,
    dogru: f.dogru,
    tuzaklar: {},
    adimlar: [{ i: f.ipucu, a: "Hedef değişkeni yalnız bırakmak için ters işlemleri sırayla uygula." }],
    ipuclari: [`${f.hedef} değişkenini yalnız bırakmaya çalış.`, "Bir tarafa uyguladığın işlemi diğerine de uygula.", f.ipucu],
  });
}

function g_t2_4(sv) {
  if (sv === 1) {
    const kok = sifirsiz(-9, 9), b = sec([2, 3, 4, 5, 6]);
    const a = b * kok;
    return mk({
      parcalar: [{ k: "kesir", p: eksi(a), q: "x" }, ` = ${b}`],
      talimat: "x kaçtır?",
      dogru: String(kok),
      tuzaklar: { "hesap-hatasi": String(a * b) },
      adimlar: [{ i: `${eksi(a)} = ${b}x`, a: "Her iki tarafı x ile çarp." }, { i: `x = ${eksi(kok)}`, a: `${b}'ye böl.` }],
      ipuclari: ["Paydadaki x'ten kurtulmak için ne yapmalısın?", "Her iki tarafı x ile çarp.", `${eksi(a)} = ${b}x`],
    });
  }
  if (sv === 2) {
    const kok = sifirsiz(-9, 9), b = sifirsiz(-8, 8), c = sec([2, 3, 4, 5]);
    if (kok === b) return g_t2_4(2);
    const a = c * (kok - b) - kok;
    return mk({
      parcalar: [{ k: "kesir", p: `x ${a >= 0 ? "+" : "−"} ${Math.abs(a)}`, q: `x ${-b >= 0 ? "+" : "−"} ${Math.abs(b)}` }, ` = ${c}`],
      talimat: "x kaçtır?",
      dogru: String(kok),
      tuzaklar: { dagitma: kesirStr(-b - a, 1 - c) },
      adimlar: [{ i: `x ${a >= 0 ? "+" : "−"} ${Math.abs(a)} = ${c}(x ${-b >= 0 ? "+" : "−"} ${Math.abs(b)})`, a: "İçler dışlar çarpımı." }, { i: `x ${a >= 0 ? "+" : "−"} ${Math.abs(a)} = ${c}x ${-c * b >= 0 ? "+" : "−"} ${Math.abs(c * b)}`, a: "Sağı dağıt." }, { i: `x = ${eksi(kok)}`, a: "Topla ve böl." }],
      ipuclari: ["Paydayı yok etmek için karşı tarafla çarp.", "Sağ tarafı dağıtmayı unutma.", "Sonra x'leri bir tarafa topla."],
    });
  }
  const kok = sifirsiz(-8, 8), b = sifirsiz(-6, 6), c = sifirsiz(-6, 6);
  if (b === c) return g_t2_4(3);
  const a = kok * (c - b);
  return mk({
    parcalar: [{ k: "kesir", p: eksi(a), q: "x" }, ` ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${eksi(c)}`],
    talimat: "x kaçtır?",
    dogru: String(kok),
    tuzaklar: { "terim-tasima": kesirStr(a, c + b) },
    adimlar: [{ i: `${eksi(a)}/x = ${eksi(c - b)}`, a: "Sabiti karşıya at (işaret değişir)." }, { i: `${eksi(a)} = ${eksi(c - b)}·x`, a: "x ile çarp." }, { i: `x = ${eksi(kok)}`, a: "Böl." }],
    ipuclari: ["Önce kesri yalnız bırak.", "Sabiti karşıya atarken işaretini değiştir.", "Sonra x ile çarp."],
  });
}

function g_t2_5(sv) {
  const x0 = sifirsiz(-8, 8), y0 = sifirsiz(-8, 8);
  const a1 = sv === 1 ? 1 : rnd(2, 5), b1 = sv === 1 ? 1 : rnd(2, 5) * (sv === 3 ? isaretli() : 1);
  const a2 = sv === 1 ? 1 : rnd(2, 5), b2 = sv === 1 ? -1 : rnd(2, 5) * -1;
  if (a1 * b2 - a2 * b1 === 0) return g_t2_5(sv);
  const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0;
  const yaz = (a, b, c) => `${a === 1 ? "" : a === -1 ? "−" : a}x ${b > 0 ? "+" : "−"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y = ${eksi(c)}`;
  return mk({
    giris: "sistem",
    parcalar: [yaz(a1, b1, c1) + "\n" + yaz(a2, b2, c2)],
    talimat: "x ve y'yi bul. (Örnek biçim: x=2, y=−3)",
    dogru: `x=${x0}, y=${y0}`,
    tuzaklar: {},
    adimlar: [
      { i: "Yok etme yöntemi", a: "Bir bilinmeyenin katsayılarını eşitleyip denklemleri topla ya da çıkar." },
      { i: `x = ${eksi(x0)}`, a: "Bulunan değeri denklemlerden birinde yerine koy." },
      { i: `y = ${eksi(y0)}`, a: "Diğer bilinmeyeni bul." },
    ],
    ipuclari: ["İki yöntem var: yerine koyma ve yok etme.", "Bir bilinmeyenin katsayılarını zıt işaretli eşitle.", "Denklemleri toplayınca bir bilinmeyen yok olmalı."],
  });
}

function g_t2_6(sv) {
  if (sv === 1) {
    const a = rnd(2, 7), kok = sifirsiz(-10, 10), b = sifirsiz(-12, 12);
    const c = a * kok + b, op = sec([">", "<"]);
    return mk({
      giris: "esitsizlik",
      parcalar: [`${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)} ${op} ${eksi(c)}`],
      talimat: "Çözüm kümesini yaz. (Örnek biçim: x<3)",
      dogru: `x${op}${kok}`,
      tuzaklar: { "esitsizlik-yonu": `x${op === ">" ? "<" : ">"}${kok}` },
      adimlar: [{ i: `${a}x ${op} ${eksi(c - b)}`, a: "Sabiti karşıya at." }, { i: `x ${op} ${eksi(kok)}`, a: `Pozitif ${a}'ya bölündü — yön DEĞİŞMEZ.` }],
      ipuclari: ["Denklem gibi çöz.", "Böldüğün sayı pozitifse yön değişmez.", `${a}x ${op} ${eksi(c - b)}`],
    });
  }
  const a = rnd(2, 7), kok = sifirsiz(-10, 10), b = sifirsiz(-12, 12);
  const c = -a * kok + b, op = sec([">", "<"]);
  const ters = op === ">" ? "<" : ">";
  return mk({
    giris: "esitsizlik",
    parcalar: [`−${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)} ${op} ${eksi(c)}`],
    talimat: "Çözüm kümesini yaz. (Örnek biçim: x<3)",
    dogru: `x${ters}${kok}`,
    tuzaklar: { "esitsizlik-yonu": `x${op}${kok}` },
    adimlar: [
      { i: `−${a}x ${op} ${eksi(c - b)}`, a: "Sabiti karşıya at." },
      { i: `x ${ters} ${eksi(kok)}`, a: `NEGATİF ${-a} sayısına bölündü — eşitsizliğin yönü DÖNER.` },
    ],
    ipuclari: ["x'in katsayısı negatif; bu kritik.", "Negatifle çarpar ya da bölersen yön değişir.", `Sonuç x ${ters} ${eksi(kok)} olur.`],
  });
}

function g_t2_7(sv) {
  if (sv === 1) {
    const a = sifirsiz(-9, 9), b = rnd(2, 12);
    return mk({
      giris: "coklu",
      parcalar: [`|x ${a >= 0 ? "−" : "+"} ${Math.abs(a)}| = ${b}`],
      talimat: "x'in alabileceği değerleri yaz. (Örnek biçim: 2, −5)",
      dogru: `${a + b}, ${a - b}`,
      tuzaklar: { "hesap-hatasi": String(a + b) },
      adimlar: [{ i: `x − ${a} = ${b}  veya  x − ${a} = −${b}`, a: "Mutlak değer iki durum üretir." }, { i: `x = ${eksi(a + b)}  veya  x = ${eksi(a - b)}`, a: "İkisini de çöz." }],
      ipuclari: ["Mutlak değer içi pozitif de negatif de olabilir.", "İki ayrı denklem kur.", "İki cevap var, ikisini de yaz."],
    });
  }
  if (sv === 2) {
    const a = sec([2, 3, 4]), kok1 = sifirsiz(-6, 6), b = rnd(2, 9), c = a * kok1 + b;
    if (c <= 0 || (-c - b) % a !== 0) return g_t2_7(2);
    return mk({
      giris: "coklu",
      parcalar: [`|${a}x + ${b}| = ${c}`],
      talimat: "x'in alabileceği değerleri yaz.",
      dogru: `${kok1}, ${(-c - b) / a}`,
      tuzaklar: { "hesap-hatasi": String(kok1) },
      adimlar: [{ i: `${a}x + ${b} = ${c}  veya  ${a}x + ${b} = −${c}`, a: "İki durum." }, { i: `x = ${eksi(kok1)}  veya  x = ${eksi((-c - b) / a)}`, a: "İki denklemi de çöz." }],
      ipuclari: ["İki denklem kur: +c ve −c.", "Her birini ayrı çöz.", "İki cevabı virgülle yaz."],
    });
  }
  const a = sifirsiz(-8, 8), b = rnd(2, 9);
  return mk({
    giris: "aralik",
    parcalar: [`|x ${a >= 0 ? "−" : "+"} ${Math.abs(a)}| < ${b}`],
    talimat: "Çözüm aralığını yaz. (Örnek biçim: −2<x<5)",
    dogru: `${a - b}<x<${a + b}`,
    tuzaklar: {},
    adimlar: [{ i: `−${b} < x − ${a} < ${b}`, a: "'<' ise çift taraflı eşitsizlik yazılır." }, { i: `${eksi(a - b)} < x < ${eksi(a + b)}`, a: `Her tarafa ${a} ekle.` }],
    ipuclari: ["|A| < b ⇒ −b < A < b", "Üç tarafa da aynı işlemi uygula.", `−${b} < x − ${a} < ${b}`],
  });
}

/* ---- Kademe 3 ---- */
function g_t3_1(sv) {
  if (sv === 1) {
    const t = sec([2, 3, 5]), m = rnd(2, 4), n = rnd(2, 4);
    return mk({
      parcalar: [{ k: "us", t: String(t), u: String(m) }, " × ", { k: "us", t: String(t), u: String(n) }],
      talimat: "Sonucu sayı olarak bul.",
      dogru: String(Math.pow(t, m + n)),
      tuzaklar: { "us-kurali": String(Math.pow(t, m * n)) },
      adimlar: [{ i: `${t}^(${m}+${n}) = ${t}^${m + n}`, a: "Aynı tabanlı çarpımda üsler TOPLANIR." }, { i: String(Math.pow(t, m + n)), a: "Hesapla." }],
      ipuclari: ["Tabanlar aynı; üslere ne olur?", "Çarpmada üsler toplanır, çarpılmaz.", `${t}^${m + n}`],
    });
  }
  if (sv === 2) {
    const m = rnd(3, 7), n = rnd(2, 5), p = rnd(1, 4);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "kesir", p: [{ k: "us", t: "a", u: String(m) }, " · ", { k: "us", t: "a", u: String(n) }], q: { k: "us", t: "a", u: String(p) } }],
      talimat: "Sadeleştir. (Örnek biçim: a^4)",
      dogru: `a^${m + n - p}`,
      tuzaklar: { "us-kurali": `a^${m * n - p}` },
      adimlar: [{ i: `a^${m + n}`, a: "Çarpımda üsler toplanır." }, { i: `a^${m + n} ÷ a^${p} = a^${m + n - p}`, a: "Bölmede üsler çıkarılır." }],
      ipuclari: ["Önce paydaki çarpımı birleştir.", "Bölmede üsler çıkarılır.", `Pay = a^${m + n}`],
    });
  }
  const m = rnd(2, 4), n = rnd(2, 3), p = rnd(1, 3), q = rnd(2, 4);
  return mk({
    giris: "cebir",
    parcalar: [{ k: "kesir", p: [{ k: "us", t: [{ k: "us", t: "(x", u: String(m) }, "·", { k: "us", t: "y", u: `−${n}` }, ")"], u: "2" }], q: [{ k: "us", t: "x", u: `−${p}` }, "·", { k: "us", t: "y", u: String(q) }] }],
    talimat: "Sadeleştir. (Örnek biçim: x^5*y^-2)",
    dogru: `x^(${2 * m + p})*y^(${-2 * n - q})`,
    tuzaklar: { "us-kurali": `x^(${m + 2 + p})*y^(${-n + 2 - q})` },
    adimlar: [
      { i: `x^${2 * m}·y^${-2 * n}`, a: "Üssün üssü: üsler ÇARPILIR." },
      { i: `x^${2 * m}⁄x^${-p} = x^${2 * m + p}`, a: "Bölmede üsler çıkarılır; eksi eksi artı." },
      { i: `y^${-2 * n - q}`, a: "y için de aynı işlem." },
    ],
    ipuclari: ["Üssün üssünde üsler çarpılır.", "Negatif üsleri dikkatle taşı.", "x ve y'yi ayrı ayrı hesapla."],
  });
}

function g_t3_2(sv) {
  if (sv === 1) {
    const k = rnd(2, 9), m = sec([2, 3, 5, 6, 7, 10]);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "kok", i: String(k * k * m) }],
      talimat: "Kökü sadeleştir. (Örnek biçim: 3√2)",
      dogru: `${k}*sqrt(${m})`,
      tuzaklar: { "hesap-hatasi": `${k * k}*sqrt(${m})` },
      adimlar: [{ i: `√(${k * k} · ${m})`, a: "Tam kare çarpanı ayır." }, { i: `${k}√${m}`, a: "Tam karenin kökünü dışarı çıkar." }],
      ipuclari: ["İçeride tam kare çarpan var mı?", `${k * k * m} = ${k * k} × ${m}`, `√${k * k} = ${k}`],
    });
  }
  if (sv === 2) {
    const c = sec([2, 3, 5, 6, 7]), p = rnd(2, 6), q = rnd(2, 6);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "kok", i: String(p * p * c) }, " + ", { k: "kok", i: String(q * q * c) }],
      talimat: "Sadeleştir. (Örnek biçim: 5√3)",
      dogru: `${p + q}*sqrt(${c})`,
      tuzaklar: { "kok-dagitma": `sqrt(${p * p * c + q * q * c})` },
      adimlar: [{ i: `${p}√${c} + ${q}√${c}`, a: "İkisini de sadeleştir." }, { i: `${p + q}√${c}`, a: "Aynı köklüler benzer terim gibi toplanır." }],
      ipuclari: ["Kök toplama üzerine dağılmaz; önce her kökü sadeleştir.", "İkisi de √" + c + " cinsinden yazılabilir mi?", `${p}√${c} + ${q}√${c}`],
    });
  }
  const b = sec([2, 3, 5, 6, 7]), k = rnd(2, 8);
  const a = b * k;
  return mk({
    giris: "cebir",
    parcalar: [{ k: "kesir", p: String(a), q: { k: "kok", i: String(b) } }],
    talimat: "Paydayı rasyonel yap. (Örnek biçim: 2√3)",
    dogru: `${k}*sqrt(${b})`,
    tuzaklar: { "hesap-hatasi": `${a}*sqrt(${b})` },
    adimlar: [{ i: `${a}/√${b} × √${b}/√${b}`, a: "Pay ve paydayı √" + b + " ile çarp." }, { i: `${a}√${b} / ${b} = ${k}√${b}`, a: "Payda tam sayı oldu; sadeleştir." }],
    ipuclari: ["Paydadaki kökten nasıl kurtulursun?", "Pay ve paydayı aynı kökle çarp.", `Payda ${b} olur.`],
  });
}

function g_t3_3(sv) {
  const a = rnd(2, 9);
  if (sv === 1) {
    return mk({
      giris: "cebir",
      parcalar: [{ k: "us", t: `(x + ${a})`, u: "2" }],
      talimat: "Açılımını yaz.",
      dogru: `x^2 + ${2 * a}*x + ${a * a}`,
      tuzaklar: { ozdeslik: `x^2 + ${a * a}` },
      adimlar: [{ i: `(x + ${a})(x + ${a})`, a: "Kare demek, kendisiyle çarpım demek." }, { i: `x² + ${a}x + ${a}x + ${a * a}`, a: "Her terimi her terimle çarp." }, { i: `x² + ${2 * a}x + ${a * a}`, a: "Orta terimleri topla." }],
      ipuclari: ["(a+b)² = a² + 2ab + b²", "Orta terimi unutma.", `2 · x · ${a} = ${2 * a}x`],
    });
  }
  if (sv === 2) {
    return mk({
      giris: "cebir",
      parcalar: [`(x − ${a})(x + ${a})`],
      talimat: "Çarpımı yaz.",
      dogru: `x^2 - ${a * a}`,
      tuzaklar: { ozdeslik: `x^2 + ${a * a}` },
      adimlar: [{ i: `x² + ${a}x − ${a}x − ${a * a}`, a: "Dağıt." }, { i: `x² − ${a * a}`, a: "Orta terimler birbirini götürür." }],
      ipuclari: ["Bu iki kare farkıdır.", "(a−b)(a+b) = a² − b²", "Orta terimler sadeleşir."],
    });
  }
  const b = rnd(2, 5);
  return mk({
    giris: "cebir",
    parcalar: [{ k: "us", t: `(${b}x − ${a})`, u: "2" }],
    talimat: "Açılımını yaz.",
    dogru: `${b * b}*x^2 - ${2 * a * b}*x + ${a * a}`,
    tuzaklar: { ozdeslik: `${b * b}*x^2 + ${a * a}` },
    adimlar: [{ i: `(${b}x)² = ${b * b}x²`, a: "İlk terimin karesi." }, { i: `2 · ${b}x · (−${a}) = −${2 * a * b}x`, a: "Orta terim (iki katı)." }, { i: `(−${a})² = ${a * a}`, a: "Son terimin karesi — pozitif." }],
    ipuclari: ["(a−b)² = a² − 2ab + b²", "Katsayının da karesi alınır.", "Son terim daima pozitiftir."],
  });
}

function g_t3_4(sv) {
  if (sv === 1) {
    const p = rnd(1, 9), q = rnd(1, 9);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "us", t: "x", u: "2" }, ` + ${p + q}x + ${p * q}`],
      talimat: "Çarpanlarına ayır. (Örnek biçim: (x+2)(x+3))",
      dogru: `(x + ${p})*(x + ${q})`,
      tuzaklar: { "hesap-hatasi": `(x + ${p * q})*(x + ${p + q})` },
      adimlar: [{ i: `Çarpımı ${p * q}, toplamı ${p + q} olan iki sayı`, a: "Bu iki sayıyı bul." }, { i: `${p} ve ${q}`, a: "Aranan sayılar." }, { i: `(x + ${p})(x + ${q})`, a: "Çarpanlara ayrılmış hâli." }],
      ipuclari: [`Çarpımı ${p * q}, toplamı ${p + q} olan iki sayı ara.`, `${p * q} sayısının çarpanlarını listele.`, `Cevap ${p} ve ${q}.`],
    });
  }
  if (sv === 2) {
    const p = rnd(1, 9), q = rnd(1, 9) * -1;
    const b = p + q, c = p * q;
    if (b === 0) return g_t3_4(2);
    return mk({
      giris: "cebir",
      parcalar: [{ k: "us", t: "x", u: "2" }, ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}x ${c > 0 ? "+" : "−"} ${Math.abs(c)}`],
      talimat: "Çarpanlarına ayır.",
      dogru: `(x ${p >= 0 ? "+" : "-"} ${Math.abs(p)})*(x ${q >= 0 ? "+" : "-"} ${Math.abs(q)})`,
      tuzaklar: { isaret: `(x ${p >= 0 ? "-" : "+"} ${Math.abs(p)})*(x ${q >= 0 ? "-" : "+"} ${Math.abs(q)})` },
      adimlar: [{ i: `Çarpımı ${c}, toplamı ${b} olan iki sayı`, a: "Çarpım negatifse sayılar ters işaretlidir." }, { i: `${p} ve ${q}`, a: "Aranan sayılar." }],
      ipuclari: ["Çarpım negatif: sayılardan biri eksi.", `Çarpımı ${c}, toplamı ${b} olan ikili ara.`, `Cevap ${p} ve ${q}.`],
    });
  }
  const m = rnd(2, 4), n = rnd(1, 6), p = rnd(1, 5);
  return mk({
    giris: "cebir",
    parcalar: [`${m}`, { k: "us", t: "x", u: "2" }, ` + ${m * p + n}x + ${n * p}`],
    talimat: "Çarpanlarına ayır.",
    dogru: `(${m}x + ${n})*(x + ${p})`,
    tuzaklar: { "hesap-hatasi": `(x + ${n})*(${m}x + ${p})` },
    adimlar: [{ i: `${m}x² + ${m * p}x + ${n}x + ${n * p}`, a: "Orta terimi ikiye ayır." }, { i: `${m}x(x + ${p}) + ${n}(x + ${p})`, a: "Gruplayarak ortak çarpan al." }, { i: `(${m}x + ${n})(x + ${p})`, a: "Ortak parantezi dışarı al." }],
    ipuclari: ["Baştaki katsayı 1 değil; gruplama yöntemi kullan.", `Çarpımı ${m * n * p}, toplamı ${m * p + n} olan iki sayı ara.`, `Orta terimi ${m * p}x + ${n}x olarak ayır.`],
  });
}

function g_t3_5(sv) {
  if (sv === 1) {
    const p = rnd(1, 8), q = rnd(1, 8);
    return mk({
      giris: "coklu",
      parcalar: [{ k: "us", t: "x", u: "2" }, ` − ${p + q}x + ${p * q} = 0`],
      talimat: "Kökleri bul. (Örnek biçim: 2, 5)",
      dogru: `${p}, ${q}`,
      tuzaklar: { isaret: `${-p}, ${-q}` },
      adimlar: [{ i: `(x − ${p})(x − ${q}) = 0`, a: "Çarpanlarına ayır." }, { i: `x = ${p} veya x = ${q}`, a: "Her çarpanı sıfıra eşitle." }],
      ipuclari: ["Önce çarpanlarına ayır.", "Çarpım sıfırsa çarpanlardan biri sıfırdır.", `Çarpımı ${p * q}, toplamı ${p + q} olan ikili ara.`],
    });
  }
  if (sv === 2) {
    const p = rnd(1, 9), q = rnd(1, 9) * -1;
    const b = -(p + q), c = p * q;
    return mk({
      giris: "coklu",
      parcalar: [{ k: "us", t: "x", u: "2" }, ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}x ${c > 0 ? "+" : "−"} ${Math.abs(c)} = 0`],
      talimat: "Kökleri bul.",
      dogru: `${p}, ${q}`,
      tuzaklar: { isaret: `${-p}, ${-q}` },
      adimlar: [{ i: `(x − ${p})(x − ${q}) = 0`, a: "Çarpanlara ayır." }, { i: `x = ${eksi(p)} veya x = ${eksi(q)}`, a: "Sıfıra eşitle." }],
      ipuclari: ["Çarpanlarına ayırmayı dene.", "Çarpım negatifse kökler ters işaretlidir.", `Kökler ${p} ve ${q}.`],
    });
  }
  const p = rnd(1, 7), q = rnd(1, 7) * -1;
  const m = rnd(2, 3);
  const B = -(m * q + p), C = p * q;
  return mk({
    giris: "coklu",
    parcalar: [`${m}`, { k: "us", t: "x", u: "2" }, ` ${B > 0 ? "+" : "−"} ${Math.abs(B)}x ${C > 0 ? "+" : "−"} ${Math.abs(C)} = 0`],
    talimat: "Kökleri bul. (Kesirli olabilir.)",
    dogru: `${kesirStr(p, m)}, ${q}`,
    tuzaklar: { isaret: `${kesirStr(-p, m)}, ${-q}` },
    adimlar: [
      { i: `Δ = b² − 4ac = ${B * B - 4 * m * C}`, a: "Diskriminantı hesapla." },
      { i: `x = (−b ± √Δ) / 2a`, a: "Kök formülünü uygula." },
      { i: `x = ${kesirStr(p, m)} veya x = ${q}`, a: "İki kök." },
    ],
    ipuclari: ["Baştaki katsayı 1 değil; kök formülünü kullanabilirsin.", "Δ = b² − 4ac", `Δ = ${B * B - 4 * m * C}`],
  });
}

/* ---- Kademe 4 ---- */
function g_t4_1(sv) {
  const a = rnd(1, 4), b = sifirsiz(-6, 6), c = sifirsiz(-9, 9), k = sifirsiz(-4, 4);
  const d = a * k * k + b * k + c;
  return mk({
    parcalar: [`f(x) = ${a}`, { k: "us", t: "x", u: "2" }, ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}x ${c > 0 ? "+" : "−"} ${Math.abs(c)}`, `   ⟹   f(${eksi(k)}) = ?`],
    talimat: "Değeri bul.",
    dogru: String(d),
    tuzaklar: { isaret: String(a * k * k - b * k + c) },
    adimlar: [{ i: `x yerine ${eksi(k)} yaz`, a: "Her x'i parantezle değiştir." }, { i: `${a}(${eksi(k)})² ${b > 0 ? "+" : "−"} ${Math.abs(b)}(${eksi(k)}) ${c > 0 ? "+" : "−"} ${Math.abs(c)}`, a: "Yerine koy." }, { i: String(d), a: "İşlem önceliğine göre hesapla." }],
    ipuclari: ["x yerine değeri parantez içinde yaz.", "Negatif sayının karesi pozitiftir.", `(${eksi(k)})² = ${k * k}`],
  });
}

function g_t4_2(sv) {
  const x1 = sifirsiz(-8, 8), y1 = sifirsiz(-8, 8);
  let x2 = sifirsiz(-8, 8);
  if (x2 === x1) x2 = x1 + 2;
  const y2 = sifirsiz(-8, 8);
  return mk({
    parcalar: [`A(${eksi(x1)}, ${eksi(y1)})  ve  B(${eksi(x2)}, ${eksi(y2)})`],
    talimat: "Doğrunun eğimini bul.",
    dogru: kesirStr(y2 - y1, x2 - x1),
    tuzaklar: { "hesap-hatasi": kesirStr(x2 - x1, y2 - y1) },
    adimlar: [{ i: `m = (y₂ − y₁) / (x₂ − x₁)`, a: "Eğim formülü." }, { i: `(${eksi(y2)} − ${eksi(y1)}) / (${eksi(x2)} − ${eksi(x1)})`, a: "Yerine koy." }, { i: kesirStr(y2 - y1, x2 - x1), a: "Sadeleştir." }],
    ipuclari: ["Eğim = y farkı ÷ x farkı", "Sıralamayı ikisinde de aynı tut.", `Pay = ${y2 - y1}`],
  });
}

function g_t4_3(sv) {
  if (sv <= 2) {
    const a1 = sifirsiz(-9, 9), d = sifirsiz(-7, 7), n = rnd(6, 20);
    return mk({
      parcalar: [`a₁ = ${eksi(a1)},  d = ${eksi(d)}   ⟹   a${n} = ?`],
      talimat: "Aritmetik dizinin terimini bul.",
      dogru: String(a1 + (n - 1) * d),
      tuzaklar: { "hesap-hatasi": String(a1 + n * d) },
      adimlar: [{ i: `aₙ = a₁ + (n − 1)d`, a: "Genel terim formülü." }, { i: `${a1} + ${n - 1}·(${d})`, a: "Yerine koy — (n−1), n değil." }, { i: String(a1 + (n - 1) * d), a: "Hesapla." }],
      ipuclari: ["Formülde (n − 1) var, n değil.", `${n}. terim için ${n - 1} adım atılır.`, `a₁ + ${n - 1}·d`],
    });
  }
  const a1 = sec([1, 2, 3]), r = sec([2, 3]), n = rnd(4, 8);
  return mk({
    parcalar: [`a₁ = ${a1},  r = ${r}   ⟹   a${n} = ?`],
    talimat: "Geometrik dizinin terimini bul.",
    dogru: String(a1 * Math.pow(r, n - 1)),
    tuzaklar: { "hesap-hatasi": String(a1 * Math.pow(r, n)) },
    adimlar: [{ i: `aₙ = a₁ · r^(n−1)`, a: "Genel terim." }, { i: `${a1} · ${r}^${n - 1}`, a: "Yerine koy." }, { i: String(a1 * Math.pow(r, n - 1)), a: "Hesapla." }],
    ipuclari: ["Üs (n − 1)'dir.", `${r}^${n - 1} kaçtır?`, `${a1} × ${Math.pow(r, n - 1)}`],
  });
}

function g_t4_4(sv) {
  if (sv <= 2) {
    const t = sec([2, 3, 5]), k = rnd(2, 5);
    return mk({
      parcalar: [`log`, { k: "us", t: "", u: "" }, `${t}(${Math.pow(t, k)}) = ?`],
      talimat: "Değeri bul.",
      dogru: String(k),
      tuzaklar: { "hesap-hatasi": String(Math.pow(t, k)) },
      adimlar: [{ i: `${t}^? = ${Math.pow(t, k)}`, a: "Logaritma 'üs kaçtır' diye sorar." }, { i: String(k), a: "Cevap." }],
      ipuclari: ["Logaritma bir üs sorusudur.", `${t} sayısının kaçıncı kuvveti ${Math.pow(t, k)} eder?`, `${t}^${k}`],
    });
  }
  const t = sec([2, 3]), k = rnd(2, 5);
  return mk({
    parcalar: [`${t}`, { k: "us", t: "", u: "x" }, ` = ${Math.pow(t, k)}`],
    talimat: "x kaçtır?",
    dogru: String(k),
    tuzaklar: { "hesap-hatasi": String(Math.pow(t, k) / t) },
    adimlar: [{ i: `${t}^x = ${t}^${k}`, a: "Sağ tarafı aynı tabana çevir." }, { i: `x = ${k}`, a: "Tabanlar eşitse üsler de eşittir." }],
    ipuclari: ["Sağ tarafı aynı tabanla yaz.", `${Math.pow(t, k)} = ${t}^?`, "Tabanlar eşitse üsleri eşitle."],
  });
}

const TRIG = [
  { a: "30", sin: "1/2", cos: "sqrt(3)/2", tan: "sqrt(3)/3" },
  { a: "45", sin: "sqrt(2)/2", cos: "sqrt(2)/2", tan: "1" },
  { a: "60", sin: "sqrt(3)/2", cos: "1/2", tan: "sqrt(3)" },
  { a: "0", sin: "0", cos: "1", tan: "0" },
  { a: "90", sin: "1", cos: "0", tan: null },
];
function g_t4_5(sv) {
  const havuz = TRIG.filter((t) => t.tan !== null);
  const t = sec(havuz);
  const f = sec(["sin", "cos", "tan"]);
  return mk({
    giris: "cebir",
    parcalar: [`${f}(${t.a}°) = ?`],
    talimat: "Değeri bul. (Örnek biçim: √3/2)",
    dogru: t[f],
    tuzaklar: { "hesap-hatasi": f === "sin" ? t.cos : t.sin },
    adimlar: [{ i: `${f}(${t.a}°)`, a: "Özel açı değerleri tablosundan." }, { i: t[f].replace(/sqrt\((\d)\)/g, "√$1"), a: "Sonuç." }],
    ipuclari: ["30-45-60 özel açılarını hatırla.", "Birim çemberde bu açı nereye düşüyor?", "sin ve cos değerleri 30° ile 60° arasında yer değiştirir."],
  });
}

/* ══════════════════════════════════════════════════════════════
   BECERİ MERDİVENİ
   ══════════════════════════════════════════════════════════════ */
const BECERILER = [
  { id: "t0-1", ad: "İşaretli toplama–çıkarma", kademe: 0, on: [], sure: 20, uret: g_t0_1,
    kart: { neden: "Negatif sayı bir eksiklik ya da borçtur. Toplamak 'eklemek', çıkarmak 'geri almak' demektir.", analoji: "Cebinde 12 TL var, 20 TL borcun var: 12 − 20 = −8. Borcun silinirse (−(−8)) cebine 8 TL girer.", ornekler: [{ s: "−7 + 12", c: "5" }, { s: "9 − (−4)", c: "13" }] } },
  { id: "t0-2", ad: "İşaretli çarpma–bölme", kademe: 0, on: ["t0-1"], sure: 20, uret: g_t0_2,
    kart: { neden: "Çarpımda işaret, negatiflerin SAYISINA bakar: tek sayıda negatif → sonuç negatif, çift sayıda → pozitif.", analoji: "Eksi, 'tersini al' demektir. İki kez tersini alırsan başladığın yere dönersin.", ornekler: [{ s: "(−3) × (−5)", c: "15" }, { s: "(−24) ÷ 6 × (−2)", c: "8" }] } },
  { id: "t0-3", ad: "İşlem önceliği", kademe: 0, on: ["t0-2"], sure: 30, uret: g_t0_3,
    kart: { neden: "Bir ifadede işlemler yazıldığı sırayla değil, güç sırasına göre yapılır: parantez → üs → çarpma/bölme → toplama/çıkarma. Çarpma ve bölme kendi aralarında, toplama ve çıkarma kendi aralarında soldan sağa.", analoji: "Bir cümlede önce yan cümleyi anlarsın, sonra ana cümleyi. Parantez, matematiğin yan cümlesidir.", ornekler: [{ s: "3 + 4 × 5", c: "23 (35 değil)" }, { s: "20 − 6 ÷ 2", c: "17 (7 değil)" }] } },
  { id: "t0-4", ad: "Parantez açma ve dağıtma", kademe: 0, on: ["t0-3"], sure: 35, uret: g_t0_4,
    kart: { neden: "Parantezin önündeki sayı ya da işaret, içerideki HER terimle çarpılır. Tek bir terimi atlamak bütün çözümü bozar.", analoji: "Üç kişilik bir masaya ikram dağıtıyorsun: birine vermezsen dağıtım eksiktir.", ornekler: [{ s: "3(x + 4)", c: "3x + 12" }, { s: "−(x − 5)", c: "−x + 5" }] } },
  { id: "t0-5", ad: "Sadeleştirme", kademe: 0, on: ["t0-4"], sure: 35, uret: g_t0_5,
    kart: { neden: "Sadeleştirme yalnızca ÇARPANLAR arasında yapılır. Toplama üzerinden sadeleştirme yapılamaz.", analoji: "(a + b)/a ifadesinde a'ları silmek, bir kelimenin ortak harfini silip anlamı korumaya benzer — bozar.", ornekler: [{ s: "(6x + 9)/3", c: "2x + 3" }, { s: "(x² − 4)/(x + 2)", c: "x − 2" }] } },
  { id: "t1-1", ad: "Kesirlerle dört işlem", kademe: 1, on: ["t0-3"], sure: 45, uret: g_t1_1,
    kart: { neden: "Toplama ve çıkarmada paydalar eşit olmalı; çarpma ve bölmede gerekmez. Bölmede ikinci kesir ters çevrilir.", analoji: "Farklı büyüklükte dilimlenmiş iki pastayı toplayamazsın; önce aynı dilim boyuna getirmelisin.", ornekler: [{ s: "1/2 + 1/3", c: "5/6" }, { s: "2/3 ÷ 4/5", c: "5/6" }] } },
  { id: "t1-2", ad: "Bileşik kesirler", kademe: 1, on: ["t1-1"], sure: 55, uret: g_t1_2,
    kart: { neden: "Uzun kesir çizgisi bölme demektir. Önce pay ve payda ayrı ayrı tek kesir hâline getirilir, sonra bölme yapılır.", analoji: "İç içe kutular: en içteki kutuyu kapatmadan dıştakini taşıyamazsın.", ornekler: [{ s: "(3/4)/(2/5)", c: "15/8" }, { s: "(1 + 1/2)/(3/4)", c: "2" }] } },
  { id: "t1-3", ad: "Ondalık ve yüzde", kademe: 1, on: ["t1-1"], sure: 40, uret: g_t1_3,
    kart: { neden: "Yüzde 'bölü 100' demektir. Ard arda gelen yüzdeler toplanmaz; her biri bir öncekinin SONUCU üzerine uygulanır.", analoji: "%20 zam sonra %20 indirim, seni başladığın yere döndürmez — çünkü indirim büyümüş fiyattan yapılır.", ornekler: [{ s: "%25 × 80", c: "20" }, { s: "0,35 kesir olarak", c: "7/20" }] } },
  { id: "t1-4", ad: "Oran ve orantı", kademe: 1, on: ["t1-1"], sure: 45, uret: g_t1_4,
    kart: { neden: "Doğru orantıda biri artarken diğeri artar (bölümleri sabit); ters orantıda biri artarken diğeri azalır (çarpımları sabit).", analoji: "Daha çok işçi → daha az gün. Bu ters orantıdır: işçi × gün sabittir.", ornekler: [{ s: "2/3 = x/12", c: "x = 8" }, { s: "6 işçi 10 günde → 3 işçi", c: "20 gün" }] } },
  { id: "t2-1", ad: "Benzer terimler", kademe: 2, on: ["t0-5"], sure: 35, uret: g_t2_1,
    kart: { neden: "Yalnızca aynı değişkenin aynı kuvvetleri toplanabilir. x ile x² benzer terim değildir.", analoji: "Elmayla elmayı toplarsın, elmayla armudu değil. x ve x² farklı meyvedir.", ornekler: [{ s: "5x + 3 − 2x", c: "3x + 3" }, { s: "x² + 2x + 3x²", c: "4x² + 2x" }] } },
  { id: "t2-2", ad: "Birinci dereceden denklemler", kademe: 2, on: ["t2-1"], sure: 45, uret: g_t2_2,
    kart: { neden: "Denklem bir terazidir. Bir tarafa yaptığın işlemi diğerine de yaparsan denge bozulmaz. Karşıya geçen terimin işareti değişir.", analoji: "Terazinin bir kefesinden 3 kg alırsan, öbüründen de almalısın.", ornekler: [{ s: "3x + 5 = 20", c: "x = 5" }, { s: "4x − 3 = x + 9", c: "x = 4" }] } },
  { id: "t2-3", ad: "Formül düzenleme", kademe: 2, on: ["t2-2"], sure: 55, uret: g_t2_3,
    kart: { neden: "İstediğin değişkeni yalnız bırakmak için, onu kuşatan işlemleri TERSTEN sök: en dıştaki işlemi ilk kaldır.", analoji: "Paket açar gibi: önce dış ambalaj, sonra kutu, en sonda içindeki şey.", ornekler: [{ s: "v = x/t → t = ?", c: "t = x/v" }, { s: "P = 2(a+b) → a = ?", c: "a = P/2 − b" }] } },
  { id: "t2-4", ad: "Rasyonel denklemler", kademe: 2, on: ["t2-2", "t1-2"], sure: 60, uret: g_t2_4,
    kart: { neden: "Paydadan kurtulmak için her iki tarafı paydayla çarparsın. Paydayı sıfır yapan değer çözüm olamaz.", analoji: "Kesirli bir tarifi tam ölçeklere çevirmek: her şeyi aynı katsayıyla büyütürsün.", ornekler: [{ s: "12/x = 4", c: "x = 3" }, { s: "6/x + 2 = 5", c: "x = 2" }] } },
  { id: "t2-5", ad: "Denklem sistemleri", kademe: 2, on: ["t2-2"], sure: 75, uret: g_t2_5,
    kart: { neden: "İki bilinmeyen için iki denklem gerekir. Yok etme: bir bilinmeyenin katsayılarını zıt yapıp denklemleri topla.", analoji: "İki bilinmeyenli bir bilmecede, bir ipucu diğerini sadeleştirir.", ornekler: [{ s: "x + y = 7, x − y = 1", c: "x = 4, y = 3" }] } },
  { id: "t2-6", ad: "Eşitsizlikler", kademe: 2, on: ["t2-2"], sure: 50, uret: g_t2_6,
    kart: { neden: "Eşitsizlik denklem gibi çözülür, tek bir farkla: NEGATİF bir sayıyla çarpar ya da bölersen yön döner.", analoji: "3 < 5 doğrudur. İkisini de −1 ile çarp: −3 > −5. Sıralama tersine döndü.", ornekler: [{ s: "2x + 1 > 7", c: "x > 3" }, { s: "−2x > 6", c: "x < −3" }] } },
  { id: "t2-7", ad: "Mutlak değer", kademe: 2, on: ["t2-6"], sure: 60, uret: g_t2_7,
    kart: { neden: "|A| = b iki durum üretir: A = b veya A = −b. |A| < b ise −b < A < b olur.", analoji: "Mutlak değer 'sıfıra uzaklık'tır. Uzaklığı 5 olan iki nokta vardır: +5 ve −5.", ornekler: [{ s: "|x − 3| = 4", c: "x = 7 veya x = −1" }, { s: "|x| < 2", c: "−2 < x < 2" }] } },
  { id: "t3-1", ad: "Üslü ifadeler", kademe: 3, on: ["t2-1"], sure: 45, uret: g_t3_1,
    kart: { neden: "Aynı tabanlı çarpımda üsler TOPLANIR, bölümde ÇIKARILIR, üssün üssünde ÇARPILIR. Negatif üs, tersini almak demektir.", analoji: "a³·a² = (a·a·a)(a·a) — beş tane a. Saymak yeterli; kural ezber değil.", ornekler: [{ s: "2³ · 2⁴", c: "2⁷ = 128" }, { s: "(a²)³", c: "a⁶" }] } },
  { id: "t3-2", ad: "Köklü ifadeler", kademe: 3, on: ["t3-1"], sure: 55, uret: g_t3_2,
    kart: { neden: "Kök, çarpma ve bölme üzerine dağılır; toplama üzerine DAĞILMAZ. Sadeleştirmek için içerideki tam kare çarpanı dışarı çıkarırsın.", analoji: "√(9·2) = 3√2 olur ama √(9+16) = 5'tir, 3+4 = 7 değil.", ornekler: [{ s: "√50", c: "5√2" }, { s: "6/√3", c: "2√3" }] } },
  { id: "t3-3", ad: "Özdeşlikler", kademe: 3, on: ["t2-1"], sure: 45, uret: g_t3_3,
    kart: { neden: "(a+b)² = a² + 2ab + b². Orta terim, en sık unutulan parçadır. (a−b)(a+b) = a² − b².", analoji: "Kenarı (a+b) olan karenin alanı: iki köşe kare ve iki dikdörtgen — dört parça, iki değil.", ornekler: [{ s: "(x + 3)²", c: "x² + 6x + 9" }, { s: "(x − 5)(x + 5)", c: "x² − 25" }] } },
  { id: "t3-4", ad: "Çarpanlara ayırma", kademe: 3, on: ["t3-3"], sure: 60, uret: g_t3_4,
    kart: { neden: "x² + bx + c için çarpımı c, toplamı b olan iki sayı ararsın. Baştaki katsayı 1 değilse gruplama yöntemi kullanılır.", analoji: "Çarpanlara ayırma, dağıtmanın tersidir: dağıtılmışı toplayıp kutuya geri koymak.", ornekler: [{ s: "x² + 5x + 6", c: "(x+2)(x+3)" }, { s: "x² − 9", c: "(x−3)(x+3)" }] } },
  { id: "t3-5", ad: "İkinci dereceden denklemler", kademe: 3, on: ["t3-4"], sure: 70, uret: g_t3_5,
    kart: { neden: "Çarpım sıfırsa çarpanlardan en az biri sıfırdır. Çarpanlara ayrılamıyorsa kök formülü: x = (−b ± √Δ)/2a, Δ = b² − 4ac.", analoji: "İki kapıdan biri açıksa geçersin. Denklem 'hangi kapı açık?' diye sorar — ikisi de olabilir.", ornekler: [{ s: "x² − 5x + 6 = 0", c: "x = 2 veya x = 3" }] } },
  { id: "t4-1", ad: "Fonksiyon değeri", kademe: 4, on: ["t2-3"], sure: 45, uret: g_t4_1,
    kart: { neden: "f(x) bir makinedir: içine ne koyarsan kuralı ona uygular. f(−2) demek, her x yerine (−2) yazmak demektir.", analoji: "Kahve makinesi: çekirdek koyarsan kahve, çay koyarsan çay çıkar. Kural sabit, girdi değişir.", ornekler: [{ s: "f(x) = x² + 1, f(−3)", c: "10" }] } },
  { id: "t4-2", ad: "Doğrunun eğimi", kademe: 4, on: ["t2-3"], sure: 40, uret: g_t4_2,
    kart: { neden: "Eğim = dikey değişim ÷ yatay değişim. Sıralamayı iki farkta da aynı tutmalısın.", analoji: "Bir yokuşun dikliği: kaç metre yükseldiğini kaç metre ilerlediğine bölersin.", ornekler: [{ s: "A(1,2), B(4,8)", c: "m = 2" }] } },
  { id: "t4-3", ad: "Diziler", kademe: 4, on: ["t3-1"], sure: 45, uret: g_t4_3,
    kart: { neden: "Aritmetik: aₙ = a₁ + (n−1)d. Geometrik: aₙ = a₁·r^(n−1). Her ikisinde de üs/çarpan (n−1)'dir, n değil.", analoji: "5. basamağa çıkmak için 4 adım atarsın; ilk basamakta zaten duruyorsun.", ornekler: [{ s: "a₁=3, d=4, a₁₀", c: "39" }] } },
  { id: "t4-4", ad: "Üstel ve logaritma", kademe: 4, on: ["t3-1"], sure: 45, uret: g_t4_4,
    kart: { neden: "log_a(b) sorusu şudur: 'a'yı hangi kuvvete yükseltirsem b olur?' Logaritma, üs almanın ters işlemidir.", analoji: "Çarpma–bölme nasıl ters işlemse, üs alma ile logaritma da öyledir.", ornekler: [{ s: "log₂(8)", c: "3" }, { s: "3^x = 81", c: "x = 4" }] } },
  { id: "t4-5", ad: "Trigonometrik oranlar", kademe: 4, on: ["t3-2"], sure: 40, uret: g_t4_5,
    kart: { neden: "30°, 45°, 60° özel açılardır ve değerleri ezberlenir. sin(30°) = 1/2, sin(60°) = √3/2; cos'ta bu ikisi yer değiştirir.", analoji: "45° simetrik açıdır; sin ve cos eşittir (√2/2). 30° ve 60° birbirinin aynadaki görüntüsüdür.", ornekler: [{ s: "sin(30°)", c: "1/2" }, { s: "cos(60°)", c: "1/2" }] } },
];

const BID = {};
BECERILER.forEach((b) => (BID[b.id] = b));
const KADEME_AD = { 0: "Temel işlem", 1: "Kesir, ondalık, oran", 2: "Cebir", 3: "Üs, kök, çarpanlar", 4: "DP1 / IB köprüsü" };

function parcaMetin(p) {
  if (p === null || p === undefined) return "";
  if (typeof p === "string" || typeof p === "number") return String(p);
  if (Array.isArray(p)) return p.map(parcaMetin).join("");
  if (p.k === "kesir") return `(${parcaMetin(p.p)})/(${parcaMetin(p.q)})`;
  if (p.k === "us") return `${parcaMetin(p.t)}^${parcaMetin(p.u)}`;
  if (p.k === "kok") return `√(${parcaMetin(p.i)})`;
  return "";
}
function guzel(s) {
  return String(s).replace(/\*/g, "·").replace(/sqrt\((\d+)\)/g, "√$1").replace(/-/g, "−");
}

const OZELLIK_AD = {
  negatif: "negatif sayı",
  parantez: "parantez",
  "ic-parantez": "iç içe parantez",
  kesir: "kesirli ifade",
  us: "üslü ifade",
  kok: "köklü ifade",
  degisken: "değişken (x, y)",
  "cok-adim": "üç veya daha çok adım",
  "buyuk-sayi": "iki basamaktan büyük sayı",
};

function agacTara(p, bayrak) {
  if (!p) return;
  if (Array.isArray(p)) return p.forEach((x) => agacTara(x, bayrak));
  if (typeof p === "object") {
    if (p.k === "kesir") bayrak.kesir = true;
    if (p.k === "us") bayrak.us = true;
    if (p.k === "kok") bayrak.kok = true;
    ["p", "q", "t", "u", "i"].forEach((k) => p[k] !== undefined && agacTara(p[k], bayrak));
  }
}

function ozellikCikar(q) {
  const bayrak = {};
  agacTara(q.parcalar, bayrak);
  const m = parcaMetin(q.parcalar);
  const o = [];
  if (/[−-]/.test(m)) o.push("negatif");
  const acik = (m.match(/\(/g) || []).length;
  if (acik >= 1) o.push("parantez");
  if (acik >= 2) o.push("ic-parantez");
  if (bayrak.kesir || /\//.test(m)) o.push("kesir");
  if (bayrak.us) o.push("us");
  if (bayrak.kok) o.push("kok");
  if (/[xy]/.test(m)) o.push("degisken");
  if ((q.adimlar || []).length >= 3) o.push("cok-adim");
  if ((m.match(/\d+/g) || []).some((n) => Number(n) >= 100)) o.push("buyuk-sayi");
  return o;
}

/* ══════════════════════════════════════════════════════════════
   GÖREV TİPLERİ
   Tek üreteçten dört farklı zihinsel iş. Aynı matematik,
   bambaşka beceriler: üretmek, tanımak, denetlemek, tamamlamak.
   ══════════════════════════════════════════════════════════════ */
const GOREV_AD = {
  klasik: "Çöz",
  elemeli: "Seç",
  hataAvi: "Hata avı",
  adimTamamla: "Boşluğu doldur",
};
const GOREV_ACIKLAMA = {
  klasik: "Cevabı kendin üret.",
  elemeli: "Seçeneklerden doğru olanı bul — çeldiriciler senin tipik hatalarından türetildi.",
  hataAvi: "Aşağıdaki çözümün BİR satırı bozuk. Hangisi?",
  adimTamamla: "Çözümdeki boşluğa gelen sayıyı yaz.",
};

function sayiKonumlari(str) {
  const out = [];
  const re = /-?\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(String(str))) !== null) out.push({ deger: m[0], bas: m.index, son: m.index + m[0].length });
  return out;
}

/** Bir ifadedeki sayılardan birini kaydırarak akla yatkın bir yanlış üretir. */
function ifadeBoz(s) {
  const kon = sayiKonumlari(s);
  if (!kon.length) return null;
  const k = sec(kon);
  const yeni = Number(k.deger) + sec([1, -1, 2, -2, 3]);
  if (yeni === Number(k.deger)) return null;
  return s.slice(0, k.bas) + String(yeni) + s.slice(k.son);
}

/** Çoktan seçmeli: çeldiriciler öğrencinin kendi hata örüntülerinden gelir. */
function gorevElemeli(q) {
  if (q.giris === "sistem" || q.giris === "aralik") return null;
  const dogru = String(q.dogru);
  const havuz = [];
  Object.keys(q.tuzaklar || {}).forEach((k) => {
    const t = q.tuzaklar[k];
    if (t !== null && t !== undefined && String(t) !== dogru) havuz.push({ metin: String(t), tur: k });
  });
  const sayisal = Number(normalle(dogru));
  if (isFinite(sayisal) && !/[a-z]/i.test(dogru)) {
    [1, -1, 2, -2, 3].forEach((d) => {
      const aday = String(sayisal + d);
      if (havuz.length < 3 && aday !== dogru && !havuz.some((h) => h.metin === aday)) havuz.push({ metin: aday, tur: "hesap-hatasi" });
    });
  } else {
    // Cebirsel cevap: katsayıları kaydırarak akla yatkın çeldirici üret
    for (let d = 0; d < 14 && havuz.length < 3; d++) {
      const aday = ifadeBoz(dogru);
      if (!aday || aday === dogru || havuz.some((h) => h.metin === aday)) continue;
      let cakisiyor = false;
      try { cakisiyor = esdeger(aday, dogru); } catch (e) { cakisiyor = true; }
      if (!cakisiyor) havuz.push({ metin: aday, tur: "hesap-hatasi" });
    }
  }
  if (havuz.length < 2) return null;
  const secenekler = [{ metin: dogru, tur: null, dogru: true }, ...havuz.slice(0, 3)];
  for (let i = secenekler.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [secenekler[i], secenekler[j]] = [secenekler[j], secenekler[i]];
  }
  return { ...q, gorev: "elemeli", secenekler, giris: "elemeli" };
}

/** Hata avı: çözümün bir satırı bozulur, öğrenci bulur. */
function gorevHataAvi(q) {
  // Çözüme kapanış satırı eklenir: gerçek bir çözümlü örnek gibi okunsun
  const temel = [...(q.adimlar || [])];
  const sonuc = String(q.dogru);
  if (sayiKonumlari(sonuc).length > 0) temel.push({ i: `sonuç: ${guzel(sonuc)}`, a: "Bulunan cevap." });
  const ad = temel.filter((a) => sayiKonumlari(a.i).length > 0);
  if (ad.length < 3) return null;
  const satirlar = temel.map((a) => ({ ...a }));
  const uygun = satirlar.map((a, i) => i).filter((i) => sayiKonumlari(satirlar[i].i).length > 0);
  if (!uygun.length) return null;
  const bozukIdx = sec(uygun);
  const konumlar = sayiKonumlari(satirlar[bozukIdx].i);
  const k = sec(konumlar);
  const asil = Number(k.deger);
  let yeni = asil;
  const kaydir = sec([1, -1, 2, -2]);
  yeni = asil + kaydir;
  if (yeni === asil) yeni = asil + 1;
  const bozuk = satirlar[bozukIdx].i.slice(0, k.bas) + String(yeni) + satirlar[bozukIdx].i.slice(k.son);
  satirlar[bozukIdx] = { ...satirlar[bozukIdx], i: bozuk, bozuk: true };
  return { ...q, gorev: "hataAvi", satirlar, bozukIdx, giris: "hataAvi", talimat: GOREV_ACIKLAMA.hataAvi };
}

/** Boşluk doldurma: solmuş çözümlü örnek. Türetmeyi okumaya zorlar. */
function gorevAdimTamamla(q) {
  const uygun = (q.adimlar || []).map((a, i) => i).filter((i) => sayiKonumlari(q.adimlar[i].i).length > 0);
  if (uygun.length < 2) return null;
  const idx = sec(uygun.slice(1).length ? uygun.slice(1) : uygun);
  const konumlar = sayiKonumlari(q.adimlar[idx].i);
  const k = konumlar[konumlar.length - 1];
  const satirlar = q.adimlar.map((a, i) =>
    i === idx ? { ...a, i: a.i.slice(0, k.bas) + "▢" + a.i.slice(k.son), bosluk: true } : { ...a }
  );
  return {
    ...q,
    gorev: "adimTamamla",
    satirlar,
    boslukIdx: idx,
    dogru: k.deger,
    kabul: [],
    tuzaklar: {},
    giris: "sayi",
    talimat: GOREV_ACIKLAMA.adimTamamla,
  };
}

/** İstenen görev tipini üretir; üretilemezse klasiğe düşer. */
function goreveDonustur(q, tip) {
  if (!tip || tip === "klasik") return { ...q, gorev: "klasik" };
  const fn = tip === "elemeli" ? gorevElemeli : tip === "hataAvi" ? gorevHataAvi : gorevAdimTamamla;
  const r = fn(q);
  return r || { ...q, gorev: "klasik" };
}

function cevapKontrol(kullanici, soru) {
  if (soru.gorev === "hataAvi") return Number(kullanici) === soru.bozukIdx;
  if (soru.gorev === "elemeli") return soru.secenekler[Number(kullanici)] && soru.secenekler[Number(kullanici)].dogru === true;
  return cevapDogruMu(kullanici, soru);
}
function hataTeshisGenel(kullanici, soru) {
  if (soru.gorev === "elemeli") {
    const s = soru.secenekler[Number(kullanici)];
    return s && s.tur ? s.tur : "hesap-hatasi";
  }
  if (soru.gorev === "hataAvi") return "dikkat-denetim";
  return hatayiTeshis(kullanici, soru);
}

/* ══════════════════════════════════════════════════════════════
   DEPOLAMA
   ══════════════════════════════════════════════════════════════ */

export {
  BECERILER, BID, KADEME_AD, HATA_TURU, GOREV_AD, GOREV_ACIKLAMA, OZELLIK_AD,
  goreveDonustur, cevapKontrol, cevapDogruMu, hataTeshisGenel, hatayiTeshis, esdeger, normalle,
  parcaMetin, guzel, ozellikCikar, eksi,
};
