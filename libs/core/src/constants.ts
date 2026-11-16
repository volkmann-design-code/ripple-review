/*
 * Constant folding for diff lines, so that an inline value replaced by a
 * named constant reads as "same value": `14 * 24 * 3_600_000` and
 * `14 * DAY_MS` both become `1209600000`; `"https://x.de/v1"`,
 * `API_BASE + "/v1"` and `` `${API_BASE}/v1` `` all become "https://x.de/v1".
 * Language-agnostic and deliberately small: numbers, string literals and
 * SCREAMING_CASE constants whose values come from definitions in the change
 * itself, joined by `*` and `+`.
 *
 * Folding must not change what an expression means:
 *   - a product folds anywhere except where a neighbour binds tighter or
 *     groups differently (`x / 2 * 3`, `2 * 3 ** 2`, `obj.A * 2`);
 *   - a sum folds only as a whole expression (after `=`, `(`, `,`, `return`…,
 *     before `;`, `)`, `,`…), since `x * 2 + 3` and `a - 2 + 3` are not
 *     `x * 5` and `a - 5`;
 *   - strings only concatenate, never multiply.
 */

export type ConstantValue = number | string;

const TOKEN =
  /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*|\*\*|\?\.|=>|\/\/|\S/g;
const NUMBER = /^(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)$/;
const STRING = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')$/;
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

/** Neighbours that bind tighter than `*` or make the run something else. */
const PRODUCT_BLOCK_BEFORE = new Set(["/", "%", "**", ".", "?."]);
const PRODUCT_BLOCK_AFTER = new Set(["**", ".", "(", "[", "?."]);
/** Tokens that bound a whole expression. */
const EXPR_START = new Set(["=", "(", "[", "{", ",", ":", "?", "=>", "return"]);
const EXPR_END = new Set([")", "]", "}", ";", ",", ":", "//", "#"]);

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokens(line: string): Token[] {
  return [...line.matchAll(TOKEN)].map((m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

const numberValue = (t: string) => Number(t.replace(/_/g, ""));

/** A string literal's value; undefined if it has escapes (not worth reading). */
function stringValue(t: string): string | undefined {
  const body = t.slice(1, -1);
  return body.includes("\\") ? undefined : body;
}

const render = (v: ConstantValue) =>
  typeof v === "number" ? String(v) : JSON.stringify(v);

/**
 * Inlines `${NAME}` of known constants into template literals; a template
 * left without placeholders becomes a plain string.
 */
function inlineTemplates(
  line: string,
  env: ReadonlyMap<string, ConstantValue>,
  names: string[],
): string {
  return line.replace(/`([^`\\]*)`/g, (_lit, body: string) => {
    const inlined = body.replace(
      /\$\{\s*([A-Z][A-Z0-9_]*)\s*\}/g,
      (ph: string, n: string) => {
        const v = env.get(n);
        if (v === undefined) {
          return ph;
        }
        names.push(n);
        return String(v);
      },
    );
    return inlined.includes("${") ? `\`${inlined}\`` : JSON.stringify(inlined);
  });
}

/**
 * Replaces each foldable expression of numbers, strings and known constants
 * with its value. `names` are the constants that were substituted.
 */
export function foldConstants(
  line: string,
  env: ReadonlyMap<string, ConstantValue>,
): { text: string; names: string[] } {
  const names: string[] = [];
  const src = inlineTemplates(line, env, names);
  const ts = tokens(src);

  const operandValue = (t: Token | undefined): ConstantValue | undefined => {
    if (t === undefined) {
      return undefined;
    }
    if (NUMBER.test(t.text)) {
      return numberValue(t.text);
    }
    if (STRING.test(t.text)) {
      return stringValue(t.text);
    }
    return env.get(t.text);
  };

  /** The last operand of a run starting at i, joined by `*` (and `+`). */
  const runEnd = (i: number, plus: boolean) => {
    let j = i;
    while (
      (ts[j + 1]?.text === "*" || (plus && ts[j + 1]?.text === "+")) &&
      operandValue(ts[j + 2]) !== undefined
    ) {
      j += 2;
    }
    return j;
  };

  /** A sum of products; undefined if a string would be multiplied. */
  const evaluate = (i: number, j: number): ConstantValue | undefined => {
    const terms: ConstantValue[] = [];
    let product: ConstantValue | undefined;
    for (let k = i; k <= j; k += 2) {
      const v = operandValue(ts[k]);
      if (v === undefined) {
        return undefined;
      }
      if (k === i || ts[k - 1]?.text === "+") {
        if (product !== undefined) {
          terms.push(product);
        }
        product = v;
      } else if (typeof product === "number" && typeof v === "number") {
        product *= v;
      } else {
        return undefined;
      }
    }
    if (product !== undefined) {
      terms.push(product);
    }
    return terms.reduce((a, b) =>
      typeof a === "number" && typeof b === "number" ? a + b : `${a}${b}`,
    );
  };

  let out = "";
  let at = 0;
  let i = 0;
  while (i < ts.length) {
    if (operandValue(ts[i]) === undefined) {
      i++;
      continue;
    }
    const prev = ts[i - 1];
    // The whole expression if it is one (sums allowed), else a product.
    const whole = runEnd(i, true);
    const after = ts[whole + 1];
    const isWhole =
      (prev === undefined || EXPR_START.has(prev.text)) &&
      (after === undefined || EXPR_END.has(after.text));
    let j = isWhole ? whole : runEnd(i, false);
    const next = ts[j + 1];
    const blocked =
      !isWhole &&
      ((prev !== undefined && PRODUCT_BLOCK_BEFORE.has(prev.text)) ||
        (next !== undefined && PRODUCT_BLOCK_AFTER.has(next.text)));
    const v = blocked ? undefined : evaluate(i, j);
    if (v === undefined) {
      j = i;
    } else {
      for (let k = i; k <= j; k += 2) {
        const t = ts[k] as Token;
        if (env.has(t.text)) {
          names.push(t.text);
        }
      }
      // A lone literal is rewritten too, which normalizes it (1_000 → 1000, 'a' → "a").
      out += `${src.slice(at, (ts[i] as Token).start)}${render(v)}`;
      at = (ts[j] as Token).end;
    }
    i = j + 1;
  }
  return { text: out + src.slice(at), names };
}

const DEFINITION =
  /\b([A-Z][A-Z0-9_]*)\s*(?::\s*[\w<>]+\s*)?=(?!=)\s*(.+?)\s*[;,]?(?:\s+(?:\/\/|#).*)?\s*$/;

/** The constant a line defines (`NAME = …`), if any. */
export function definedName(line: string): string | undefined {
  const name = DEFINITION.exec(line)?.[1];
  return name && CONSTANT_NAME.test(name) ? name : undefined;
}

/**
 * Values of `NAME = <expression>` definitions in the given lines (`const`,
 * `final`, `val`, a plain assignment: any language). A name defined with
 * different values is left out.
 */
export function constantEnv(lines: string[]): Map<string, ConstantValue> {
  const defs = new Map<string, string[]>();
  for (const l of lines) {
    const m = DEFINITION.exec(l);
    if (m?.[1] && m[2] && CONSTANT_NAME.test(m[1])) {
      defs.set(m[1], [...(defs.get(m[1]) ?? []), m[2]]);
    }
  }
  const env = new Map<string, ConstantValue>();
  const conflicting = new Set<string>();
  const rhsValue = (rhs: string): ConstantValue | undefined => {
    const text = foldConstants(`= ${rhs}`, env).text.slice(2).trim();
    if (NUMBER.test(text)) {
      return numberValue(text);
    }
    return STRING.test(text) ? stringValue(text) : undefined;
  };
  // Definitions may build on each other (DAY_MS = 24 * HOUR_MS): a few passes.
  for (let pass = 0; pass < 3; pass++) {
    for (const [name, rhss] of defs) {
      if (env.has(name) || conflicting.has(name)) {
        continue;
      }
      const values = rhss.map(rhsValue);
      const known = new Set(values.filter((v) => v !== undefined));
      if (known.size > 1) {
        conflicting.add(name);
      } else if (known.size === 1 && values.every((v) => v !== undefined)) {
        env.set(name, [...known][0] as ConstantValue);
      }
    }
  }
  return env;
}
