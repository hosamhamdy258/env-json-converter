// UI wiring: buttons, files, clipboard, shortcuts.
(function () {
  const $ = id => document.getElementById(id);
  const envEl = $('env'), jsonEl = $('json');
  const opts = () => ({ pretty: $('pretty').checked, types: $('types').checked, sort: $('sort').checked });

  function setStatus(which, msg, kind) {
    const el = $(which + 'Status');
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  $('toJson').onclick = () => {
    try {
      const { obj, warnings } = EnvJson.parseEnv(envEl.value, opts());
      jsonEl.value = EnvJson.toJsonText(obj, opts());
      setStatus('env', warnings.join('\n'), warnings.length ? 'warn' : '');
      setStatus('json', Object.keys(obj).length + ' keys converted', 'ok');
    } catch (e) { setStatus('env', e.message, 'err'); }
  };

  $('toEnv').onclick = () => {
    try {
      const { text, count } = EnvJson.toEnvText(JSON.parse(jsonEl.value), opts());
      envEl.value = text;
      setStatus('json', '');
      setStatus('env', count + ' keys converted', 'ok');
    } catch (e) { setStatus('json', e.message, 'err'); }
  };

  document.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    const id = b.dataset.copy, el = $(id);
    try { await navigator.clipboard.writeText(el.value); }
    catch { el.select(); document.execCommand('copy'); }
    setStatus(id, 'Copied', 'ok');
  });

  function saveFile(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
    const id = b.dataset.save;
    saveFile(id === 'env' ? '.env' : 'env.json', $(id).value, 'text/plain');
  });

  // Offline copy: the built page is one self-contained file, so saving its own markup is enough.
  // Hidden in the dev page (src/), which loads external css/js and would not work on its own.
  const dl = $('download');
  if (document.querySelector('script[src], link[rel=stylesheet]')) dl.hidden = true;
  dl.onclick = () => {
    const page = document.documentElement.cloneNode(true);
    page.querySelectorAll('.status').forEach(s => { s.textContent = ''; s.className = 'status'; });
    page.querySelectorAll('textarea').forEach(t => { t.textContent = ''; t.classList.remove('drop'); });
    saveFile('env-json-converter.html', '<!doctype html>\n' + page.outerHTML, 'text/html');
  };

  document.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
    $(b.dataset.clear).value = ''; setStatus(b.dataset.clear, '');
  });

  document.querySelectorAll('[data-open]').forEach(b => {
    const input = $(b.dataset.open);
    const target = input.id === 'envFile' ? 'env' : 'json';
    b.onclick = () => input.click();
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      f.text().then(t => { $(target).value = t; setStatus(target, 'Loaded ' + f.name, 'ok'); input.value = ''; });
    };
  });

  // drag & drop a file onto either box
  [envEl, jsonEl].forEach(el => {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drop');
      const f = e.dataTransfer.files[0];
      if (f) f.text().then(t => { el.value = t; setStatus(el.id, 'Loaded ' + f.name, 'ok'); });
    });
  });

  // Ctrl/Cmd+Enter converts from the focused box
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      (document.activeElement === jsonEl ? $('toEnv') : $('toJson')).click();
    }
  });
})();
