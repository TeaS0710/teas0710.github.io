/* VERGNE-OS — window manager, boot sequence, terminal. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var desktop = $("#desktop");
  var isMobile = function () {
    return window.matchMedia("(max-width: 720px), (pointer: coarse) and (max-width: 1024px)").matches;
  };

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
    }
    focusWindow(win);
    if (id === "win-terminal") setTimeout(function () { $("#term-in").focus(); }, 60);
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
  function syncTaskbar() {
    $$(".tbtask", tasksEl).forEach(function (b) {
      var win = document.getElementById(b.getAttribute("data-task"));
      b.classList.toggle("is-active", win.classList.contains("is-active") && !win.classList.contains("is-min"));
      b.classList.toggle("is-min", win.classList.contains("is-min"));
    });
  }

  /* clock */
  var timeEl = $("#tb-time");
  var dateEl = $("#tb-date");
  function tick() {
    var d = new Date();
    timeEl.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    dateEl.textContent = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  tick();
  setInterval(tick, 15000);

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

  $("#term-body").addEventListener("click", function (e) {
    if (!window.getSelection().toString()) termIn.focus();
  });

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function print(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    termOut.appendChild(div);
    termOut.scrollTop = termOut.scrollHeight;
  }

  var NEOFETCH = [
    '<span class="t-ac"> ✳✳✳✳✳✳✳ </span>  <span class="t-cmd">adrien</span>@<span class="t-cmd">vergne-os</span>',
    '<span class="t-ac">✳✳     ✳✳</span>  ─────────────────',
    '<span class="t-ac">✳✳  ✳  ✳✳</span>  OS:       VERGNE-OS 2.0 (paper edition)',
    '<span class="t-ac">✳✳     ✳✳</span>  Host:     Sorbonne Université — M2 NLP &amp; AI',
    '<span class="t-ac"> ✳✳✳✳✳✳✳ </span>  Kernel:   nlp-6.1-llm',
    '           Shell:    vanilla-js (no framework)',
    '           Uptime:   coding since 2022',
    '           Packages: 15+ projects (9 featured)',
    '           Gold:     F1 macro 0.961 · 51,123 records',
    '           Contact:  vergneadrien65@gmail.com'
  ].join("\n");

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
        '  neofetch     system information',
        '  clear        clear the terminal',
        '<span class="t-dim">Try also: whoami · ls · date · sudo hire adrien</span>'
      ].join("\n");
    },
    about: function () { openWindow("win-about"); return "opening about.txt …"; },
    whoami: function () { return 'adrien — AI &amp; NLP engineering, M2 @ Sorbonne Université.\n<span class="t-dim">Builds measured, auditable systems. Likes gold data and fast RC cars.</span>'; },
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
    ls: function () { return "README.md   about.txt   projects/   experience.log   skills.sys\neducation.db   cv_adrien_vergne.pdf   contact.mail"; },
    date: function () { return new Date().toString(); },
    clear: function () { termOut.innerHTML = ""; return null; },
    exit: function () { closeWindow($("#win-terminal")); return null; }
  };

  function runCommand(raw) {
    var input = raw.trim();
    if (!input) return;
    print('<span class="t-ac">adrien@vergne-os:~$</span> <span class="t-cmd">' + esc(input) + "</span>");
    history.push(input);
    histIdx = history.length;

    var lower = input.toLowerCase();

    if (/^sudo\s+hire\s+adrien/.test(lower) || lower === "hire" || lower === "hire adrien") {
      print('[sudo] checking credentials … <span class="t-ok">OK</span>\npermission granted ✓ — opening contact.mail');
      openWindow("win-contact");
      return;
    }
    if (/^open\s+p-?0?([1-9])$/.test(lower)) {
      var n = lower.match(/([1-9])$/)[1];
      print("opening p0" + n + " …");
      openWindow("win-p0" + n);
      return;
    }
    if (lower === "sudo") { print('<span class="t-dim">usage: sudo hire adrien</span>'); return; }
    if (/^cat\s+about/.test(lower)) { openWindow("win-about"); print("opening about.txt …"); return; }
    if (/^(cd\s+projects|cd\s+~\/projects)/.test(lower)) { openWindow("win-projects"); print("opening ~/projects …"); return; }

    var cmd = lower.split(/\s+/)[0];
    if (COMMANDS[cmd]) {
      var res = COMMANDS[cmd]();
      if (res) print(res);
    } else {
      print('command not found: ' + esc(cmd) + ' — <span class="t-dim">try</span> help');
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

  print('<span class="t-cmd">VERGNE-OS terminal</span> — type <span class="t-ac">help</span> to get started.');

  /* ============ BOOT ============ */
  var boot = $("#boot");
  var bootLog = $("#boot-log");
  var BOOT_LINES = [
    ["VERGNE-OS 2.0 — paper edition bootloader", 0],
    ["cpu0: human, caffeinated ................ <span class='ok'>OK</span>", 140],
    ["loading nlp.ko .......................... <span class='ok'>OK</span>", 120],
    ["loading mujoco.ko ....................... <span class='ok'>OK</span>", 110],
    ["loading freecad.ko ...................... <span class='ok'>OK</span>", 100],
    ["mounting /projects (15 volumes) ......... <span class='ok'>OK</span>", 150],
    ["verifying gold data: F1=0.961 ........... <span class='ok'>OK</span>", 160],
    ["red-team suite: 44-45/45, 0 hard fails .. <span class='ok'>OK</span>", 150],
    ["starting window manager ................. <span class='ac'>✳</span>", 200]
  ];

  function endBoot() {
    if (boot.classList.contains("is-done")) return;
    boot.classList.add("is-done");
    try { sessionStorage.setItem("vos_booted", "1"); } catch (err) {}
    setTimeout(function () { boot.remove(); }, 450);
    openWindow("win-readme");
  }

  var skipBoot = false;
  try { skipBoot = sessionStorage.getItem("vos_booted") === "1"; } catch (err) {}
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) skipBoot = true;

  if (skipBoot) {
    endBoot();
  } else {
    boot.addEventListener("click", endBoot);
    document.addEventListener("keydown", function onKey() {
      endBoot();
      document.removeEventListener("keydown", onKey);
    });
    var i = 0;
    (function next() {
      if (boot.classList.contains("is-done")) return;
      if (i >= BOOT_LINES.length) { setTimeout(endBoot, 420); return; }
      var line = BOOT_LINES[i];
      var div = document.createElement("div");
      div.innerHTML = line[0];
      bootLog.appendChild(div);
      i++;
      setTimeout(next, line[1]);
    })();
  }
})();
