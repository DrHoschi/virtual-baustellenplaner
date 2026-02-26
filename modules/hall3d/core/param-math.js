/**
 * modules/hall3d/core/param-math.js
 * Version: v1.0.0 (2026-02-26)
 *
 * Zweck:
 * - Mini-Expression-Engine für BOM/Kosten-Rechnungen
 * - KEIN eval() (CI-safe), sondern einfacher Parser:
 *   - Zahlen, Klammern, + - * /
 *   - Identifier = Parametername (z.B. length, width, flapOpen)
 *
 * Beispiel:
 *   expr = "length * 2 + 0.3"
 *   -> evaluateExpr(expr, { length: 5.25 }) === 10.8
 */

/**
 * Tokenisiert einen Ausdruck.
 * @param {string} src
 * @returns {Array<{t:'num'|'id'|'op'|'lp'|'rp', v:any}>}
 */
export function tokenizeExpr(src) {
  const s = String(src || "").trim();
  const out = [];
  let i = 0;

  const isWS = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";
  const isDigit = (c) => c >= "0" && c <= "9";
  const isIdStart = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  const isId = (c) => isIdStart(c) || isDigit(c) || c === "."; // wir erlauben '.' (z.B. params.length)

  while (i < s.length) {
    const c = s[i];
    if (isWS(c)) {
      i++;
      continue;
    }

    if (c === "(") {
      out.push({ t: "lp", v: c });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rp", v: c });
      i++;
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }

    // Zahl (inkl. Dezimal)
    if (isDigit(c) || (c === "." && isDigit(s[i + 1] || ""))) {
      let j = i + 1;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error(`Invalid number in expr: ${s.slice(i, j)}`);
      out.push({ t: "num", v: num });
      i = j;
      continue;
    }

    // Identifier
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < s.length && isId(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(`Unexpected token '${c}' in expr: ${s}`);
  }

  return out;
}

/**
 * Shunting-yard -> RPN
 * @param {ReturnType<typeof tokenizeExpr>} tokens
 */
export function toRPN(tokens) {
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const out = [];
  const stack = [];

  for (const tok of tokens) {
    if (tok.t === "num" || tok.t === "id") {
      out.push(tok);
      continue;
    }
    if (tok.t === "op") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "op" && prec[top.v] >= prec[tok.v]) {
          out.push(stack.pop());
          continue;
        }
        break;
      }
      stack.push(tok);
      continue;
    }
    if (tok.t === "lp") {
      stack.push(tok);
      continue;
    }
    if (tok.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") {
        out.push(stack.pop());
      }
      if (!stack.length) throw new Error("Mismatched parentheses in expr");
      stack.pop();
      continue;
    }
  }

  while (stack.length) {
    const t = stack.pop();
    if (t.t === "lp" || t.t === "rp") throw new Error("Mismatched parentheses in expr");
    out.push(t);
  }
  return out;
}

/**
 * Evaluates RPN
 * @param {ReturnType<typeof toRPN>} rpn
 * @param {Record<string, any>} vars
 */
export function evalRPN(rpn, vars) {
  const st = [];
  const getVar = (id) => {
    // erlaubt "a.b.c" Pfade
    const parts = String(id).split(".");
    let v = vars;
    for (const p of parts) {
      if (v && Object.prototype.hasOwnProperty.call(v, p)) v = v[p];
      else return 0;
    }
    return Number(v) || 0;
  };

  for (const tok of rpn) {
    if (tok.t === "num") {
      st.push(tok.v);
      continue;
    }
    if (tok.t === "id") {
      st.push(getVar(tok.v));
      continue;
    }
    if (tok.t === "op") {
      const b = st.pop();
      const a = st.pop();
      if (a == null || b == null) throw new Error("Invalid expr (stack underflow)");
      if (tok.v === "+") st.push(a + b);
      else if (tok.v === "-") st.push(a - b);
      else if (tok.v === "*") st.push(a * b);
      else if (tok.v === "/") st.push(b === 0 ? 0 : a / b);
      continue;
    }
    throw new Error("Invalid token in RPN");
  }

  if (st.length !== 1) throw new Error("Invalid expr (final stack)");
  return st[0];
}

/**
 * Convenience: direkt evaluate.
 * @param {string} expr
 * @param {Record<string, any>} vars
 */
export function evaluateExpr(expr, vars) {
  const tokens = tokenizeExpr(expr);
  const rpn = toRPN(tokens);
  return evalRPN(rpn, vars);
}
