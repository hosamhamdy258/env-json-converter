// Pure conversion logic, no DOM access. Loaded by the page and by the tests (Node).
const EnvJson = (() => {
  const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.\-]*$/;
  const BARE_RE = /^[A-Za-z0-9_./:@,+\-=%]+$/;
  const ESCAPES = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\', $: '$' };

  // ---------- ENV text -> object ----------
  // Returns { obj, warnings }. Throws Error('Line N: ...') on invalid input.
  function parseEnv(text, opts = {}) {
    const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const len = src.length;
    const obj = {}, seen = {}, warnings = [];
    let pos = 0, line = 1;

    const eolFrom = p => { const e = src.indexOf('\n', p); return e === -1 ? len : e; };

    while (pos < len) {
      const eol = eolFrom(pos);
      const raw = src.slice(pos, eol);
      const trimmed = raw.trim();
      if (!trimmed || trimmed[0] === '#') { pos = eol + 1; line++; continue; }

      const m = /^[ \t]*(?:export[ \t]+)?([^=]*?)[ \t]*=/.exec(raw);
      if (!m) throw new Error('Line ' + line + ': missing "="');
      const key = m[1];
      if (!KEY_RE.test(key)) throw new Error('Line ' + line + ': invalid key "' + key + '"');
      const keyLine = line;

      let p = pos + m[0].length;
      while (src[p] === ' ' || src[p] === '\t') p++;
      const q = src[p];
      let value, quoted = false;

      if (q === '"' || q === "'" || q === '`') {
        quoted = true;
        let j = p + 1;
        while (j < len && src[j] !== q) {
          if (src[j] === '\\' && q === '"') j++;
          j++;
        }
        if (j >= len) throw new Error('Line ' + keyLine + ': unterminated ' + q + ' quote');
        const inner = src.slice(p + 1, j);
        line += (inner.match(/\n/g) || []).length;
        value = q === '"' ? inner.replace(/\\(.)/gs, (s, c) => ESCAPES[c] ?? s) : inner;
        const after = eolFrom(j + 1);
        if (!/^[ \t]*(#.*)?$/.test(src.slice(j + 1, after))) {
          throw new Error('Line ' + line + ': unexpected text after closing ' + q + ' quote');
        }
        pos = after + 1;
      } else {
        // unquoted: "#" starts a comment only when preceded by whitespace (incl. the spaces after "=")
        const rest = src.slice(pos + m[0].length, eol);
        const hash = rest.search(/[ \t]#/);
        value = (hash === -1 ? rest : rest.slice(0, hash)).trim();
        pos = eol + 1;
      }
      line++;

      if (key in seen) warnings.push('Duplicate key "' + key + '" (lines ' + seen[key] + ' and ' + keyLine + '), last value used');
      seen[key] = keyLine;
      obj[key] = opts.types && !quoted ? coerce(value) : value;
    }
    return { obj, warnings };
  }

  function looksTyped(v) {
    return v === 'true' || v === 'false' || v === 'null' ||
      (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && String(Number(v)) === v);
  }

  function coerce(v) {
    if (!looksTyped(v)) return v;
    return v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : Number(v);
  }

  // ---------- object -> ENV text ----------
  function flatten(obj, prefix, out) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const key = prefix ? prefix + '__' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) {
        flatten(v, key, out);
        continue;
      }
      if (!KEY_RE.test(key)) throw new Error('Invalid .env key "' + key + '" (use letters, digits, _ . -; not starting with a digit)');
      if (key in out) throw new Error('Key "' + key + '" appears twice after flattening nested objects');
      out[key] = v;
    }
    return out;
  }

  // Pick the simplest quoting that parses back to exactly the same value.
  function envValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return envValue(JSON.stringify(v));  // arrays, {}
    if (typeof v !== 'string') return String(v);                    // numbers, booleans stay bare
    if (v === '') return '';
    if (BARE_RE.test(v) && !looksTyped(v)) return v;                 // typed-looking strings get quoted so they stay strings
    if (!/['\n\r]/.test(v)) return "'" + v + "'";
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
  }

  function toEnvText(obj, opts = {}) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON must be an object { ... }');
    const flat = flatten(obj, '', {});
    const keys = Object.keys(flat);
    if (opts.sort) keys.sort();
    return { text: keys.map(k => k + '=' + envValue(flat[k])).join('\n') + (keys.length ? '\n' : ''), count: keys.length };
  }

  function toJsonText(obj, opts = {}) {
    if (opts.sort) obj = Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    return JSON.stringify(obj, null, opts.pretty ? 2 : 0);
  }

  return { parseEnv, toEnvText, toJsonText };
})();

if (typeof module !== 'undefined') module.exports = EnvJson;
