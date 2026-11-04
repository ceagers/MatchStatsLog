// Lets the browser run the app straight from its JSX sources when nothing
// compiles them ahead of time. The GitHub Pages pipeline bundles the app and
// the app's own viewer runs the raw modules, so this is only a fallback: if
// the browser reports that the <script type="module"> tag failed to load —
// most static servers serve .jsx with a binary MIME type, and module scripts
// are never allowed to sniff one — this fetches the module graph, transpiles
// the JSX in-page with the vendored Babel (loaded on demand, so the compiled
// build never pays for it) and runs the result from blob URLs, which carry a
// proper text/javascript type. The script tag in index.html stays untouched,
// so the native paths keep first claim and this never fires there.

(function () {
  'use strict';

  var ran = false;

  // Bare-specifier mappings, lifted from index.html's import map.
  var bare = {};
  var mapScript = document.querySelector('script[type="importmap"]');
  try {
    bare = (mapScript && JSON.parse(mapScript.textContent).imports) || {};
  } catch (e) {
    /* a broken map only costs the bare imports; relative ones still work */
  }

  // Import/export-from statements plus bare `import '...'`. Anchored on
  // statement boundaries so text inside strings and comments never matches.
  var FROM = /(^|[;\n}])(?:import|export)\s+[^;]*?\bfrom\s*(['"])([^'"]+)\2/g;
  var SIDE = /(^|[;\n}])import\s*(['"])([^'"]+)\2/g;

  function resolveSpecifier(spec, base) {
    // Import-map entries resolve against the page, like the browser would;
    // every other specifier resolves against the module that imports it.
    if (bare[spec]) return new URL(bare[spec], document.baseURI).href;
    return new URL(spec, base).href;
  }

  var babelReady = null;
  function withBabel() {
    if (window.Babel) return Promise.resolve();
    if (!babelReady) {
      babelReady = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'vendor/babel.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () {
          babelReady = null;
          reject(new Error('could not load the in-browser JSX compiler'));
        };
        document.head.appendChild(s);
      });
    }
    return babelReady;
  }

  function rewriteImports(code, base) {
    var edits = [];
    code.replace(FROM, function (whole, edge, q, spec, off) {
      edits.push({ off: off, whole: whole, spec: spec });
      return whole;
    });
    code.replace(SIDE, function (whole, edge, q, spec, off) {
      edits.push({ off: off, whole: whole, spec: spec });
      return whole;
    });
    if (!edits.length) return Promise.resolve(code);

    return Promise.all(
      edits.map(function (edit) {
        return loadModule(resolveSpecifier(edit.spec, base)).then(function (blob) {
          edit.blob = blob;
        });
      })
    ).then(function () {
      // Substitute from the last statement backwards so offsets stay valid.
      edits.sort(function (a, b) { return b.off - a.off; });
      edits.forEach(function (edit) {
        var swapped = edit.whole.replace(
          /(['"])([^'"]+)\1$/,
          function (m, q) { return q + edit.blob + q; }
        );
        code = code.slice(0, edit.off) + swapped +
               code.slice(edit.off + edit.whole.length);
      });
      return code;
    });
  }

  // Every module in the graph is served from a blob URL, so the browser's
  // strict module MIME check never sees the server's content types at all.
  var cache = Object.create(null); // url → Promise<blobUrl>
  var open = Object.create(null);  // url → being loaded (cycle guard)

  function loadModule(url) {
    if (cache[url]) return cache[url];
    if (open[url]) return Promise.reject(new Error('cyclic module import at ' + url));
    open[url] = true;

    cache[url] = fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
        return res.text();
      })
      .then(function (source) {
        // Only the app's own sources carry JSX; plain modules pass through.
        if (/\.jsx(\?.*)?$/.test(url)) {
          return withBabel().then(function () {
            return Babel.transform(source, {
              presets: [['react', { runtime: 'automatic' }]],
              sourceType: 'module',
              filename: url.split('/').pop(),
            }).code;
          });
        }
        return source;
      })
      .then(function (code) { return rewriteImports(code, url); })
      .then(function (code) {
        delete open[url];
        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      }, function (err) {
        delete open[url];
        throw err;
      });

    return cache[url];
  }

  function fail(err) {
    var box = document.createElement('pre');
    box.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;margin:0;padding:12px;' +
      'background:#b00020;color:#fff;font:11px/1.4 monospace;white-space:pre-wrap;';
    box.textContent = 'The app could not start: ' + err.message;
    document.body.appendChild(box);
  }

  window.addEventListener('error', function (e) {
    var el = e.target;
    if (ran || !el || el.tagName !== 'SCRIPT' || !el.src) return;
    if (!/\.jsx(\?.*)?$/.test(el.src)) return;
    ran = true;
    el.remove();
    loadModule(el.src)
      .then(function (blob) {
        var s = document.createElement('script');
        s.type = 'module';
        s.src = blob;
        document.head.appendChild(s);
      })
      .catch(fail);
  }, true);
})();