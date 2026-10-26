# ENV ⇄ JSON

Convert `.env` files to JSON and back, in your browser.

- **Works offline.** Click **⤓ Offline copy** to save the whole app as one HTML file. No dependencies, no network calls; your secrets never leave your machine.
- **Correct with tricky values.** Quotes, escapes, `#`, `$`, multi-line values and Unicode all convert exactly, in both directions.
- **Works on desktop and mobile**, in light and dark mode.

## Usage

Open the [live page](https://hosamhamdy258.github.io/env-json-converter/), or click **⤓ Offline copy** there to save a single `env-json-converter.html` you can open in any browser without internet.

1. Paste text, click **Open**, or drag a file onto either box.
2. Click **ENV → JSON** or **JSON → ENV** (or press `Ctrl/Cmd + Enter` in a box).
3. **Copy** or **Save** the result.

Options:

| Option | Effect |
|---|---|
| Pretty JSON | Indent JSON output with 2 spaces |
| Detect numbers / booleans | Unquoted `true`, `false`, `null` and numbers become real JSON types |
| Sort keys | Output keys in alphabetical order |

## Conversion rules

Follows the common `.env` format used by Docker Compose and python-dotenv.

### ENV → JSON

| Input | Result |
|---|---|
| `KEY=value` | `"value"` (surrounding spaces trimmed) |
| `export KEY=value` | `export` prefix is ignored |
| `# comment`, blank lines | ignored |
| `KEY=abc # note` | `"abc"`; `#` starts a comment only after a space |
| `KEY=a#b` | `"a#b"` |
| `KEY=` or `KEY= # note` | `""` |
| `KEY='a\nb $X'` | literal: `"a\\nb $X"` (no escapes) |
| ``KEY=`text` `` | literal, same as single quotes |
| `KEY="a\nb"` | `\n \r \t \" \\ \$` are unescaped; other `\x` kept as-is |
| `KEY="line 1`<br>`line 2"` | multi-line values are supported in any quotes |
| `KEY=${OTHER}` | kept literally; variables are not expanded |
| `KEY="x"junk` | error with line number |
| Duplicate keys | last value wins, with a warning |

### JSON → ENV

| Input | Result |
|---|---|
| `{"DB": {"HOST": "x"}}` | `DB__HOST=x` (nested objects flattened with `__`) |
| `[1, "a"]` or `{}` | written as JSON text |
| `null` | empty value `KEY=` |
| numbers, booleans | written bare |
| strings | simplest quoting that reads back exactly: bare, `'single'`, or `"double"` with escapes |
| `"123"`, `"true"` (strings) | quoted, so they stay strings |
| invalid keys (`"A B"`, `""`) | error naming the key |

**Round trip guarantee:** ENV → JSON → ENV keeps every value exactly. JSON → ENV → JSON is exact for flat objects; nested objects come back flattened.

## Development

Requires Node.js 18+. There are no dependencies, so there is nothing to install.

```
src/
  index.html      markup
  style.css       styles (light + dark)
  converter.js    pure conversion logic, shared by the page and the tests
  app.js          UI: buttons, files, clipboard, shortcuts, offline copy
scripts/build.js  inlines src/ into one file: dist/index.html
test/             converter tests
```

```bash
npm test         # run the converter tests
npm run build    # write dist/index.html (single self-contained file)
```

While editing, open `src/index.html` directly in the browser and refresh. The **Offline copy** button is hidden there because that page loads separate files; it appears in the built `dist/index.html`.

The tests cover quoting, escaping, comments, multi-line values, errors and round trips, plus 3,000 fuzzed strings.

### Deploy

Pushing to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages (`.github/workflows/pages.yml`). One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## License

[MIT](LICENSE) © Hossam Hamdy
