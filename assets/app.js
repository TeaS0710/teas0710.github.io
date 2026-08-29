/* VERGNE-OS — window manager, boot sequence, terminal. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var desktop = $("#desktop");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = function () {
    return window.matchMedia("(max-width: 720px), (pointer: coarse) and (max-width: 1024px)").matches;
  };

  function repeat(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }
  function pad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }

  /* ============ WINDOW MANAGER ============ */
  var zTop = 10;
  var cascade = 0;

  function windowsOf() { return $$(".window"); }

  function focusWindow(win) {
    windowsOf().forEach(function (w) { w.classList.remove("is-active"); });
    win.classList.add("is-active");
    win.style.zIndex = ++zTop;
    syncTaskbar();
  }

  function flashLoad(win) {
    if (reducedMotion) return;
    var lb = document.createElement("div");
    lb.className = "window__load";
    win.appendChild(lb);
    requestAnimationFrame(function () { requestAnimationFrame(function () { lb.classList.add("run"); }); });
    setTimeout(function () { lb.remove(); }, 600);
  }

  function openWindow(id) {
    var win = document.getElementById(id);
    if (!win) return;
    if (win.classList.contains("is-open") && !win.classList.contains("is-min")) {
      focusWindow(win);
      return;
    }
    win.classList.remove("is-min");
    if (!win.classList.contains("is-open")) {
      win.classList.add("is-open");
      if (!win.dataset.placed && !isMobile()) {
        var w = Math.min(parseInt(win.dataset.w || "560", 10), desktop.clientWidth - 24);
        var h = Math.min(parseInt(win.dataset.h || "460", 10), desktop.clientHeight - 24);
        var x = Math.max(12, Math.min(90 + cascade * 34, desktop.clientWidth - w - 12));
        var y = Math.max(12, Math.min(48 + cascade * 26, desktop.clientHeight - h - 12));
        win.style.width = w + "px";
        win.style.height = h + "px";
        win.style.left = x + "px";
        win.style.top = y + "px";
        win.dataset.placed = "1";
        cascade = (cascade + 1) % 8;
      }
      ensureTask(win);
      flashLoad(win);
    }
    focusWindow(win);
    if (id === "win-terminal" && !isMobile()) setTimeout(function () { $("#term-in").focus(); }, 60);
  }

  function closeWindow(win) {
    win.classList.remove("is-open", "is-min", "is-max", "is-active");
    removeTask(win);
    var open = windowsOf().filter(function (w) { return w.classList.contains("is-open") && !w.classList.contains("is-min"); });
    if (open.length) focusWindow(open[open.length - 1]);
  }

  function minimizeWindow(win) {
    win.classList.add("is-min");
    win.classList.remove("is-active");
    syncTaskbar();
  }

  function toggleMaximize(win) {
    if (win.classList.contains("is-max")) {
      win.classList.remove("is-max");
      var r = JSON.parse(win.dataset.rect || "{}");
      if (r.w) { win.style.left = r.x + "px"; win.style.top = r.y + "px"; win.style.width = r.w + "px"; win.style.height = r.h + "px"; }
    } else {
      win.dataset.rect = JSON.stringify({ x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight });
      win.classList.add("is-max");
      win.style.left = "6px";
      win.style.top = "6px";
      win.style.width = (desktop.clientWidth - 12) + "px";
      win.style.height = (desktop.clientHeight - 12) + "px";
    }
    focusWindow(win);
  }

  /* window chrome events */
  windowsOf().forEach(function (win) {
    win.addEventListener("pointerdown", function () { if (!win.classList.contains("is-active")) focusWindow(win); }, true);
    $(".wbtn--close", win).addEventListener("click", function () { closeWindow(win); });
    $(".wbtn--min", win).addEventListener("click", function () { minimizeWindow(win); });
    var maxBtn = $(".wbtn--max", win);
    if (maxBtn) maxBtn.addEventListener("click", function () { toggleMaximize(win); });

    var bar = $(".window__bar", win);
    bar.addEventListener("dblclick", function (e) { if (!e.target.closest(".wbtn")) toggleMaximize(win); });

    /* drag */
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".wbtn") || isMobile() || win.classList.contains("is-max")) return;
      e.preventDefault();
      var sx = e.clientX - win.offsetLeft;
      var sy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
      function move(ev) {
        var x = ev.clientX - sx;
        var y = ev.clientY - sy;
        x = Math.max(-win.offsetWidth + 90, Math.min(x, desktop.clientWidth - 60));
        y = Math.max(0, Math.min(y, desktop.clientHeight - 40));
        win.style.left = x + "px";
        win.style.top = y + "px";
      }
      function up() {
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", up);
      }
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
    });

    /* resize */
    var handle = $(".window__resize", win);
    handle.addEventListener("pointerdown", function (e) {
      if (isMobile()) return;
      e.preventDefault();
      focusWindow(win);
      var sw = win.offsetWidth - e.clientX;
      var sh = win.offsetHeight - e.clientY;
      handle.setPointerCapture(e.pointerId);
      function move(ev) {
        win.style.width = Math.max(280, sw + ev.clientX) + "px";
        win.style.height = Math.max(180, sh + ev.clientY) + "px";
      }
      function up() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  });

  /* ============ TASKBAR ============ */
  var tasksEl = $("#taskbar-tasks");

  function ensureTask(win) {
    if ($('[data-task="' + win.id + '"]', tasksEl)) return;
    var b = document.createElement("button");
    b.className = "tbtask";
    b.setAttribute("data-task", win.id);
    b.innerHTML = '<svg class="ico"><use href="#' + (win.dataset.icon || "i-file") + '"/></svg>' + win.dataset.title;
    b.addEventListener("click", function () {
      if (win.classList.contains("is-min")) openWindow(win.id);
      else if (win.classList.contains("is-active")) minimizeWindow(win);
      else focusWindow(win);
    });
    tasksEl.appendChild(b);
  }
  function removeTask(win) {
    var b = $('[data-task="' + win.id + '"]', tasksEl);
    if (b) b.remove();
  }
  function syncDesktopState() {
    var anyVisible = windowsOf().some(function (w) { return w.classList.contains("is-open") && !w.classList.contains("is-min"); });
    desktop.classList.toggle("has-open", anyVisible);
  }
  function syncTaskbar() {
    syncDesktopState();
    $$(".tbtask", tasksEl).forEach(function (b) {
      var win = document.getElementById(b.getAttribute("data-task"));
      b.classList.toggle("is-active", win.classList.contains("is-active") && !win.classList.contains("is-min"));
      b.classList.toggle("is-min", win.classList.contains("is-min"));
    });
  }

  /* clock */
  var timeEl = $("#tb-time");
  var dateEl = $("#tb-date");
  function tickClock() {
    var d = new Date();
    timeEl.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    dateEl.textContent = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  tickClock();
  setInterval(tickClock, 15000);

  /* start menu */
  var menuBtn = $("#menu-btn");
  var menu = $("#startmenu");
  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", function (e) {
    if (!menu.hidden && !e.target.closest("#startmenu")) {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  /* show desktop (home button): minimize every open window */
  $("#home-btn").addEventListener("click", function () {
    windowsOf().forEach(function (w) {
      if (w.classList.contains("is-open") && !w.classList.contains("is-min")) minimizeWindow(w);
    });
  });

  /* mobile: tapping the visible desktop strip minimizes the active window */
  desktop.addEventListener("click", function (e) {
    if (!isMobile()) return;
    if (e.target.closest(".window") || e.target.closest(".dicon")) return;
    var active = $(".window.is-active.is-open:not(.is-min)");
    if (active) minimizeWindow(active);
  });

  /* every [data-open] opens a window */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open]");
    if (!t) return;
    openWindow(t.getAttribute("data-open"));
    if (!menu.hidden) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  });

  /* Escape closes the active window */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!menu.hidden) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); return; }
    var active = $(".window.is-active.is-open");
    if (active) closeWindow(active);
  });

  /* ============ FILE MANAGER FILTERS ============ */
  var fitems = $$(".fitem");
  $$(".fm-filter").forEach(function (f) {
    f.addEventListener("click", function () {
      $$(".fm-filter").forEach(function (x) { x.classList.remove("is-active"); });
      f.classList.add("is-active");
      var filter = f.getAttribute("data-filter");
      var count = 0;
      fitems.forEach(function (it) {
        var cats = (it.getAttribute("data-cat") || "").split(/\s+/);
        var show = filter === "all" || cats.indexOf(filter) !== -1;
        it.classList.toggle("is-hidden", !show);
        if (show) count++;
      });
      $("#fm-count").textContent = count;
    });
  });

  /* print */
  $("#print-cv").addEventListener("click", function () { window.print(); });

  /* ============ TERMINAL ============ */
  var termOut = $("#term-out");
  var termIn = $("#term-in");
  var termForm = $("#term-form");
  var history = [];
  var histIdx = -1;
  var termBusy = false;

  $("#term-body").addEventListener("click", function () {
    if (!window.getSelection().toString()) termIn.focus();
  });

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function tprint(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    termOut.appendChild(div);
    termOut.scrollTop = termOut.scrollHeight;
    return div;
  }

  /* animated progress line: render(p in 0..1) -> html; calls done() at the end */
  function tbar(render, duration, done) {
    var div = tprint(render(0));
    if (reducedMotion) { div.innerHTML = render(1); if (done) done(); return; }
    var t0 = Date.now();
    (function step() {
      var p = document.hidden ? 1 : Math.min(1, (Date.now() - t0) / duration);
      div.innerHTML = render(p);
      termOut.scrollTop = termOut.scrollHeight;
      if (p < 1) setTimeout(step, 40);
      else if (done) done();
    })();
  }

  /* stream text word by word into one line */
  function tstream(text, done) {
    var div = tprint("");
    if (reducedMotion) { div.textContent = text; if (done) done(); return; }
    var words = text.split(" ");
    var i = 0;
    (function next() {
      if (document.hidden) i = words.length - 1;
      div.textContent = words.slice(0, ++i).join(" ") + (i < words.length ? " ▌" : "");
      termOut.scrollTop = termOut.scrollHeight;
      if (i < words.length) setTimeout(next, 28 + Math.random() * 45);
      else if (done) done();
    })();
  }

  function tqdmLine(label, total, unit, p) {
    var width = 18;
    var f = Math.round(width * p);
    var n = Math.round(total * p);
    var pct = pad(Math.round(p * 100), 3);
    return '<span class="t-cmd">' + label + '</span>: ' + pct + "%|<span class='t-ac'>" +
      repeat("█", f) + "</span>" + repeat(" ", width - f) + "| " + n + "/" + total +
      ' <span class="t-dim">[' + (p < 1 ? "00:0" + Math.max(1, Math.round(2 - 2 * p)) + "&lt;00:0" + Math.round(2 - 2 * p) : "00:02&lt;00:00") + ", " + unit + "]</span>";
  }
  function ollamaLine(digest, size, p) {
    var width = 16;
    var f = Math.round(width * p);
    return "pulling " + digest + "... " + pad(Math.round(p * 100), 3) + "% ▕<span class='t-ac'>" +
      repeat("█", f) + "</span>" + repeat(" ", width - f) + "▏ " + size;
  }

  var NEOFETCH = [
    '<span class="t-ac">██        ██</span>  <span class="t-ok">adrien</span>@<span class="t-ok">vergne-os</span>',
    '<span class="t-ac"> ██      ██ </span>  ─────────────────',
    '<span class="t-ac">  ██    ██  </span>  OS:       VERGNE-OS 2.0 (breeze edition)',
    '<span class="t-ac">   ██  ██   </span>  Host:     Sorbonne Université — M2 NLP &amp; AI',
    '<span class="t-ac">    ████    </span>  Kernel:   nlp-6.1-llm',
    '<span class="t-ac">     ██     </span>  Shell:    vanilla-js — view source, it\'s all there',
    '              Model:    gemma4:31b (daily driver)',
    '              Uptime:   coding since 2022',
    '              Packages: 15+ projects (9 featured)',
    '              Gold:     F1 macro 0.961 · 51,123 records',
    '              Contact:  vergneadrien65@gmail.com'
  ].join("\n");

  var OLLAMA_LIST = [
    '<span class="t-cmd">NAME                    SIZE     NOTE</span>',
    "gemma4:31b              19 GB    thesis workhorse — best F1/cost",
    "deepseek-v3.2           cloud    benchmarked, ties with langextract",
    "qwen3.5:397b-cloud      cloud    benchmarked",
    "mistral-large-3:675b    cloud    benchmarked — bigger ≠ better",
    "adrien:m2               1 human  always loaded, never quantized"
  ].join("\n");

  function cmdTrain() {
    termBusy = true;
    var losses = ["0.412", "0.187", "0.094"];
    var e = 0;
    (function epoch() {
      if (e >= 3) {
        tprint('early stop: gold F1 <span class="t-ok">0.961</span> — good enough to ship');
        tprint('checkpoint saved → <span class="t-ac">cv_adrien_vergne.pdf</span> <span class="t-dim">(type</span> cv <span class="t-dim">to open it)</span>');
        termBusy = false;
        return;
      }
      var cur = e;
      tbar(function (p) {
        return tqdmLine("epoch " + (cur + 1) + "/3", 300, "142 it/s", p) +
          (p >= 1 ? ' loss=<span class="t-ok">' + losses[cur] + "</span>" : "");
      }, 620, function () { e++; setTimeout(epoch, 120); });
    })();
  }

  function cmdOllamaRun(model) {
    if (model !== "adrien" && model !== "adrien:m2") {
      tprint('model "' + esc(model) + '" not found locally — <span class="t-dim">try</span> ollama run adrien');
      return;
    }
    termBusy = true;
    tbar(function (p) { return ollamaLine("8f2a1c9e", "1 human", p); }, 450, function () {
      tprint('<span class="t-dim">&gt;&gt;&gt; loaded adrien:m2 — streaming…</span>');
      tstream("Hi. I normalize museum catalogues with LLMs, benchmark 11 models against hand-made gold data, " +
        "teach a robot arm in MuJoCo, audit factory KPIs, and tune RC cars past 200 km/h. " +
        "Weights are not for sale, but inference is: vergneadrien65@gmail.com", function () {
        termBusy = false;
      });
    });
  }

  var COMMANDS = {
    help: function () {
      return [
        '<span class="t-cmd">Available commands</span>',
        '  about        who is Adrien',
        '  projects     list the projects        <span class="t-dim">open p01 … p09 to read one</span>',
        '  experience   work experience',
        '  skills       technical skills',
        '  education    studies',
        '  contact      how to reach me',
        '  cv           open the printable CV',
        '<span class="t-cmd">ML tools</span>',
        '  train        fit the model            <span class="t-dim">tqdm included</span>',
        '  ollama       list / run local models',
        '  nvidia-smi   check the GPU situation',
        '  neofetch     system information',
        '<span class="t-dim">Try also: whoami · ls · date · clear · sudo hire adrien</span>'
      ].join("\n");
    },
    about: function () { openWindow("win-about"); return "opening about.txt …"; },
    whoami: function () { return 'adrien — M2 NLP &amp; AI @ Sorbonne Université, freelance on the side.\n<span class="t-dim">Trains on free Kaggle GPUs. Trusts gold data over vibes.</span>'; },
    projects: function () {
      openWindow("win-projects");
      return [
        "p01  louvre-llm-pipeline    <span class='t-dim'>0.961 macro-F1 on 51,123 records</span>",
        "p02  mes-audit              <span class='t-dim'>read-only KPI verification</span>",
        "p03  smart-cafe-platform    <span class='t-dim'>CPU-only real-time vision</span>",
        "p04  so101-robot-arm        <span class='t-dim'>sim→real, voice-driven VLA</span>",
        "p05  safe-companion         <span class='t-dim'>44–45/45 red-team, 0 hard failures</span>",
        "p06  care-network           <span class='t-dim'>SvelteKit · PostGIS beta</span>",
        "p07  world-machine          <span class='t-dim'>society simulation engine</span>",
        "p08  electoral-model        <span class='t-dim'>LOO MAE 4.43 pts</span>",
        "p09  wifi-csi               <span class='t-dim'>presence from radio signals</span>",
        "<span class='t-dim'>type</span> open p01 <span class='t-dim'>(… p09) to read one</span>"
      ].join("\n");
    },
    experience: function () { openWindow("win-experience"); return "opening experience.log …"; },
    skills: function () { openWindow("win-skills"); return "opening skills.sys …"; },
    education: function () { openWindow("win-education"); return "opening education.db …"; },
    contact: function () { openWindow("win-contact"); return 'opening contact.mail …\n<span class="t-ac">vergneadrien65@gmail.com</span> · github.com/TeaS0710'; },
    cv: function () { openWindow("win-cv"); return "opening cv_adrien_vergne.pdf …"; },
    readme: function () { openWindow("win-readme"); return "opening README.md …"; },
    neofetch: function () { return NEOFETCH; },
    "nvidia-smi": function () {
      return 'NVIDIA-SMI has failed: <span class="t-ac">no GPU found on this machine</span>\n' +
        '<span class="t-dim">business as usual — training runs on free Kaggle/Modal quota,\n' +
        'inference stays on CPU. see p04 (robot arm) for the full recipe.</span>';
    },
    ls: function () { return "README.md   about.txt   projects/   experience.log   skills.sys\neducation.db   cv_adrien_vergne.pdf   contact.mail"; },
    date: function () { return new Date().toString(); },
    clear: function () { termOut.innerHTML = ""; return null; },
    exit: function () { closeWindow($("#win-terminal")); return null; }
  };

  function runCommand(raw) {
    var input = raw.trim();
    if (!input) return;
    tprint('<span class="tp-u">adrien@vergne-os</span><span class="tp-p">:~</span>$ <span class="t-cmd">' + esc(input) + "</span>");
    history.push(input);
    histIdx = history.length;

    if (termBusy) { tprint('<span class="t-dim">busy — one training run at a time on CPU.</span>'); return; }

    var lower = input.toLowerCase();

    if (/^sudo\s+hire\s+adrien/.test(lower) || lower === "hire" || lower === "hire adrien") {
      tprint('[sudo] checking credentials … <span class="t-ok">OK</span>\npermission granted ✓ — opening contact.mail');
      openWindow("win-contact");
      return;
    }
    if (/^open\s+p-?0?([1-9])$/.test(lower)) {
      var n = lower.match(/([1-9])$/)[1];
      tprint("opening p0" + n + " …");
      openWindow("win-p0" + n);
      return;
    }
    if (lower === "train" || /^python\s+train\.py/.test(lower)) { cmdTrain(); return; }
    if (/^ollama(\s|$)/.test(lower)) {
      var parts = lower.split(/\s+/);
      if (parts[1] === "list" || parts[1] === "ls") { tprint(OLLAMA_LIST); return; }
      if (parts[1] === "run" && parts[2]) { cmdOllamaRun(parts[2]); return; }
      if (parts[1] === "pull" && parts[2]) {
        termBusy = true;
        tbar(function (p) { return ollamaLine("3c9d41af", "19 GB", p); }, 700, function () {
          tprint('<span class="t-ok">success</span>');
          termBusy = false;
        });
        return;
      }
      tprint('usage: ollama <span class="t-dim">list · run adrien · pull &lt;model&gt;</span>');
      return;
    }
    if (/^pip\s+install\s+adrien/.test(lower)) {
      tprint('Collecting adrien\n  <span class="t-dim">Downloading adrien-2026.8-py3-none-any.whl (metadata: M2, Sorbonne)</span>\nInstalling collected packages: adrien\n<span class="t-ok">Successfully installed adrien-2026.8</span> — see contact.mail for licensing');
      return;
    }
    if (lower === "sudo") { tprint('<span class="t-dim">usage: sudo hire adrien</span>'); return; }
    if (/^cat\s+about/.test(lower)) { openWindow("win-about"); tprint("opening about.txt …"); return; }
    if (/^(cd\s+projects|cd\s+~\/projects)/.test(lower)) { openWindow("win-projects"); tprint("opening ~/projects …"); return; }

    var cmd = lower.split(/\s+/)[0];
    if (COMMANDS[cmd]) {
      var res = COMMANDS[cmd]();
      if (res) tprint(res);
    } else {
      tprint('command not found: ' + esc(cmd) + ' — <span class="t-dim">try</span> help');
    }
  }

  termForm.addEventListener("submit", function (e) {
    e.preventDefault();
    runCommand(termIn.value);
    termIn.value = "";
  });
  termIn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; termIn.value = history[histIdx] || ""; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < history.length) { histIdx++; termIn.value = history[histIdx] || ""; }
    }
  });

  tprint('<span class="t-cmd">VERGNE-OS terminal</span> — type <span class="t-ac">help</span> to get started.');

  /* ============ BOOT ============ */
  var boot = $("#boot");
  var bootLog = $("#boot-log");

  function bootLine(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    bootLog.appendChild(div);
    return div;
  }
  function bootBar(render, duration, done) {
    var div = bootLine(render(0));
    var t0 = Date.now();
    (function step() {
      if (boot.classList.contains("is-done")) return;
      var p = document.hidden ? 1 : Math.min(1, (Date.now() - t0) / duration);
      div.innerHTML = render(p);
      if (p < 1) setTimeout(step, 40);
      else done();
    })();
  }

  var BOOT_STEPS = [
    { line: '<span class="ac">VERGNE-OS 2.0</span> — boot sequence', d: 120 },
    { line: "[ <span class='ok'>OK</span> ] cpu0: human, caffeinated", d: 130 },
    { line: "[ <span class='ok'>OK</span> ] loading nlp.ko · mujoco.ko · freecad.ko", d: 140 },
    { line: "$ ollama pull adrien:m2", d: 160 },
    { bar: function (p) { return ollamaLine("8f2a1c9e", "51,123 records", p); }, d: 620 },
    { line: "verifying sha256 digest … <span class='ok'>OK</span>", d: 140 },
    { line: "$ python train.py --data louvre --gold 300", d: 170 },
    { bar: function (p) { return tqdmLine("normalize", 51123, "31.2k rec/s", p); }, d: 780 },
    { line: "eval: macro-F1 <span class='ok'>0.961</span> · red-team <span class='ok'>44-45/45</span>, 0 hard fails", d: 190 },
    { line: "starting window manager … <span class='ok'>done</span>", d: 280 }
  ];

  function endBoot() {
    if (boot.classList.contains("is-done")) return;
    boot.classList.add("is-done");
    try { sessionStorage.setItem("vos_booted", "1"); } catch (err) {}
    setTimeout(function () { boot.remove(); }, 450);
    if (!isMobile()) openWindow("win-readme");
  }

  var skipBoot = reducedMotion;
  try { skipBoot = skipBoot || sessionStorage.getItem("vos_booted") === "1"; } catch (err) {}

  if (skipBoot) {
    endBoot();
  } else {
    setTimeout(endBoot, 8000); /* safety net: never stall on the boot screen */
    boot.addEventListener("click", endBoot);
    document.addEventListener("keydown", function onKey() {
      endBoot();
      document.removeEventListener("keydown", onKey);
    });
    var i = 0;
    (function next() {
      if (boot.classList.contains("is-done")) return;
      if (i >= BOOT_STEPS.length) { setTimeout(endBoot, 380); return; }
      var s = BOOT_STEPS[i++];
      if (s.bar) bootBar(s.bar, s.d, next);
      else { bootLine(s.line); setTimeout(next, s.d); }
    })();
  }
})();
