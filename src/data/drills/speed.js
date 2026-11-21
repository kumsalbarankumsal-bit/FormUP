/* Hız ve hafıza soruları: zihinden işlem hızını ve AA SL formül hafızasını diri tutan,
   her seferinde yeni sayılarla üretilen kısa sorular.
   Her üreteç (r, lv) → { q, qe, a, n?, traps } döndürür:
     q / qe : soru (TR / EN), matematik $...$ içinde
     a      : doğru cevap (TeX)
     n      : doğru cevabın sayısal değeri (varsa; çeldirici üretmek için)
     traps  : [{ t: TeX, why: "tipik hata" }] — öğrencinin gerçek hatalarından türetilmiş çeldiriciler
   lv: 1 (ısınma) · 2 (orta) · 3 (zor). Süre hedefi saniye cinsindendir. */

const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const nz = (r, a, b) => { let v = 0; while (v === 0) v = ri(r, a, b); return v; };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
/** Sayıyı Türkçe ondalık virgülle TeX'e çevir */
export const num = (v, d = 6) => {
  const x = Math.round(v * 10 ** d) / 10 ** d;
  const s = String(Object.is(x, -0) ? 0 : x);
  return s.replace(".", "{,}");
};
const sgn = (v) => (v < 0 ? `(${num(v)})` : num(v));
const fr = (p, q) => {
  if (q < 0) { p = -p; q = -q; }
  const g = gcd(p, q); p /= g; q /= g;
  if (q === 1) return num(p);
  return p < 0 ? `-\\frac{${-p}}{${q}}` : `\\frac{${p}}{${q}}`;
};
const T = (t, why) => ({ t, why });
/** kπ/q sade biçimde */
const piFr = (k, q) => { const g = gcd(k, q); k /= g; q /= g; const c = k === 1 ? "" : k; return q === 1 ? `${c}\\pi` : `\\frac{${c}\\pi}{${q}}`; };
const co = (a) => (a === 1 ? "" : a === -1 ? "-" : String(a));
/** ax² + bx + c (sıfır terimler yazılmaz, ±1 katsayı gizlenir) */
const poly = (a, b, c) => {
  const parts = [];
  const add = (k, x) => {
    if (!k) return;
    const mag = Math.abs(k) === 1 && x ? "" : String(Math.abs(k));
    parts.push(parts.length ? `${k < 0 ? "-" : "+"} ${mag}${x}` : `${k < 0 ? "-" : ""}${mag}${x}`);
  };
  add(a, "x^2"); add(b, "x"); add(c, "");
  return parts.join(" ") || "0";
};

export const SPEED = [
  /* ---------- Zihinden dört işlem ---------- */
  { id: "add", tr: "Zihinden toplama", en: "Mental addition", sec: [6, 9, 12], gen: (r, lv) => {
    const [lo, hi] = lv === 1 ? [12, 99] : lv === 2 ? [101, 999] : [1001, 9999];
    const a = ri(r, lo, hi), b = ri(r, lo, hi);
    return { q: `$${a} + ${b}$`, qe: `$${a} + ${b}$`, a: num(a + b), n: a + b, traps: [T(num(a + b - 10), "Elde unutuldu"), T(num(a + b + 10), "Fazla elde")] };
  } },
  { id: "sub", tr: "Zihinden çıkarma", en: "Mental subtraction", sec: [7, 10, 14], gen: (r, lv) => {
    const [lo, hi] = lv === 1 ? [20, 99] : lv === 2 ? [100, 999] : [1000, 9999];
    const a = ri(r, lo, hi), b = ri(r, Math.floor(lo / 2), a - 1);
    return { q: `$${a} - ${b}$`, qe: `$${a} - ${b}$`, a: num(a - b), n: a - b, traps: [T(num(a - b + 10), "Onluk bozma unutuldu"), T(num(b - a), "İşaret ters")] };
  } },
  { id: "mul", tr: "Çarpım tablosu ve ötesi", en: "Times tables and beyond", sec: [4, 7, 12], gen: (r, lv) => {
    const a = lv === 1 ? ri(r, 2, 10) : lv === 2 ? ri(r, 6, 19) : ri(r, 12, 29);
    const b = lv === 1 ? ri(r, 2, 10) : lv === 2 ? ri(r, 3, 12) : ri(r, 11, 29);
    return { q: `$${a} \\times ${b}$`, qe: `$${a} \\times ${b}$`, a: num(a * b), n: a * b, traps: [T(num(a * (b - 1)), "Bir eksik grup"), T(num(a * b + a), "Bir fazla grup"), T(num(a + b), "Toplandı")] };
  } },
  { id: "mul2", tr: "Çok basamaklı çarpma", en: "Multi-digit multiplication", sec: [10, 15, 22], gen: (r, lv) => {
    const a = lv === 1 ? ri(r, 12, 99) : lv === 2 ? ri(r, 101, 999) : ri(r, 21, 99);
    const b = lv === 3 ? ri(r, 21, 99) : ri(r, 3, 9);
    return { q: `$${a} \\times ${b}$`, qe: `$${a} \\times ${b}$`, a: num(a * b), n: a * b, traps: [T(num(a * b - 10 * b), "Basamak kaydı"), T(num(a * b + 100), "Elde fazladan")] };
  } },
  { id: "div", tr: "Tam bölme", en: "Exact division", sec: [5, 8, 12], gen: (r, lv) => {
    const q = lv === 1 ? ri(r, 2, 12) : lv === 2 ? ri(r, 11, 40) : ri(r, 21, 99);
    const d = lv === 1 ? ri(r, 2, 10) : lv === 2 ? ri(r, 3, 15) : ri(r, 11, 25);
    const a = q * d;
    return { q: `$${a} \\div ${d}$`, qe: `$${a} \\div ${d}$`, a: num(q), n: q, traps: [T(num(q + 1), "Bir fazla"), T(num(a - d), "Çıkarıldı")] };
  } },
  { id: "signed", tr: "İşaretli sayılar", en: "Signed numbers", sec: [6, 9, 12], gen: (r, lv) => {
    const a = nz(r, -40, 40), b = nz(r, -40, 40);
    if (lv === 1) return { q: `$${a} + ${sgn(b)}$`, qe: `$${a} + ${sgn(b)}$`, a: num(a + b), n: a + b, traps: [T(num(a - b), "Eksinin eksisi karışıklığı"), T(num(-(a + b)), "İşaret ters")] };
    const x = nz(r, -12, 12), y = nz(r, -12, 12), z = nz(r, -9, 9);
    if (lv === 2) return { q: `$${sgn(x)} \\times ${sgn(y)}$`, qe: `$${sgn(x)} \\times ${sgn(y)}$`, a: num(x * y), n: x * y, traps: [T(num(-x * y), "İşaret kuralı")] };
    return { q: `$${sgn(x)} \\times ${sgn(y)} - ${sgn(z)}$`, qe: `$${sgn(x)} \\times ${sgn(y)} - ${sgn(z)}$`, a: num(x * y - z), n: x * y - z, traps: [T(num(x * y + z), "Eksi parantez"), T(num(x * (y - z)), "İşlem önceliği")] };
  } },
  { id: "bidmas", tr: "İşlem önceliği (hızlı)", en: "Order of operations (fast)", sec: [8, 12, 16], gen: (r, lv) => {
    const a = ri(r, 2, 20), b = ri(r, 2, 9), c = ri(r, 2, 9), d = ri(r, 1, 9);
    if (lv === 1) return { q: `$${a} + ${b} \\times ${c}$`, qe: `$${a} + ${b} \\times ${c}$`, a: num(a + b * c), n: a + b * c, traps: [T(num((a + b) * c), "Soldan sağa yapıldı")] };
    if (lv === 2) return { q: `$${a} - ${b}^2 + ${c}$`, qe: `$${a} - ${b}^2 + ${c}$`, a: num(a - b * b + c), n: a - b * b + c, traps: [T(num(a - b * b - c), "Eksi yayıldı"), T(num(a - 2 * b + c), "Kare yerine 2 ile çarpıldı")] };
    return { q: `$(${a} - ${b}) \\times ${c} - ${d} \\times 2^2$`, qe: `$(${a} - ${b}) \\times ${c} - ${d} \\times 2^2$`, a: num((a - b) * c - d * 4), n: (a - b) * c - d * 4, traps: [T(num(((a - b) * c - d) * 4), "Soldan sağa yapıldı")] };
  } },
  { id: "sq", tr: "Kareler", en: "Squares", sec: [4, 6, 10], gen: (r, lv) => {
    const n = lv === 1 ? ri(r, 2, 15) : lv === 2 ? ri(r, 13, 30) : pick(r, [ri(r, 31, 99), ri(r, 3, 9) * 10 + 5]);
    return { q: `$${n}^2$`, qe: `$${n}^2$`, a: num(n * n), n: n * n, traps: [T(num(2 * n), "2 ile çarpıldı"), T(num(n * n - n), "Bir eksik")] };
  } },
  { id: "cube", tr: "Küpler ve kuvvetler", en: "Cubes and powers", sec: [5, 8, 10], gen: (r, lv) => {
    if (lv === 1) { const n = ri(r, 2, 6); return { q: `$${n}^3$`, qe: `$${n}^3$`, a: num(n ** 3), n: n ** 3, traps: [T(num(3 * n), "3 ile çarpıldı"), T(num(n * n), "Kare alındı")] }; }
    if (lv === 2) { const k = ri(r, 3, 12); return { q: `$2^{${k}}$`, qe: `$2^{${k}}$`, a: num(2 ** k), n: 2 ** k, traps: [T(num(2 * k), "2 ile çarpıldı"), T(num(2 ** (k - 1)), "Bir kuvvet eksik")] }; }
    const b = pick(r, [3, 4, 5]), k = ri(r, 2, b === 3 ? 6 : 4);
    return { q: `$${b}^{${k}}$`, qe: `$${b}^{${k}}$`, a: num(b ** k), n: b ** k, traps: [T(num(b * k), "Taban ile üs çarpıldı"), T(num(k ** b), "Taban ve üs yer değişti")] };
  } },
  { id: "root", tr: "Kökler", en: "Roots", sec: [5, 7, 10], gen: (r, lv) => {
    if (lv < 3) { const n = lv === 1 ? ri(r, 2, 15) : ri(r, 11, 30); return { q: `$\\sqrt{${n * n}}$`, qe: `$\\sqrt{${n * n}}$`, a: num(n), n, traps: [T(num(n * n / 2), "İkiye bölündü")] }; }
    if (r() < 0.5) { const n = ri(r, 2, 10); return { q: `$\\sqrt[3]{${n ** 3}}$`, qe: `$\\sqrt[3]{${n ** 3}}$`, a: num(n), n, traps: [T(num(n ** 3 / 3), "Üçe bölündü")] }; }
    const k = pick(r, [2, 3, 5, 6, 7]), s = pick(r, [2, 3, 4, 5]);
    return { q: `$\\sqrt{${s * s * k}}$ sadeleştir`, qe: `Simplify $\\sqrt{${s * s * k}}$`, a: `${s}\\sqrt{${k}}`, traps: [T(`${s * s}\\sqrt{${k}}`, "Kök dışına kare çıkarıldı"), T(`${k}\\sqrt{${s}}`, "Ters ayrıldı"), T(`\\sqrt{${s * k}}`, "Yarım sadeleştirme")] };
  } },
  { id: "dec", tr: "Ondalık sayılar", en: "Decimals", sec: [7, 10, 14], gen: (r, lv) => {
    if (lv === 1) { const a = ri(r, 11, 99) / 10, b = ri(r, 11, 99) / 10; return { q: `$${num(a)} + ${num(b)}$`, qe: `$${a} + ${b}$`, a: num(a + b), n: a + b, traps: [T(num(a + b + 1), "Elde")] }; }
    if (lv === 2) { const a = ri(r, 2, 9) / 10, b = ri(r, 2, 9) / 10; return { q: `$${num(a)} \\times ${num(b)}$`, qe: `$${a} \\times ${b}$`, a: num(a * b), n: a * b, traps: [T(num(a * b * 10), "Virgül kaydı"), T(num(a * b * 100), "Virgül unutuldu")] }; }
    const a = ri(r, 12, 99) / 100, k = pick(r, [10, 100, 1000]);
    return { q: `$${num(a)} \\times ${k}$`, qe: `$${a} \\times ${k}$`, a: num(a * k), n: a * k, traps: [T(num(a * k / 10), "Bir basamak az kaydı"), T(num(a / k), "Bölündü")] };
  } },
  { id: "sci", tr: "Bilimsel gösterim", en: "Scientific notation", sec: [8, 11, 14], gen: (r, lv) => {
    const m = ri(r, 11, 99) / 10, e = lv === 1 ? ri(r, 2, 5) : lv === 2 ? -ri(r, 2, 5) : ri(r, 3, 8);
    if (lv < 3) { const v = m * 10 ** e; return { q: `$${num(m)} \\times 10^{${e}}$ = ?`, qe: `$${m} \\times 10^{${e}}$ = ?`, a: num(v, 8), n: v, traps: [T(num(m * 10 ** (e + 1), 8), "Bir basamak fazla"), T(num(m * 10 ** (e - 1), 8), "Bir basamak eksik")] }; }
    const n2 = ri(r, 2, 9), e2 = ri(r, 2, 6);
    const p = m * n2, pe = e + e2, nm = p >= 10 ? p / 10 : p, ne = p >= 10 ? pe + 1 : pe;
    return { q: `$(${num(m)} \\times 10^{${e}}) \\times (${n2} \\times 10^{${e2}})$`, qe: `$(${m} \\times 10^{${e}}) \\times (${n2} \\times 10^{${e2}})$`, a: `${num(nm)} \\times 10^{${ne}}`, traps: [T(`${num(nm)} \\times 10^{${e * e2}}`, "Üsler çarpıldı"), T(`${num(p)} \\times 10^{${pe}}`, "Standart biçime getirilmedi"), T(`${num(nm)} \\times 10^{${ne + 1}}`, "Bir kuvvet fazla")] };
  } },

  /* ---------- Kesir, yüzde, oran ---------- */
  { id: "fracof", tr: "Bir sayının kesri", en: "Fraction of a number", sec: [6, 9, 12], gen: (r, lv) => {
    const q = lv === 1 ? ri(r, 2, 5) : ri(r, 3, 12), p = ri(r, 1, q - 1), N = q * ri(r, 2, lv === 3 ? 40 : 12);
    return { q: `$${N}$ sayısının $\\frac{${p}}{${q}}$ kadarı`, qe: `$\\frac{${p}}{${q}}$ of $${N}$`, a: num(N * p / q), n: N * p / q, traps: [T(num(N / q), "Paya bakılmadı"), T(num(N * q / p), "Ters çevrildi")] };
  } },
  { id: "pct", tr: "Yüzde hesabı", en: "Percentages", sec: [6, 9, 12], gen: (r, lv) => {
    const p = lv === 1 ? pick(r, [10, 20, 25, 50, 75]) : pick(r, [5, 15, 30, 35, 40, 60, 12, 120, 150]);
    const N = pick(r, [20, 40, 60, 80, 120, 160, 200, 240, 300, 360, 400, 480, 500, 600, 800]) * (lv === 3 ? 3 : 1);
    if (lv < 3) return { q: `$${N}$ sayısının yüzde $${p}$ kadarı`, qe: `$${p}\\%$ of $${N}$`, a: num(N * p / 100), n: N * p / 100, traps: [T(num(N / p), "Yüzdeye bölündü"), T(num(N * p / 10), "Bir basamak kaydı")] };
    const up = r() < 0.5;
    return { q: `$${N}$, yüzde $${p}$ ${up ? "artarsa" : "azalırsa"} kaç olur?`, qe: `$${N}$ ${up ? "increased" : "decreased"} by $${p}\\%$?`, a: num(N * (1 + (up ? p : -p) / 100)), n: N * (1 + (up ? p : -p) / 100), traps: [T(num(N * p / 100), "Yalnızca değişim bulundu"), T(num(N * (1 + (up ? -p : p) / 100)), "Yön ters")] };
  } },
  { id: "fracop", tr: "Kesir işlemleri (hızlı)", en: "Fraction operations (fast)", sec: [10, 14, 18], gen: (r, lv) => {
    const b = ri(r, 2, 9), d = lv === 1 ? b : ri(r, 2, 9), a = ri(r, 1, b - 1 || 1), c = ri(r, 1, d - 1 || 1);
    const op = lv === 3 ? pick(r, ["\\times", "\\div"]) : pick(r, ["+", "-"]);
    let P, Q, trap;
    if (op === "+") { P = a * d + c * b; Q = b * d; trap = T(fr(a + c, b + d), "Paylar ve paydalar toplandı"); }
    else if (op === "-") { P = a * d - c * b; Q = b * d; trap = T(fr(a - c, Math.abs(b - d) || 1), "Paylar ve paydalar çıkarıldı"); }
    else if (op === "\\times") { P = a * c; Q = b * d; trap = T(fr(a * d, b * c), "Çapraz çarpıldı"); }
    else { P = a * d; Q = b * c; trap = T(fr(a * c, b * d), "Ters çevirmeden çarpıldı"); }
    return { q: `$\\frac{${a}}{${b}} ${op} \\frac{${c}}{${d}}$`, qe: `$\\frac{${a}}{${b}} ${op} \\frac{${c}}{${d}}$`, a: fr(P, Q), n: P / Q, traps: [trap] };
  } },
  { id: "conv", tr: "Kesir ↔ ondalık ↔ yüzde", en: "Fraction ↔ decimal ↔ percent", sec: [6, 8, 10], gen: (r, lv) => {
    const pairs = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [3, 20], [1, 25], [7, 25], [1, 50]];
    const [p, q] = pick(r, pairs);
    if (lv === 1) return { q: `$\\frac{${p}}{${q}}$ ondalık olarak`, qe: `$\\frac{${p}}{${q}}$ as a decimal`, a: num(p / q), n: p / q, traps: [T(num(q / p), "Ters bölündü"), T(num(p / q * 10), "Virgül kaydı")] };
    if (lv === 2) return { q: `$\\frac{${p}}{${q}}$ yüzde olarak`, qe: `$\\frac{${p}}{${q}}$ as a percentage`, a: `\\%${num(p / q * 100)}`, n: p / q * 100, traps: [T(`\\%${num(p / q * 10)}`, "Bir basamak eksik"), T(`\\%${num(p / q)}`, "100 ile çarpılmadı")] };
    return { q: `$${num(p / q)}$ kesir olarak (sade)`, qe: `$${p / q}$ as a simplified fraction`, a: fr(p, q), traps: [T(`\\frac{${Math.round(p / q * 100)}}{100}`, "Sadeleştirilmedi"), T(fr(q, p), "Ters çevrildi")] };
  } },
  { id: "ratio", tr: "Oran ve paylaştırma", en: "Ratio and sharing", sec: [9, 12, 15], gen: (r, lv) => {
    const a = ri(r, 1, 5), b = ri(r, 1, 6), k = ri(r, 2, lv === 3 ? 30 : 12), T0 = (a + b) * k;
    return { q: `$${T0}$, $${a}:${b}$ oranında paylaşılıyor. Büyük pay?`, qe: `Share $${T0}$ in the ratio $${a}:${b}$. Larger share?`, a: num(Math.max(a, b) * k), n: Math.max(a, b) * k, traps: [T(num(T0 / Math.max(a, b)), "Orana bölündü"), T(num(Math.min(a, b) * k), "Küçük pay")] };
  } },

  /* ---------- Sayı teorisi ---------- */
  { id: "gcd", tr: "EBOB (HCF)", en: "Highest common factor", sec: [8, 11, 15], gen: (r, lv) => {
    const g = ri(r, 2, lv === 1 ? 9 : 25), x = ri(r, 2, 9), y = ri(r, 2, 9);
    const a = g * x, b = g * (gcd(x, y) === 1 ? y : y + 1 === x ? y + 2 : y + 1);
    const G = gcd(a, b);
    return { q: `$\\text{EBOB}(${a}, ${b})$`, qe: `$\\text{HCF}(${a}, ${b})$`, a: num(G), n: G, traps: [T(num(lcm(a, b)), "EKOK bulundu")] };
  } },
  { id: "lcm", tr: "EKOK (LCM)", en: "Lowest common multiple", sec: [8, 11, 15], gen: (r, lv) => {
    const a = ri(r, 2, lv === 1 ? 12 : 30), b = ri(r, 2, lv === 1 ? 12 : 30);
    return { q: `$\\text{EKOK}(${a}, ${b})$`, qe: `$\\text{LCM}(${a}, ${b})$`, a: num(lcm(a, b)), n: lcm(a, b), traps: [T(num(gcd(a, b)), "EBOB bulundu"), ...(lcm(a, b) !== a * b ? [T(num(a * b), "Doğrudan çarpıldı")] : [])] };
  } },
  { id: "prime", tr: "Asal mı?", en: "Is it prime?", sec: [6, 8, 10], gen: (r, lv) => {
    const isP = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    const hi = lv === 1 ? 50 : lv === 2 ? 150 : 400;
    const want = r() < 0.5;
    let n = ri(r, 11, hi);
    for (let i = 0; i < 500 && isP(n) !== want; i++) n = ri(r, 11, hi);
    if (!want && n % 2 === 0) n += isP(n + 1) ? 2 : 1; // çift olmayan bileşikleri tercih et
    const p = isP(n);
    let f = 0; if (!p) for (let i = 2; i * i <= n; i++) if (n % i === 0) { f = i; break; }
    return { q: `$${n}$ asal mı?`, qe: `Is $${n}$ prime?`, a: p ? "\\text{Evet, asal}" : `\\text{Hayır} \\; (${f} \\times ${n / f})`, traps: p ? [T("\\text{Hayır}", "Asal sayı bileşik sanıldı")] : [T("\\text{Evet, asal}", "Bölen kaçırıldı")], tf: true };
  } },
  { id: "divis", tr: "Bölünebilme (hızlı)", en: "Divisibility (fast)", sec: [6, 8, 10], gen: (r, lv) => {
    const d = pick(r, lv === 1 ? [2, 3, 5, 10] : lv === 2 ? [3, 4, 6, 9] : [4, 6, 8, 9, 11]);
    const nums = [];
    const good = d * ri(r, lv === 1 ? 11 : 101, lv === 1 ? 99 : 999);
    nums.push(good);
    while (nums.length < 4) { const x = ri(r, lv === 1 ? 20 : 200, lv === 1 ? 999 : 9999); if (x % d !== 0 && !nums.includes(x)) nums.push(x); }
    return { q: `Hangisi $${d}$ ile tam bölünür?`, qe: `Which is divisible by $${d}$?`, a: num(good), opts: nums.map((x) => ({ t: num(x), ok: x === good })) };
  } },

  /* ---------- Cebir ---------- */
  { id: "lin", tr: "Tek adımda denklem", en: "Quick equations", sec: [8, 12, 16], gen: (r, lv) => {
    const x = nz(r, -12, 12), a = lv === 1 ? 1 : nz(r, -9, 9), b = nz(r, -20, 20), c = a * x + b;
    const lhs = `${a === 1 ? "" : a === -1 ? "-" : a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
    return { q: `$${lhs} = ${c}$ ise $x$?`, qe: `$${lhs} = ${c}$, find $x$`, a: num(x), n: x, traps: [T(num((c + b) / a), "Sabitin işareti"), T(num(c - b), "Katsayıya bölünmedi")] };
  } },
  { id: "subst", tr: "Değer yerine koyma", en: "Substitution", sec: [8, 12, 16], gen: (r, lv) => {
    const a = nz(r, -5, 5), b = ri(r, -9, 9), c = ri(r, -9, 9), x = nz(r, -5, 5);
    const v = a * x * x + b * x + c;
    const f = poly(a, b, c);
    return { q: `$f(x) = ${f}$ ise $f(${x})$`, qe: `$f(x) = ${f}$, find $f(${x})$`, a: num(v), n: v, traps: [T(num(-a * x * x + b * x + c), "Negatifin karesi"), T(num(a * 2 * x + b * x + c), "Kare yerine 2x")] };
  } },
  { id: "explaw", tr: "Üs kuralları", en: "Laws of exponents", sec: [7, 10, 13], gen: (r, lv) => {
    const b = pick(r, ["x", "a", "2", "3", "y"]), m = ri(r, 2, 9), n = ri(r, 2, 9);
    const k = lv === 1 ? 0 : lv === 2 ? 1 : 2;
    if (k === 0) return { q: `$${b}^{${m}} \\cdot ${b}^{${n}} = ${b}^{?}$`, qe: `$${b}^{${m}} \\cdot ${b}^{${n}} = ${b}^{?}$`, a: num(m + n), n: m + n, traps: [T(num(m * n), "Üsler çarpıldı")] };
    if (k === 1) return { q: `$(${b}^{${m}})^{${n}} = ${b}^{?}$`, qe: `$(${b}^{${m}})^{${n}} = ${b}^{?}$`, a: num(m * n), n: m * n, traps: [T(num(m + n), "Üsler toplandı"), T(num(m ** n), "Üs kuvvete alındı")] };
    return { q: `$\\dfrac{${b}^{${m}}}{${b}^{${n}}} = ${b}^{?}$`, qe: `$\\dfrac{${b}^{${m}}}{${b}^{${n}}} = ${b}^{?}$`, a: num(m - n), n: m - n, traps: [T(num(n - m), "Ters çıkarıldı"), T(num(m / n), "Üsler bölündü")] };
  } },
  { id: "quad", tr: "Kökleri bul (çarpanlara ayır)", en: "Roots by factorising", sec: [12, 16, 22], gen: (r, lv) => {
    const p = nz(r, -9, 9), q = nz(r, -9, 9), a = lv === 3 ? pick(r, [2, 3]) : 1;
    const B = -a * (p + q), C = a * p * q;
    const s = (v, x = "") => `${v < 0 ? "-" : "+"} ${Math.abs(v) === 1 && x ? "" : Math.abs(v)}${x}`;
    const poly = `${a === 1 ? "" : a}x^2 ${B ? s(B, "x") : ""} ${s(C)}`;
    const rs = [p, q].sort((u, v) => u - v);
    return { q: `$${poly} = 0$ kökleri`, qe: `Roots of $${poly} = 0$`, a: `${rs[0]}, \\; ${rs[1]}`, traps: [T(`${-rs[1]}, \\; ${-rs[0]}`, "İşaretler ters"), T(`${rs[0] + 1}, \\; ${rs[1] - 1}`, "Çarpanlar yanlış"), T(`${-rs[0]}, \\; ${rs[1]}`, "Bir işaret ters")] };
  } },
  { id: "disc", tr: "Diskriminant", en: "Discriminant", sec: [10, 13, 16], gen: (r, lv) => {
    const a = nz(r, -4, 5), b = ri(r, -9, 9), c = ri(r, -9, 9), D = b * b - 4 * a * c;
    const P = poly(a, b, c);
    if (lv < 3) return { q: `$${P}$ için $\\Delta$`, qe: `$\\Delta$ for $${P}$`, a: num(D), n: D, traps: [T(num(b * b + 4 * a * c), "4ac işareti"), T(num(-b * b - 4 * a * c), "b² işareti")] };
    const k = D > 0 ? "\\text{2 gerçek kök}" : D === 0 ? "\\text{1 (çift) kök}" : "\\text{Gerçek kök yok}";
    return { q: `$${P} = 0$ kaç gerçek kök?`, qe: `How many real roots: $${P} = 0$?`, a: k, opts: ["\\text{2 gerçek kök}", "\\text{1 (çift) kök}", "\\text{Gerçek kök yok}"].map((t) => ({ t, ok: t === k })) };
  } },
  { id: "vertex", tr: "Simetri ekseni", en: "Axis of symmetry", sec: [8, 11, 14], gen: (r, lv) => {
    const a = nz(r, -4, 4), h = nz(r, -6, 6), b = -2 * a * h, c = ri(r, -9, 9);
    const P = poly(a, b, c);
    return { q: `$y = ${P}$ simetri ekseni $x = ?$`, qe: `Axis of symmetry of $y = ${P}$`, a: num(h), n: h, traps: [T(num(-h), "Eksi unutuldu"), T(num(b / a), "2a yerine a")] };
  } },

  /* ---------- Logaritma ---------- */
  { id: "log", tr: "Logaritma değerleri", en: "Log values", sec: [7, 10, 13], gen: (r, lv) => {
    if (lv === 1) { const b = pick(r, [2, 3, 5, 10]), k = ri(r, 0, b === 2 ? 8 : 4); return { q: `$\\log_{${b}} ${b ** k}$`, qe: `$\\log_{${b}} ${b ** k}$`, a: num(k), n: k, traps: [T(num(b ** k / b), "Tabana bölündü")] }; }
    if (lv === 2) { const b = pick(r, [2, 3, 10]), k = ri(r, 1, 4); return { q: `$\\log_{${b}} \\frac{1}{${b ** k}}$`, qe: `$\\log_{${b}} \\frac{1}{${b ** k}}$`, a: num(-k), n: -k, traps: [T(num(k), "Eksi unutuldu"), T(fr(1, k), "Ters alındı")] }; }
    const b = pick(r, [2, 3]), m = ri(r, 1, 4), n = ri(r, 1, 4);
    return { q: `$\\log_{${b}} ${b ** m} + \\log_{${b}} ${b ** n}$`, qe: `$\\log_{${b}} ${b ** m} + \\log_{${b}} ${b ** n}$`, a: num(m + n), n: m + n, traps: [T(num(m * n), "Çarpıldı")] };
  } },
  { id: "logeq", tr: "Üslü denklem", en: "Exponential equations", sec: [9, 12, 15], gen: (r, lv) => {
    const b = pick(r, lv === 1 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6, 7, 10]), x = lv === 1 ? ri(r, 1, b > 5 ? 3 : 6) : ri(r, -3, b > 5 ? 3 : 6), k = lv === 3 ? ri(r, 2, 3) : 1;
    const rhs = x >= 0 ? `${b ** (k * x)}` : `\\frac{1}{${b ** (-k * x)}}`;
    const lhs = k === 1 ? `${b}^x` : `${b}^{${k}x}`;
    return { q: `$${lhs} = ${rhs}$ ise $x$`, qe: `$${lhs} = ${rhs}$, find $x$`, a: num(x), n: x, traps: [T(num(k * x), "Katsayı unutuldu"), T(num(-x), "İşaret")] };
  } },

  /* ---------- Trigonometri ---------- */
  { id: "trig", tr: "Özel açılar", en: "Exact trig values", sec: [6, 9, 12], gen: (r, lv) => {
    const V = { 0: ["0", "1", "0"], 30: ["\\frac{1}{2}", "\\frac{\\sqrt{3}}{2}", "\\frac{1}{\\sqrt{3}}"], 45: ["\\frac{\\sqrt{2}}{2}", "\\frac{\\sqrt{2}}{2}", "1"], 60: ["\\frac{\\sqrt{3}}{2}", "\\frac{1}{2}", "\\sqrt{3}"], 90: ["1", "0", "\\text{tanımsız}"] };
    const neg = (t) => (t === "0" ? "0" : t.startsWith("\\text") ? t : `-${t}`);
    const f = pick(r, [0, 1, lv === 1 ? 0 : 2]), fn = ["\\sin", "\\cos", "\\tan"][f];
    let ang = pick(r, [0, 30, 45, 60, 90]), shown = ang, val = V[ang][f];
    if (lv >= 2) {
      const q = pick(r, [1, 2, 3, 4]);
      shown = q === 1 ? ang : q === 2 ? 180 - ang : q === 3 ? 180 + ang : 360 - ang;
      const signs = { 1: [1, 1, 1], 2: [1, -1, -1], 3: [-1, -1, 1], 4: [-1, 1, -1] }[q];
      if (signs[f] < 0) val = neg(val);
    }
    const rad = lv === 3 && shown % 30 === 0 || lv === 3 && shown % 45 === 0;
    const toRad = (d) => { const g = gcd(d, 180); const p = d / g, q = 180 / g; return d === 0 ? "0" : `\\frac{${p === 1 ? "" : p}\\pi}{${q}}`.replace("\\frac{\\pi}{1}", "\\pi").replace(/\\frac\{(\d+)\\pi\}\{1\}/, "$1\\pi"); };
    const arg = rad ? toRad(shown) : `${shown}^\\circ`;
    const pool = ["0", "1", "\\frac{1}{2}", "\\frac{\\sqrt{2}}{2}", "\\frac{\\sqrt{3}}{2}", "\\sqrt{3}", "\\frac{1}{\\sqrt{3}}"];
    const wrongs = [...pool, ...pool.map(neg)].filter((t, i, a) => t !== val && a.indexOf(t) === i);
    return { q: `$${fn} ${arg}$`, qe: `$${fn} ${arg}$`, a: val, traps: [T(neg(val) !== val ? neg(val) : pick(r, wrongs), "İşaret (bölge) hatası"), T(V[ang][f === 0 ? 1 : 0], f === 2 ? "tan yerine sin" : "sin ile cos karıştı")].filter((x) => x.t !== val), pool: wrongs };
  } },
  { id: "rad", tr: "Derece ↔ radyan", en: "Degrees ↔ radians", sec: [6, 9, 12], gen: (r, lv) => {
    const d = pick(r, lv === 1 ? [30, 45, 60, 90, 180, 360] : [120, 135, 150, 210, 225, 240, 270, 300, 315, 330, 720]);
    const g = gcd(d, 180), p = d / g, q = 180 / g;
    const t = q === 1 ? `${p === 1 ? "" : p}\\pi` : `\\frac{${p === 1 ? "" : p}\\pi}{${q}}`;
    if (r() < 0.5 || lv === 1) return { q: `$${d}^\\circ$ kaç radyan?`, qe: `$${d}^\\circ$ in radians`, a: t, traps: [T(`\\frac{${q}\\pi}{${p}}`, "Ters çevrildi"), T(`\\frac{${p}\\pi}{${q * 2}}`, "Yarısı alındı")] };
    return { q: `$${t}$ kaç derece?`, qe: `$${t}$ in degrees`, a: `${d}^\\circ`, n: d, traps: [T(`${d / 2}^\\circ`, "Yarısı"), T(`${d * 2}^\\circ`, "İki katı")] };
  } },
  { id: "arc", tr: "Yay ve dilim", en: "Arc and sector", sec: [10, 13, 16], gen: (r, lv) => {
    const rr = ri(r, 2, 12), d = pick(r, [30, 45, 60, 90, 120, 180]);
    const g = gcd(d, 180), p = d / g, q = 180 / g;
    // θ = pπ/q;  yay = r·θ,  dilim = ½·r²·θ
    if (lv < 3) return { q: `$r = ${rr}$, $\\theta = ${d}^\\circ$ yay uzunluğu`, qe: `Arc length, $r = ${rr}$, $\\theta = ${d}^\\circ$`, a: piFr(rr * p, q), traps: [T(num(rr * d), "Derece radyana çevrilmedi"), T(piFr(2 * rr * p, q), "2 fazladan"), T(piFr(rr * rr * p, 2 * q), "Dilim alanı bulundu")] };
    return { q: `$r = ${rr}$, $\\theta = ${d}^\\circ$ dilim alanı`, qe: `Sector area, $r = ${rr}$, $\\theta = ${d}^\\circ$`, a: piFr(rr * rr * p, 2 * q), traps: [T(piFr(rr * rr * p, q), "½ unutuldu"), T(piFr(rr * p, q), "Yay uzunluğu bulundu")] };
  } },

  /* ---------- Diziler, olasılık, istatistik ---------- */
  { id: "arith", tr: "Aritmetik dizi", en: "Arithmetic sequence", sec: [9, 12, 15], gen: (r, lv) => {
    const u1 = ri(r, -10, 20), d = nz(r, -7, 9), n = ri(r, lv === 1 ? 5 : 10, lv === 3 ? 60 : 25);
    if (lv < 3) return { q: `$u_1 = ${u1}$, $d = ${d}$ ise $u_{${n}}$`, qe: `$u_1 = ${u1}$, $d = ${d}$, find $u_{${n}}$`, a: num(u1 + (n - 1) * d), n: u1 + (n - 1) * d, traps: [T(num(u1 + n * d), "n − 1 yerine n"), T(num(u1 * n + d), "Karıştı")] };
    const S = n * (2 * u1 + (n - 1) * d) / 2;
    return { q: `$u_1 = ${u1}$, $d = ${d}$ ise $S_{${n}}$`, qe: `$u_1 = ${u1}$, $d = ${d}$, find $S_{${n}}$`, a: num(S), n: S, traps: [T(num(n * (2 * u1 + n * d) / 2), "n − 1 yerine n"), T(num(n * (u1 + (n - 1) * d)), "2 ile bölünmedi")] };
  } },
  { id: "geom", tr: "Geometrik dizi", en: "Geometric sequence", sec: [9, 12, 15], gen: (r, lv) => {
    const u1 = nz(r, -5, 6), rr = pick(r, lv === 1 ? [2, 3] : [2, 3, -2, -3]), n = ri(r, 3, lv === 1 ? 6 : 8);
    if (lv < 3) return { q: `$u_1 = ${u1}$, $r = ${rr}$ ise $u_{${n}}$`, qe: `$u_1 = ${u1}$, $r = ${rr}$, find $u_{${n}}$`, a: num(u1 * rr ** (n - 1)), n: u1 * rr ** (n - 1), traps: [T(num(u1 * rr ** n), "n − 1 yerine n"), T(num(u1 + (n - 1) * rr), "Aritmetik sanıldı")] };
    const a = ri(r, 2, 30) * 2, q = pick(r, [[1, 2], [1, 3], [2, 3], [1, 4], [-1, 2]]);
    const S = a / (1 - q[0] / q[1]);
    return { q: `$u_1 = ${a}$, $r = ${fr(q[0], q[1])}$ ise $S_\\infty$`, qe: `$u_1 = ${a}$, $r = ${fr(q[0], q[1])}$, find $S_\\infty$`, a: fr(a * q[1], q[1] - q[0]), n: S, traps: [T(fr(a * q[1], q[1] + q[0]), "1 + r"), T(num(a * q[0] / q[1]), "u₁·r")] };
  } },
  { id: "ncr", tr: "Sayma: kombinasyon, permütasyon", en: "Counting: nCr, nPr", sec: [8, 11, 14], gen: (r, lv) => {
    const n = ri(r, lv === 1 ? 4 : 6, lv === 3 ? 15 : 10), k = ri(r, 1, Math.min(lv === 1 ? 3 : 5, n - 1));
    let C = 1; for (let i = 0; i < k; i++) C = C * (n - i) / (i + 1);
    let P = 1; for (let i = 0; i < k; i++) P *= (n - i);
    const kind = lv === 1 ? 0 : ri(r, 0, 2);
    if (kind === 0) return { q: `$\\binom{${n}}{${k}}$`, qe: `$\\binom{${n}}{${k}}$`, a: num(C), n: C, traps: [T(num(P), "Permütasyon (k! bölünmedi)"), T(num(n * k), "n·k")] };
    if (kind === 1) return { q: `$${n}$ kişiden $${k}$ kişilik bir ekip kaç farklı şekilde seçilir?`, qe: `Choose a team of $${k}$ from $${n}$ people: how many ways?`, a: num(C), n: C, traps: [T(num(P), "Sıra önemli sanıldı")] };
    return { q: `$${n}$ kişiden başkan, yardımcı${k >= 3 ? " ve sekreter" : ""} kaç farklı şekilde seçilir?`, qe: `From $${n}$ people choose ${k >= 3 ? "a chair, deputy and secretary" : "a chair and a deputy"}: how many ways?`, a: num(k >= 3 ? n * (n - 1) * (n - 2) : n * (n - 1)), n: k >= 3 ? n * (n - 1) * (n - 2) : n * (n - 1), traps: [T(num(k >= 3 ? n * (n - 1) * (n - 2) / 6 : n * (n - 1) / 2), "Sıra önemsiz sanıldı")] };
  } },
  { id: "mean", tr: "Ortalama ve ortanca", en: "Mean and median", sec: [10, 14, 18], gen: (r, lv) => {
    const L = Array.from({ length: lv === 1 ? 5 : lv === 2 ? 6 : 7 }, () => ri(r, 1, 30));
    const s = [...L].sort((a, b) => a - b), m = L.reduce((a, b) => a + b, 0) / L.length;
    const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    if (r() < 0.5) return { q: `Ortalama: $${L.join(",\\ ")}$`, qe: `Mean of $${L.join(",\\ ")}$`, a: num(m, 3), n: m, traps: [T(num(med), "Ortanca bulundu")] };
    return { q: `Ortanca: $${L.join(",\\ ")}$`, qe: `Median of $${L.join(",\\ ")}$`, a: num(med), n: med, traps: [T(num(L[Math.floor(L.length / 2)]), "Sıralamadan orta alındı"), ...(Math.abs(m - med) > 0.01 ? [T(num(m, 3), "Ortalama bulundu")] : [])] };
  } },
  { id: "prob", tr: "Olasılık (zar, para, torba)", en: "Probability (dice, coins, bags)", sec: [9, 12, 15], gen: (r, lv) => {
    if (lv === 1) {
      const kind = ri(r, 0, 2);
      if (kind === 0) { const k = ri(r, 1, 5), more = r() < 0.5; const c = more ? 6 - k : k; return { q: `Bir zar: $${more ? `>${k}` : `\\le ${k}`}$ gelme olasılığı`, qe: `One die: P(${more ? `>${k}` : `≤ ${k}`})`, a: fr(c, 6), n: c / 6, traps: [T(fr(6 - c, 6), "Tümleyen"), T(fr(c, 5), "Payda 5")] }; }
      const red = ri(r, 1, 12), blue = ri(r, 1, 12), green = kind === 2 ? ri(r, 1, 9) : 0, tot = red + blue + green;
      return { q: `Torbada $${red}$ kırmızı, $${blue}$ mavi${green ? `, $${green}$ yeşil` : ""} top. Kırmızı çekme olasılığı?`, qe: `Bag: $${red}$ red, $${blue}$ blue${green ? `, $${green}$ green` : ""}. P(red)?`, a: fr(red, tot), n: red / tot, traps: [T(fr(red, blue + green), "Payda: diğerleri"), T(fr(blue + green, tot), "Tümleyen")] };
    }
    if (lv === 2) {
      const kind = ri(r, 0, 2);
      if (kind === 0) { const s2 = ri(r, 2, 12); let c = 0; for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (i + j === s2) c++; return { q: `İki zar: toplam $${s2}$ olasılığı`, qe: `Two dice: P(sum $= ${s2}$)`, a: fr(c, 36), n: c / 36, traps: [T(fr(1, 11), "11 eşit sonuç sanıldı"), T(fr(c, 12), "Payda 12")] }; }
      if (kind === 1) { const d = ri(r, 0, 5); let c = 0; for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (Math.abs(i - j) === d) c++; return { q: `İki zar: farkın $${d}$ olma olasılığı`, qe: `Two dice: P(difference $= ${d}$)`, a: fr(c, 36), n: c / 36, traps: [T(fr(1, 6), "Eşit sanıldı"), T(fr(c, 18), "Sıra iki kez sayıldı")] }; }
      const a = ri(r, 2, 9), b = ri(r, 2, 9), n = a + b;
      return { q: `$${a}$ kırmızı, $${b}$ mavi top; iadesiz 2 çekiliş: ikisi de kırmızı?`, qe: `$${a}$ red, $${b}$ blue; two draws without replacement: P(both red)?`, a: fr(a * (a - 1), n * (n - 1)), n: a * (a - 1) / (n * (n - 1)), traps: [T(fr(a * a, n * n), "İade edildi sanıldı"), T(fr(a, n), "Tek çekiliş")] };
    }
    const n = ri(r, 2, 7), k = ri(r, 0, n);
    if (r() < 0.4) return { q: `$${n}$ para atılıyor: en az bir tura`, qe: `$${n}$ coins: P(at least one head)`, a: fr(2 ** n - 1, 2 ** n), n: 1 - 1 / 2 ** n, traps: [T(fr(1, 2 ** n), "Hiç tura gelmemesi"), T(fr(n, 2 ** n), "Tam bir tura")] };
    let C = 1; for (let i = 0; i < k; i++) C = C * (n - i) / (i + 1);
    return { q: `$${n}$ para: tam $${k}$ tura olasılığı`, qe: `$${n}$ coins: P(exactly $${k}$ heads)`, a: fr(C, 2 ** n), n: C / 2 ** n, traps: [T(fr(1, 2 ** n), "Kombinasyon unutuldu"), T(fr(k, n), "k/n sanıldı")] };
  } },

  /* ---------- Analitik geometri ---------- */
  { id: "slope", tr: "Eğim", en: "Gradient", sec: [9, 12, 15], gen: (r, lv) => {
    const x1 = ri(r, -6, 6), y1 = ri(r, -6, 6), dx = nz(r, -6, 6), dy = ri(r, -9, 9);
    return { q: `$(${x1}, ${y1})$ ve $(${x1 + dx}, ${y1 + dy})$ eğimi`, qe: `Gradient through $(${x1}, ${y1})$ and $(${x1 + dx}, ${y1 + dy})$`, a: fr(dy, dx), n: dy / dx, traps: [T(dy === 0 ? "\\text{tanımsız}" : fr(dx, dy), "Ters bölündü"), T(fr(-dy, dx), "İşaret")] };
  } },
  { id: "dist", tr: "Uzaklık ve orta nokta", en: "Distance and midpoint", sec: [10, 13, 16], gen: (r, lv) => {
    const [a, b, c] = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]]);
    const x1 = ri(r, -5, 5), y1 = ri(r, -5, 5), sx = pick(r, [1, -1]), sy = pick(r, [1, -1]);
    const x2 = x1 + sx * a, y2 = y1 + sy * b;
    if (lv < 3) return { q: `$(${x1}, ${y1})$ ile $(${x2}, ${y2})$ arası uzaklık`, qe: `Distance between $(${x1}, ${y1})$ and $(${x2}, ${y2})$`, a: num(c), n: c, traps: [T(num(a + b), "Kök alınmadan toplandı"), T(num(c * c), "Kök alınmadı")] };
    return { q: `$(${x1}, ${y1})$ ile $(${x2}, ${y2})$ orta noktası`, qe: `Midpoint of $(${x1}, ${y1})$ and $(${x2}, ${y2})$`, a: `(${num((x1 + x2) / 2)}, ${num((y1 + y2) / 2)})`, traps: [T(`(${num((x2 - x1) / 2)}, ${num((y2 - y1) / 2)})`, "Farkın yarısı"), T(`(${x1 + x2}, ${y1 + y2})`, "2'ye bölünmedi")] };
  } },
  { id: "area", tr: "Alan ve hacim", en: "Area and volume", sec: [9, 12, 15], gen: (r, lv) => {
    const k = ri(r, 0, 2), a = ri(r, 2, 15), b = ri(r, 2, 15), h = ri(r, 2, 12);
    if (lv === 1) return k ? { q: `Taban $${a}$, yükseklik $${b}$ üçgen alanı`, qe: `Triangle: base $${a}$, height $${b}$`, a: num(a * b / 2), n: a * b / 2, traps: [T(num(a * b), "½ unutuldu")] }
      : { q: `Kenarları $${a}$ ve $${b}$ dikdörtgen alanı`, qe: `Rectangle $${a} \\times ${b}$ area`, a: num(a * b), n: a * b, traps: [T(num(2 * (a + b)), "Çevre bulundu")] };
    if (lv === 2) return { q: `Yarıçap $${h}$ daire alanı`, qe: `Circle radius $${h}$: area`, a: `${h * h}\\pi`, traps: [T(`${2 * h}\\pi`, "Çevre bulundu"), T(`${h * h * 2}\\pi`, "2πr² sanıldı")] };
    return k ? { q: `$r = ${a}$, $h = ${h}$ silindir hacmi`, qe: `Cylinder $r = ${a}$, $h = ${h}$: volume`, a: `${a * a * h}\\pi`, traps: [T(`${2 * a * h}\\pi`, "Yanal alan")] }
      : { q: `$r = ${a}$, $h = ${h}$ koni hacmi`, qe: `Cone $r = ${a}$, $h = ${h}$: volume`, a: (a * a * h) % 3 === 0 ? `${a * a * h / 3}\\pi` : `\\frac{${a * a * h}\\pi}{3}`, traps: [T(`${a * a * h}\\pi`, "⅓ unutuldu")] };
  } },

  /* ---------- Kalkülüs ---------- */
  { id: "deriv", tr: "Türev (hızlı)", en: "Derivatives (fast)", sec: [8, 11, 15], gen: (r, lv) => {
    const a = nz(r, -9, 9), n = ri(r, 2, 7);
    if (lv === 1) {
      const co_n = a * n, ex = n - 1;
      const ans = `${co(co_n)}x${ex === 1 ? "" : `^{${ex}}`}`;
      return { q: `$\\frac{d}{dx}\\left(${co(a)}x^{${n}}\\right)$`, qe: `$\\frac{d}{dx}\\left(${co(a)}x^{${n}}\\right)$`, a: ans, traps: [T(`${co(a)}x${n - 1 === 1 ? "" : `^{${n - 1}}`}`, "Üs öne getirilmedi"), T(`${co(co_n)}x^{${n}}`, "Üs azaltılmadı"), T(`${co(co_n)}x^{${n + 1}}`, "Üs arttırıldı")].filter((x) => x.t !== ans) };
    }
    const x = nz(r, -3, 3), b = ri(r, -9, 9);
    if (lv === 2) { const v = a * n * x ** (n - 1) + b; return { q: `$f(x) = ${a}x^{${n}} ${b < 0 ? "-" : "+"} ${Math.abs(b)}x$ ise $f'(${x})$`, qe: `$f(x) = ${a}x^{${n}} ${b < 0 ? "-" : "+"} ${Math.abs(b)}x$, find $f'(${x})$`, a: num(v), n: v, traps: [T(num(a * x ** n + b * x), "f(x) hesaplandı"), T(num(a * n * x ** n + b), "Üs azaltılmadı")] }; }
    const f = pick(r, [["\\sin x", "\\cos x", "-\\cos x"], ["\\cos x", "-\\sin x", "\\sin x"], ["e^{x}", "e^{x}", "xe^{x-1}"], ["\\ln x", "\\frac{1}{x}", "\\ln x"], [`e^{${n}x}`, `${n}e^{${n}x}`, `e^{${n}x}`], [`\\sin ${n}x`, `${n}\\cos ${n}x`, `\\cos ${n}x`]]);
    return { q: `$\\frac{d}{dx}\\left(${f[0]}\\right)$`, qe: `$\\frac{d}{dx}\\left(${f[0]}\\right)$`, a: f[1], traps: [T(f[2], "Tipik hata"), T(f[1].startsWith("-") ? f[1].slice(1) : `-${f[1]}`, "İşaret")].filter((x) => x.t !== f[1]) };
  } },
  { id: "integ", tr: "İntegral (hızlı)", en: "Integrals (fast)", sec: [10, 14, 18], gen: (r, lv) => {
    const n = ri(r, 1, 6), a = (n + 1) * nz(r, -4, 5);
    if (lv < 3) {
      const co = a / (n + 1);
      const ans = `${co === 1 ? "" : co === -1 ? "-" : co}x^{${n + 1}} + C`;
      return { q: `$\\int ${a}x^{${n}} \\, dx$`, qe: `$\\int ${a}x^{${n}} \\, dx$`, a: ans, traps: [T(`${a * n}x^{${n - 1}} + C`, "Türev alındı"), T(`${a}x^{${n + 1}} + C`, "n + 1'e bölünmedi"), T(`${co}x^{${n}} + C`, "Üs arttırılmadı")].filter((x) => x.t !== ans) };
    }
    const b = ri(r, 1, 3), c = ri(r, 0, b - 1), k = nz(r, 1, 4) * 2;
    const v = (k / 2) * (b * b - c * c);
    return { q: `$\\int_{${c}}^{${b}} ${k}x \\, dx$`, qe: `$\\int_{${c}}^{${b}} ${k}x \\, dx$`, a: num(v), n: v, traps: [T(num(k * (b - c)), "İntegral alınmadan"), T(num(k * (b * b - c * c)), "2'ye bölünmedi")] };
  } },
];

export const SPEED_BY_ID = Object.fromEntries(SPEED.map((s) => [s.id, s]));
