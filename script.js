// ── Mobile nav ──
const burger = document.getElementById("burger");
const nav = document.getElementById("siteNav");
if (burger && nav) {
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    })
  );
}

// ── Before / after slider ──
const range = document.getElementById("compareRange");
const compareTop = document.getElementById("compareTop");
const handle = document.getElementById("compareHandle");
if (range && compareTop && handle) {
  const update = () => {
    const v = Number(range.value);
    compareTop.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)";
    handle.style.left = v + "%";
  };
  range.addEventListener("input", update);
  update();
}

// ── Nighttime lights stepper ──
const lightsImg = document.getElementById("lightsImg");
const lightsBtns = document.querySelectorAll(".lights__btn");
if (lightsImg && lightsBtns.length) {
  // Preload frames so switching is instant.
  lightsBtns.forEach((btn) => {
    new Image().src = "assets/images/lights-" + btn.dataset.year + ".jpg";
  });
  lightsBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      lightsBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const year = btn.dataset.year;
      lightsImg.src = "assets/images/lights-" + year + ".jpg";
      lightsImg.alt =
        "Nighttime lights over the Shenzhen and Hong Kong region in " + year;
    });
  });
}

// ── Now building tabs (arrow keys move between tabs) ──
const tabList = document.querySelector("#buildTabs [role='tablist']");
if (tabList) {
  const tabs = Array.from(tabList.querySelectorAll("[role='tab']"));
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      let j = null;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") j = 0;
      if (e.key === "End") j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); tabs[j].focus(); select(tabs[j]); }
    });
  });
}

// ── Reveal on scroll ──
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion && "IntersectionObserver" in window) {
  const targets = document.querySelectorAll(".case, .mini, .principle, .job, .small-card, .now");
  targets.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  targets.forEach((el) => io.observe(el));
}

// ── Footer year ──
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
