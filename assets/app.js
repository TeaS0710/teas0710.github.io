(function () {
  "use strict";

  /* Scroll progress bar */
  var progressBar = document.getElementById("scroll-progress-bar");
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? window.scrollY / max : 0;
    progressBar.style.width = (ratio * 100).toFixed(2) + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* Print / PDF */
  document.getElementById("print-cv").addEventListener("click", function () {
    window.print();
  });

  /* Reveal sections on scroll */
  var revealables = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Active section in top nav */
  var navLinks = document.querySelectorAll("#main-nav a");
  var sectionsById = {};
  navLinks.forEach(function (link) {
    var section = document.querySelector(link.getAttribute("href"));
    if (section) sectionsById[section.id] = link;
  });
  if ("IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.classList.remove("is-active"); });
            var link = sectionsById[entry.target.id];
            if (link) link.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    Object.keys(sectionsById).forEach(function (id) {
      navObserver.observe(document.getElementById(id));
    });
  }

  /* Project filters */
  var chips = document.querySelectorAll(".chip");
  var projects = document.querySelectorAll(".project");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("is-active"); });
      chip.classList.add("is-active");
      var filter = chip.getAttribute("data-filter");
      projects.forEach(function (card) {
        var cats = (card.getAttribute("data-cat") || "").split(/\s+/);
        var show = filter === "all" || cats.indexOf(filter) !== -1;
        card.classList.toggle("is-hidden", !show);
      });
    });
  });
})();
