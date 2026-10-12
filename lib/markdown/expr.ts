/**
 * Tiny expression evaluator for graph/solve — no mathjs.
 * Supports + - * / ^, parentheses, x, pi, e, sin cos tan sqrt abs ln log.
 */

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCS: Record<string, (n: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' };

function tokenize(input: string): Tok[] {
  const s = input.replace(/\s+/g, '');
  const raw: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      raw.push({ t: 'num', v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      raw.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      raw.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      raw.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      raw.push({ t: 'rp' });
      i++;
      continue;
    }
    if (c === ',') {
      raw.push({ t: 'comma' });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }

  // Insert implicit * for juxtaposition: 2x → 2*x, 2(…) → 2*(…), x( → x*(, )x → )*x
  const out: Tok[] = [];
  for (let k = 0; k < raw.length; k++) {
    out.push(raw[k]);
    const cur = raw[k];
    const nxt = raw[k + 1];
    if (!nxt) continue;
    const curIsVal = cur.t === 'num' || cur.t === 'rp' || (cur.t === 'id' && !(cur.v in FUNCS));
    const nxtIsVal = nxt.t === 'num' || nxt.t === 'lp' || (nxt.t === 'id' && !(nxt.v in FUNCS));
    const nxtIsFunc = nxt.t === 'id' && nxt.v in FUNCS;
    if (curIsVal && (nxtIsVal || nxtIsFunc)) {
      out.push({ t: 'op', v: '*' });
    }
  }
  return out;
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const stack: Tok[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.t === 'num' || (tok.t === 'id' && !(tok.v in FUNCS))) {
      out.push(tok);
      continue;
    }
    if (tok.t === 'id' && tok.v in FUNCS) {
      stack.push(tok);
      continue;
    }
    if (tok.t === 'op') {
      // unary minus
      const prev = tokens[i - 1];
      if (
        tok.v === '-' &&
        (!prev || prev.t === 'op' || prev.t === 'lp' || prev.t === 'comma')
      ) {
        out.push({ t: 'num', v: 0 });
      }
      while (
        stack.length &&
        stack[stack.length - 1].t === 'op' &&
        PREC[(stack[stack.length - 1] as { t: 'op'; v: string }).v] >= PREC[tok.v]
      ) {
        out.push(stack.pop()!);
      }
      stack.push(tok);
      continue;
    }
    if (tok.t === 'lp') {
      stack.push(tok);
      continue;
    }
    if (tok.t === 'rp' || tok.t === 'comma') {
      while (stack.length && stack[stack.length - 1].t !== 'lp') {
        out.push(stack.pop()!);
      }
      if (tok.t === 'rp') {
        stack.pop();
        if (stack.length && stack[stack.length - 1].t === 'id') {
          out.push(stack.pop()!);
        }
      }
      continue;
    }
  }
  while (stack.length) out.push(stack.pop()!);
  return out;
}

export function evalExpression(expr: string, vars: Record<string, number> = {}): number {
  const rpn = toRpn(tokenize(expr));
  const stack: number[] = [];
  for (const tok of rpn) {
    if (tok.t === 'num') {
      stack.push(tok.v);
      continue;
    }
    if (tok.t === 'id') {
      if (tok.v in FUNCS) {
        const a = stack.pop();
        if (a === undefined) throw new Error('Bad expression');
        stack.push(FUNCS[tok.v](a));
        continue;
      }
      if (tok.v in vars) {
        stack.push(vars[tok.v]);
        continue;
      }
      if (tok.v in CONSTANTS) {
        stack.push(CONSTANTS[tok.v]);
        continue;
      }
      throw new Error(`Unknown symbol "${tok.v}"`);
    }
    if (tok.t === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Bad expression');
      switch (tok.v) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          stack.push(a / b);
          break;
        case '^':
          stack.push(Math.pow(a, b));
          break;
      }
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new Error('Could not evaluate');
  }
  return stack[0];
}

/** Solve simple linear `ax + b = c` / `ax + b = cx + d` / arithmetic. */
export function solveEquation(raw: string): { ok: true; result: string; steps: string[] } | { ok: false; error: string } {
  const eq = raw.replace(/\s+/g, '');
  try {
    if (!eq.includes('=')) {
      const v = evalExpression(eq);
      return { ok: true, result: String(roundNice(v)), steps: [`Evaluate: ${raw}`] };
    }
    const [left, right] = eq.split('=');
    if (!left || right === undefined) return { ok: false, error: 'Need both sides of =' };

    // Binary search / Newton for f(x)=0 where f = left - right, if x present
    if (/[xX]/.test(eq)) {
      const f = (x: number) =>
        evalExpression(left, { x }) - evalExpression(right, { x });
      // Prefer closed form for linear: sample slope
      const f0 = f(0);
      const f1 = f(1);
      const slope = f1 - f0;
      if (Math.abs(slope) > 1e-12) {
        const x = -f0 / slope;
        // Verify near-linear
        if (Math.abs(f(x)) < 1e-6) {
          return {
            ok: true,
            result: `x = ${roundNice(x)}`,
            steps: [
              `Move all terms to one side`,
              `Solve linear relation`,
              `x = ${roundNice(x)}`,
            ],
          };
        }
      }
      // Fallback Newton
      let x = 0;
      for (let i = 0; i < 40; i++) {
        const y = f(x);
        const yp = (f(x + 1e-6) - y) / 1e-6;
        if (Math.abs(yp) < 1e-12) break;
        const next = x - y / yp;
        if (!Number.isFinite(next)) break;
        if (Math.abs(next - x) < 1e-10) {
          x = next;
          break;
        }
        x = next;
      }
      if (Math.abs(f(x)) < 1e-5) {
        return {
          ok: true,
          result: `x ≈ ${roundNice(x)}`,
          steps: [`Numeric solve for x`, `x ≈ ${roundNice(x)}`],
        };
      }
      return { ok: false, error: 'Could not solve for x with this equation' };
    }

    const lv = evalExpression(left);
    const rv = evalExpression(right);
    if (Math.abs(lv - rv) < 1e-9) {
      return { ok: true, result: 'True', steps: ['Both sides equal'] };
    }
    return {
      ok: true,
      result: 'False',
      steps: [`Left = ${roundNice(lv)}`, `Right = ${roundNice(rv)}`],
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Solve failed' };
  }
}

function roundNice(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 1e10) / 1e10;
  return String(r);
}
