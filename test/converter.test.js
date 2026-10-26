// Tests for the conversion logic in src/converter.js.
// Run: npm test   (no dependencies)
const assert = require('assert');
const EnvJson = require('../src/converter.js');
const { parseEnv, toEnvText } = EnvJson;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL', name, '\n ', e.message); } };
const P = (s, o) => JSON.parse(JSON.stringify(parseEnv(s, o).obj));
const eq = (a, b) => assert.deepStrictEqual(a, b);
const throwsLine = (s, re) => assert.throws(() => parseEnv(s), re);

// ---- ENV -> JSON
t('basic', () => eq(P('A=1\nB=hello'), { A: '1', B: 'hello' }));
t('comments/blank/export', () => eq(P('# c\n\n  export A=1\n   # x\nexport=2'), { A: '1', export: '2' }));
t('spaces around =', () => eq(P('A = b c '), { A: 'b c' }));
t('empty', () => eq(P('A=\nB=  '), { A: '', B: '' }));
t('empty + comment', () => eq(P('A= # note\nB=#x'), { A: '', B: '#x' }));
t('inline comment', () => eq(P('A=abc # note\nB=a#b\nC=a\t#t'), { A: 'abc', B: 'a#b', C: 'a' }));
t('single literal', () => eq(P("A='a\\nb $X \"q\" #h'"), { A: 'a\\nb $X "q" #h' }));
t('backtick literal', () => eq(P('A=`it\'s "x"`'), { A: 'it\'s "x"' }));
t('double escapes', () => eq(P('A="a\\nb\\tc\\"d\\\\e\\$f\\x"'), { A: 'a\nb\tc"d\\e$f\\x' }));
t('double \\\\n literal', () => eq(P('A="x\\\\ny"'), { A: 'x\\ny' }));
t('double keeps #', () => eq(P('A="abc#123" # c'), { A: 'abc#123' }));
t('quoted keeps spaces', () => eq(P('A="  x  "\nB=\'  y \''), { A: '  x  ', B: '  y ' }));
t('multiline', () => eq(P('A="line1   \n  line2"\nB=2'), { A: 'line1   \n  line2', B: '2' }));
t('multiline single', () => eq(P("K='-----BEGIN\nabc\n-----END'"), { K: '-----BEGIN\nabc\n-----END' }));
t('${VAR} literal', () => eq(P('A=${HOME}/x\nB="${HOME}"'), { A: '${HOME}/x', B: '${HOME}' }));
t('CRLF + BOM', () => eq(P('\uFEFFA=1\r\nB="x"\r\n'), { A: '1', B: 'x' }));
t('unicode', () => eq(P('A=héllo 🎉\nB="مرحبا"'), { A: 'héllo 🎉', B: 'مرحبا' }));
t('= in value', () => eq(P('URL=postgres://u:p@h/db?a=b&c=d'), { URL: 'postgres://u:p@h/db?a=b&c=d' }));
t('quote mid unquoted', () => eq(P('A=it\'s'), { A: "it's" }));
t('err junk after quote', () => throwsLine('A=1\nB="x"junk', /Line 2: unexpected text/));
t('err unterminated', () => throwsLine('A=1\nB="x\nC=2', /Line 2: unterminated/));
t('err missing =', () => throwsLine('A=1\n\nNOPE', /Line 3: missing/));
t('err bad key', () => throwsLine('1A=x', /Line 1: invalid key/));
t('err line after multiline', () => throwsLine('A="a\nb"\nBAD', /Line 3: missing/));
t('dup warning', () => { const r = parseEnv('A=1\nA=2'); eq(r.obj.A, '2'); assert.match(r.warnings[0], /lines 1 and 2/); });
t('types', () => eq(P('A=true\nB=12\nC=1.5\nD="12"\nE=007\nF=1.50\nG=null\nH=-3', { types: true }),
  { A: true, B: 12, C: 1.5, D: '12', E: '007', F: '1.50', G: null, H: -3 }));
t('big number stays string', () => eq(P('A=12345678901234567890', { types: true }), { A: '12345678901234567890' }));

// ---- JSON -> ENV
const E = (o, opts) => toEnvText(o, opts).text;
t('nested + arrays + null + {}', () => eq(E({ DB: { HOST: 'x', P: 5 }, L: [1, 'a'], N: null, O: {} }),
  'DB__HOST=x\nDB__P=5\nL=\'[1,"a"]\'\nN=\nO=\'{}\'\n'));
t('bad key', () => assert.throws(() => E({ 'A B': 1 }), /Invalid .env key "A B"/));
t('empty key', () => assert.throws(() => E({ '': 1 }), /Invalid/));
t('collision', () => assert.throws(() => E({ A__B: 1, A: { B: 2 } }), /twice/));
t('not object', () => assert.throws(() => E([1]), /must be an object/));
t('sort', () => eq(E({ b: 1, a: 2 }, { sort: true }), 'a=2\nb=1\n'));

// ---- round trips
const nasty = {
  PLAIN: 'abc', EMPTY: '', SP: ' lead trail ', HASH: 'a #b', HASH2: '#start', DQ: 'say "hi"', SQ: "it's",
  BOTH: `it's "x"`, BS: 'C:\\path\\n', DOLLAR: 'p$ss${X}', NL: 'a\nb\n', CR: 'a\r\nb', TAB: 'a\tb',
  UNI: 'مرحبا 🎉', BT: '`tick`', EQ: 'a=b', NUMSTR: '123', BOOLSTR: 'true', NULLSTR: 'null', MIX: `'\\"$\n#\``,
  TRAIL_BS: 'end\\', ONLYQ: '"', ONLYS: "'",
};
for (const types of [false, true]) {
  t('JSON->ENV->JSON strings types=' + types, () => eq(P(E(nasty), { types }), nasty));
}
t('JSON->ENV->JSON typed', () => { const o = { N: 5, F: -1.25, B: false, T: true, S: '5' }; eq(P(E(o), { types: true }), o); });
t('ENV->JSON->ENV->JSON', () => {
  const src = 'A="x\\ny"\nB=\'lit $X\'\nC=a#b\nD= # c\nE=`q"\'`\nexport F="  s  "';
  const o1 = P(src); eq(P(E(o1)), o1);
});
// fuzz: random strings of awkward characters must survive JSON -> ENV -> JSON (seeded, reproducible)
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const chars = [...'ab $#"\'`\\\n\r\t=é🎉{}'];
for (let i = 0; i < 3000; i++) {
  let s = ''; const n = rand() * 12 | 0;
  for (let k = 0; k < n; k++) s += chars[rand() * chars.length | 0];
  const o = { K: s };
  t('fuzz ' + JSON.stringify(s), () => eq(P(E(o)), o));
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
