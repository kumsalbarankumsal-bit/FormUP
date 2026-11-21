/* Küçük ifade değerlendirici (mathjs yerine). Desteklenen: sayılar, + − * / ^, parantez,
   tekli eksi, örtük çarpma (2x, x(x+1), xy), sqrt abs ln log exp sin cos tan, pi, e, değişkenler.
   Öncelik mathjs ile aynı: −2^2 = −4, üs sağdan bağlanır. */
const FN = {
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  log: (x, b) => (b === undefined ? Math.log(x) : Math.log(x) / Math.log(b)), log10: Math.log10,
};
const CONST = { pi: Math.PI, e: Math.E };

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (j < s.length && /[eE]/.test(s[j]) && /[0-9+-]/.test(s[j + 1] || "") && /[0-9]/.test(s[j + 2] || s[j + 1])) {
        j++; if (/[+-]/.test(s[j])) j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error("sayı");
      out.push({ t: "n", v }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z_0-9]/.test(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j) }); i = j; continue;
    }
    if ("+-*/^(),".includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error("karakter: " + c);
  }
  return out;
}

export function hesapla(src, vars = {}) {
  const tk = tokenize(String(src));
  let p = 0;
  const peek = () => tk[p];
  const eat = (t) => { if (!tk[p] || tk[p].t !== t) throw new Error("beklenen " + t); return tk[p++]; };
  const startsOperand = (x) => x && (x.t === "n" || x.t === "id" || x.t === "(");

  function expr() {
    let v = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = tk[p++].t;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const x = peek();
      if (x && (x.t === "*" || x.t === "/")) { p++; const r = unary(); v = x.t === "*" ? v * r : v / r; }
      else if (startsOperand(x)) v *= power(); // örtük çarpma
      else break;
    }
    return v;
  }
  function unary() {
    const x = peek();
    if (x && x.t === "-") { p++; return -unary(); }
    if (x && x.t === "+") { p++; return unary(); }
    return power();
  }
  function power() {
    const b = atom();
    if (peek() && peek().t === "^") { p++; return Math.pow(b, unary()); }
    return b;
  }
  function atom() {
    const x = tk[p++];
    if (!x) throw new Error("eksik");
    if (x.t === "n") return x.v;
    if (x.t === "(") { const v = expr(); eat(")"); return v; }
    if (x.t === "id") {
      const name = x.v;
      if (FN[name] && peek() && peek().t === "(") {
        p++;
        const args = [expr()];
        while (peek() && peek().t === ",") { p++; args.push(expr()); }
        eat(")");
        return FN[name](...args);
      }
      if (name in vars) return Number(vars[name]);
      if (name in CONST) return CONST[name];
      // çok harfli ad: tek harfli değişkenlerin çarpımı (xy = x·y)
      let prod = 1;
      for (const ch of name) {
        if (ch in vars) prod *= Number(vars[ch]);
        else if (/[0-9]/.test(ch)) throw new Error("ad");
        else throw new Error("tanımsız: " + ch);
      }
      return prod;
    }
    throw new Error("beklenmeyen " + x.t);
  }
  const v = expr();
  if (p !== tk.length) throw new Error("fazla");
  return v;
}
