// Alexander Dakin · site v4. Hash routing between views, one page per project,
// and the interactive figures. d3 and topojson-client load before this file.
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const hasD3 = typeof window.d3 !== "undefined";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Seeded random numbers, so figures look the same on every visit.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function gamma(r, k) { // Marsaglia and Tsang
  if (k < 1) return gamma(r, k + 1) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r();
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
const fmt = (x, d = 0) => Number(x).toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });

// ── Tooltip ──
const tip = $("#tip");
function showTip(html, x, y) {
  tip.innerHTML = html; tip.classList.add("is-on");
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(window.innerWidth - w - 10, Math.max(10, x + 14)) + "px";
  tip.style.top = Math.min(window.innerHeight - h - 10, Math.max(10, y + 14)) + "px";
}
function hideTip() { tip.classList.remove("is-on"); }

// ── Mobile nav ──
const burger = $("#burger"), nav = $("#siteNav");
burger.addEventListener("click", () => { const open = nav.classList.toggle("is-open"); burger.setAttribute("aria-expanded", String(open)); });
$$("a", nav).forEach(a => a.addEventListener("click", () => { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }));

// ── Routing ──
const VIEWS = ["home", "projects", "experience", "about"];
const LEGACY = { work: "projects", top: "home", contact: "about", building: "projects" };
const ORDER = $$("#ptabs a").map(a => a.getAttribute("href").slice(1));
const initDone = new Set();

function route() {
  let h = decodeURIComponent(location.hash.slice(1)) || "home";
  if (LEGACY[h]) h = LEGACY[h];
  let view = h, project = null, scrollTarget = null;
  if (h === "approach") { view = "home"; scrollTarget = "approach"; }
  else if (h.startsWith("p-") && document.getElementById(h)) { view = "project"; project = h; }
  else if (!VIEWS.includes(h)) view = "home";

  $$(".view").forEach(v => { v.hidden = v.dataset.view !== view; });
  $$("[data-nav]").forEach(a => a.setAttribute("aria-current", a.dataset.nav === (view === "project" ? "projects" : view) ? "page" : "false"));

  if (project) {
    $$(".project").forEach(p => { p.hidden = p.id !== project; });
    $$("#ptabs a").forEach(a => {
      const on = a.getAttribute("href") === "#" + project;
      a.setAttribute("aria-current", on ? "page" : "false");
      if (on) a.scrollIntoView({ block: "nearest", inline: "center" });
    });
    const i = ORDER.indexOf(project), prev = ORDER[i - 1], next = ORDER[i + 1];
    const label = id => $(`#ptabs a[href="#${id}"]`).textContent;
    $("#pnext").innerHTML = (prev ? `<a href="#${prev}"><span>Previous</span>${label(prev)}</a>` : "<i></i>") + (next ? `<a href="#${next}" style="text-align:right"><span>Next</span>${label(next)}</a>` : "");
    if (!initDone.has(project) && INIT[project]) { initDone.add(project); INIT[project](); }
    document.title = $(`#${project} h2`).textContent + " · Alexander Dakin";
  } else {
    document.title = "Alexander Dakin · Maps, data and AI";
  }
  if (view === "home" && !initDone.has("hero")) { initDone.add("hero"); heroMap(); }
  hideTip();
  if (scrollTarget) document.getElementById(scrollTarget).scrollIntoView();
  else window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ── Map data ──
let worldP = null;
function world() {
  if (!worldP) worldP = fetch("assets/data/world-110m.json").then(r => r.json()).then(t => ({
    land: topojson.feature(t, t.objects.land),
    borders: topojson.mesh(t, t.objects.countries, (a, b) => a !== b),
  }));
  return worldP;
}

function drawPins(g, pins, proj, opts) {
  const sel = g.selectAll("g.pin").data(pins).join("g")
    .attr("class", d => "pin" + (d.career ? " pin--career" : ""))
    .attr("transform", d => { const p = proj([d.lon, d.lat]); return `translate(${p[0]},${p[1]})`; })
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => d.name + ". " + d.meta);
  sel.append("circle").attr("class", "pin__glow").attr("r", opts.glow || 11);
  if (!reduceMotion && opts.pulse) sel.filter(d => !d.career).append("circle").attr("class", "pin__pulse").attr("r", 6).style("animation-delay", (d, i) => (i * 0.37) % 2.4 + "s");
  sel.append("circle").attr("class", "pin__core").attr("r", opts.core || 3.6);
  if (opts.labels) sel.append("text").attr("class", "pin__label").attr("x", d => d.dx || 8).attr("y", d => d.dy || 4).attr("text-anchor", d => d.anchor || "start").text(d => d.short || d.name);
  sel.on("pointerenter", (e, d) => showTip(`<b>${d.name}</b>${d.meta}<div class="tip__meta">${fmt(Math.abs(d.lat), 2)}° ${d.lat >= 0 ? "N" : "S"}, ${fmt(Math.abs(d.lon), 2)}° ${d.lon >= 0 ? "E" : "W"}</div>`, e.clientX, e.clientY))
    .on("pointermove", e => showTip(tip.innerHTML, e.clientX, e.clientY))
    .on("pointerleave", hideTip)
    .on("click", (e, d) => opts.onSelect(d, sel))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onSelect(d, sel); } });
  return sel;
}

// ── Hero map ──
const PROJECT_PINS = [
  { name: "Bakhmut", lon: 38.0, lat: 48.6, meta: "Damage Maps: radar change detection", href: "p-damage-maps" },
  { name: "Tehran and Natanz", lon: 51.5, lat: 34.7, meta: "Damage Maps: radar change detection", href: "p-damage-maps" },
  { name: "Qatar", lon: 51.4, lat: 25.5, meta: "Damage Maps: an air base and a gas plant", href: "p-damage-maps" },
  { name: "Konarak", lon: 60.38, lat: 25.35, meta: "Damage Maps: a naval base", href: "p-damage-maps" },
  { name: "Tel Aviv", lon: 34.78, lat: 32.09, meta: "Damage Maps: radar change detection", href: "p-damage-maps" },
  { name: "Shenzhen", lon: 114.06, lat: 22.54, meta: "Three decades of growth from orbit", href: "p-shenzhen" },
  { name: "Great Britain", lon: -1.6, lat: 53.6, meta: "Grid constraint costs, peatland recovery, fuel prices", href: "p-grid" },
  { name: "London", lon: -0.12, lat: 51.5, meta: "Data and AI work for an NGO network; North London radar control", href: "p-library-assistant" },
  { name: "The Alps", lon: 10.3, lat: 46.6, meta: "Ski Alpin Fantasy: World Cup alpine skiing", href: "p-ski" },
];
const CAREER_PINS = [
  { name: "French-speaking Switzerland", lon: 6.63, lat: 46.52, meta: "Grew up here; UN internship in Geneva, 2018", href: "experience", career: true },
  { name: "Bristol", lon: -2.59, lat: 51.45, meta: "BSc Mathematics and Economics", href: "experience", career: true },
  { name: "Amsterdam", lon: 4.9, lat: 52.37, meta: "MSc Economics: an experiment on people working with text-generating AI", href: "experience", career: true },
  { name: "London", lon: -0.12, lat: 51.51, meta: "Crowd DNA, Bloomberg, and now an NGO network", href: "experience", career: true },
  { name: "Southeast Asia", lon: 104.9, lat: 13.0, meta: "Five months of travel, 2025 to 2026", href: "about", career: true },
];
let heroLayer = "projects";
function heroMap() {
  const host = $("#heroMap");
  if (!hasD3) return;
  world().then(w => {
    const W = host.clientWidth || 1200, H = host.clientHeight || 600, mobile = W < 760;
    host.innerHTML = "";
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid slice").attr("aria-hidden", "false");
    const proj = d3.geoNaturalEarth1().rotate([-40, 0]);
    const box = { type: "MultiPoint", coordinates: [[-15, 62], [118, 8], [-15, 8], [118, 62]] };
    proj.fitExtent(mobile ? [[10, 10], [W - 10, H - 10]] : [[W * 0.45, 40], [W - 30, H - 40]], box);
    const path = d3.geoPath(proj);
    svg.append("path").attr("class", "graticule").attr("d", path(d3.geoGraticule().step([10, 10])()));
    svg.append("path").attr("class", "land").attr("d", path(w.land));
    svg.append("path").attr("d", path(w.borders)).attr("fill", "none").attr("stroke", "var(--land-line)").attr("stroke-width", 0.4);
    const g = svg.append("g");
    const draw = () => {
      g.selectAll("*").remove();
      const pins = heroLayer === "projects" ? PROJECT_PINS : CAREER_PINS;
      drawPins(g, pins, proj, { pulse: true, labels: !mobile, onSelect: d => { location.hash = d.href; } });
    };
    draw();
    $$(".maplayers__btn").forEach(b => b.onclick = () => {
      heroLayer = b.dataset.layer;
      $$(".maplayers__btn").forEach(x => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
      draw();
    });
  }).catch(() => { host.innerHTML = ""; });
}
let rz = 0;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (!$("#view-home").hidden) heroMap(); }, 200); });

// ── Damage Maps: area map ──
const DAMAGE = [
  { name: "Bakhmut, Ukraine", short: "Bakhmut", lon: 38.0, lat: 48.595, meta: "Conflict zone. A city fought over street by street, the closest case to the method's own published use." },
  { name: "Tehran, Iran", short: "Tehran", lon: 51.389, lat: 35.689, meta: "Urban and military sites, analysed around a test date in March 2026.", dx: -8, anchor: "end" },
  { name: "Natanz, Iran", short: "Natanz", lon: 51.727, lat: 33.724, meta: "A nuclear site, analysed around the same test date.", dy: 14 },
  { name: "Al Udeid, Qatar", short: "Al Udeid", lon: 51.315, lat: 25.117, meta: "An air base, analysed around the same test date.", dx: -8, anchor: "end", dy: 12 },
  { name: "Gas plant, Qatar", short: "Ras Laffan", lon: 51.531, lat: 25.917, meta: "An industrial site. The image further down shows the method's output there.", dx: -8, anchor: "end", dy: -4 },
  { name: "Konarak, Iran", short: "Konarak", lon: 60.38, lat: 25.35, meta: "A naval base on the Gulf of Oman." },
  { name: "Tel Aviv, Israel", short: "Tel Aviv", lon: 34.782, lat: 32.085, meta: "An urban area.", dx: -8, anchor: "end" },
  { name: "North London, UK", short: "North London", lon: -0.103, lat: 51.546, meta: "The control: the identical pipeline and test date, in a city where nothing happened." },
];
function damageMap() {
  const host = $("#damageMap");
  if (!hasD3) return;
  world().then(w => {
    const W = 800, H = 450;
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const proj = d3.geoMercator().fitExtent([[30, 30], [W - 40, H - 30]], { type: "MultiPoint", coordinates: [[-8, 56], [64, 21]] });
    const path = d3.geoPath(proj);
    svg.append("path").attr("class", "graticule").attr("d", path(d3.geoGraticule().step([5, 5])()));
    svg.append("path").attr("class", "land").attr("d", path(w.land));
    svg.append("path").attr("d", path(w.borders)).attr("fill", "none").attr("stroke", "var(--land-line)").attr("stroke-width", 0.6);
    const read = $("#damageInfo");
    const sel = drawPins(svg.append("g"), DAMAGE, proj, { labels: true, glow: 9, core: 3.4, onSelect: (d, all) => {
      all.classed("is-on", x => x === d);
      read.innerHTML = `<b>${d.name}</b> · <span class="muted">${fmt(d.lat, 3)}° N, ${fmt(Math.abs(d.lon), 3)}° ${d.lon >= 0 ? "E" : "W"}</span><br>${d.meta}`;
    } });
  });
}

// ── Damage Maps: pixel t-test ──
function ttest() {
  const host = $("#ttestChart");
  const r = rng(7), N = 15, zPre = d3.range(N).map(() => normal(r)), zPost = d3.range(N).map(() => normal(r));
  const W = 640, H = 230, m = { l: 48, r: 20, t: 16, b: 34 };
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Dot plot of radar backscatter before and after a date for one pixel");
  const y = d3.scaleLinear().domain([-22, 4]).range([H - m.b, m.t]);
  const x = { pre: 200, post: 440 };
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d => d + " dB"));
  svg.append("g").selectAll("line").data(y.ticks(5)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", d => y(d)).attr("y2", d => y(d));
  svg.append("text").attr("class", "ann").attr("x", x.pre).attr("y", H - 10).attr("text-anchor", "middle").text("Before the date");
  svg.append("text").attr("class", "ann").attr("x", x.post).attr("y", H - 10).attr("text-anchor", "middle").text("After the date");
  const gPre = svg.append("g"), gPost = svg.append("g"), gMean = svg.append("g");
  const draw = () => {
    const change = +$("#ttChange").value, noise = +$("#ttNoise").value;
    $("#ttChangeOut").textContent = fmt(change, 1) + " dB"; $("#ttNoiseOut").textContent = fmt(noise, 1) + " dB";
    const pre = zPre.map(z => -10 + noise * z), post = zPost.map(z => -10 + change + noise * z);
    const jit = i => ((i * 37) % 11 - 5) * 7;
    gPre.selectAll("circle").data(pre).join("circle").attr("cx", (d, i) => x.pre + jit(i)).attr("cy", d => y(d)).attr("r", 4).attr("fill", "var(--series-b)");
    gPost.selectAll("circle").data(post).join("circle").attr("cx", (d, i) => x.post + jit(i)).attr("cy", d => y(d)).attr("r", 4).attr("fill", "var(--series-a)");
    const mp = d3.mean(pre), mq = d3.mean(post), vp = d3.variance(pre), vq = d3.variance(post);
    const t = (mq - mp) / Math.sqrt(vp / N + vq / N);
    gMean.selectAll("*").remove();
    [[x.pre, mp], [x.post, mq]].forEach(([cx, v]) => gMean.append("line").attr("x1", cx - 50).attr("x2", cx + 50).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "var(--ink)").attr("stroke-width", 2));
    gMean.append("text").attr("class", "ann").attr("x", x.post + 58).attr("y", y(mq) + 4).text("mean");
    const flagged = Math.abs(t) > 3;
    $("#ttRead").innerHTML = `t = <b>${fmt(t, 1)}</b>. ${flagged ? "<b>Flagged as changed.</b>" : "Not flagged."} The test only asks whether the pixel changed more than its own noise allows. Whether that change is damage is a separate question, which is why a person checks.`;
  };
  ["ttChange", "ttNoise"].forEach(id => $("#" + id).addEventListener("input", draw));
  draw();
}

// ── Displacement: signals ──
const SIG = ["Population estimate", "Night lights", "Vegetation"];
const SCEN = {
  flee: { dirs: [["–", "Modelled about once a year, so it barely moves for months."], ["↓", "Fewer homes and shops lit."], ["↓", "Untended fields brown over a season."]], read: "Lights and vegetation both fall. The population layer lags too much to help in the moment." },
  power: { dirs: [["–", "No change."], ["↓", "Looks exactly like people leaving."], ["–", "No change."]], read: "Night lights alone would raise a false alarm here. Steady vegetation, and no new lights anywhere else, tell it apart." },
  harvest: { dirs: [["–", "No change."], ["–", "No change."], ["↓", "Cut crops look like abandoned land."]], read: "Vegetation alone would raise a false alarm. Comparing with the same month in past years removes most of it." },
  camp: { dirs: [["–", "Lags, as above."], ["↑", "A new cluster of light appears."], ["↓", "Ground is cleared around the camp."]], read: "The arrival side of a movement often shows more clearly than the departure side." },
};
function signals() {
  const draw = k => {
    const s = SCEN[k];
    $("#signals").innerHTML = s.dirs.map((d, i) => `<div class="signal"><h4>${SIG[i]}</h4><div class="signal__dir ${d[0] === "↑" ? "up" : d[0] === "↓" ? "down" : ""}">${d[0]}</div><p>${d[1]}</p></div>`).join("");
    $("#signalRead").textContent = s.read;
  };
  $$(".scenario__btn").forEach(b => b.addEventListener("click", () => {
    $$(".scenario__btn").forEach(x => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
    draw(b.dataset.s);
  }));
  draw("flee");
}

// ── Peatland: difference-in-differences ──
function did() {
  const host = $("#didChart");
  const M = 96, T0 = 48, S = 10, r = rng(11);
  const z = d3.range(2 * S).map(() => d3.range(M).map(() => normal(r)));
  const off = d3.range(2 * S).map(() => normal(r) * 0.02);
  const months = d3.range(M).map(i => new Date(2018, i, 1));
  const W = 660, H = 260, m = { l: 46, r: 16, t: 14, b: 30 };
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Average moisture index for restored sites and controls, 2018 to 2025, with the restoration date marked");
  const x = d3.scaleTime().domain([months[0], months[M - 1]]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().range([H - m.b, m.t]);
  const gx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`);
  const gy = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`);
  const grid = svg.append("g");
  svg.append("rect").attr("x", x(months[T0])).attr("y", m.t).attr("width", x(months[M - 1]) - x(months[T0])).attr("height", H - m.t - m.b).attr("fill", "rgba(240,181,92,0.05)");
  svg.append("line").attr("x1", x(months[T0])).attr("x2", x(months[T0])).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "var(--ink-2)").attr("stroke-dasharray", "4 4");
  svg.append("text").attr("class", "ann").attr("x", x(months[T0]) + 6).attr("y", m.t + 10).text("Restoration");
  const pc = svg.append("path").attr("fill", "none").attr("stroke", "var(--series-b)").attr("stroke-width", 2);
  const pt = svg.append("path").attr("fill", "none").attr("stroke", "var(--series-a)").attr("stroke-width", 2);
  const cross = svg.append("line").attr("stroke", "var(--ink-3)").attr("y1", m.t).attr("y2", H - m.b).style("opacity", 0);
  let series = null;
  const draw = () => {
    const eff = +$("#didEff").value, noise = +$("#didNoise").value, trend = +$("#didTrend").value;
    $("#didEffOut").textContent = fmt(eff, 2); $("#didNoiseOut").textContent = fmt(noise, 3);
    $("#didTrendOut").textContent = trend ? "+" + fmt(trend, 3) + " a year" : "no";
    const site = (j, t) => 0.2 + off[j] + noise * z[j][t];                      // seasonal cycle already removed
    const treated = d3.range(M).map(t => d3.mean(d3.range(S), j => site(j, t) + (t >= T0 ? eff : 0) + trend * (t - T0) / 12));
    const control = d3.range(M).map(t => d3.mean(d3.range(S), j => site(S + j, t)));
    const smooth = a => a.map((v, i) => d3.mean(a.slice(Math.max(0, i - 2), i + 1)));
    series = { t: smooth(treated), c: smooth(control) };
    y.domain([d3.min([...series.t, ...series.c]) - 0.01, d3.max([...series.t, ...series.c]) + 0.01]).nice();
    gx.call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));
    gy.call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2f")));
    grid.selectAll("line").data(y.ticks(4)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", d => y(d)).attr("y2", d => y(d));
    const line = d3.line().x((d, i) => x(months[i])).y(d => y(d));
    pt.attr("d", line(series.t)); pc.attr("d", line(series.c));
    const pre = a => d3.mean(a.slice(0, T0)), post = a => d3.mean(a.slice(T0));
    const est = (post(treated) - pre(treated)) - (post(control) - pre(control));
    const off2 = Math.abs(est - eff) > 0.01;
    $("#didRead").innerHTML = `Estimated effect <b>${fmt(est, 3)}</b> against a true effect of <b>${fmt(eff, 2)}</b>. ` + (trend ? (off2 ? "The groups were already drifting apart, and the method cannot tell that from restoration. This is why the pre-period is checked before anything else." : "The drift is small enough not to matter yet.") : (off2 ? "Noise is large enough to blur the estimate." : "With parallel trends, the comparison recovers the effect."));
  };
  svg.on("pointermove", e => {
    if (!series) return;
    const [px] = d3.pointer(e); const i = Math.max(0, Math.min(M - 1, Math.round((x.invert(px) - months[0]) / (30.44 * 864e5))));
    cross.attr("x1", x(months[i])).attr("x2", x(months[i])).style("opacity", 1);
    showTip(`<b>${d3.timeFormat("%B %Y")(months[i])}</b>Restored ${fmt(series.t[i], 3)}<br>Controls ${fmt(series.c[i], 3)}`, e.clientX, e.clientY);
  }).on("pointerleave", () => { cross.style("opacity", 0); hideTip(); });
  ["didEff", "didNoise", "didTrend"].forEach(id => $("#" + id).addEventListener("input", draw));
  draw();
}

// ── Library assistant: steps and age chart ──
function rag() {
  const items = $$("#ragSteps li"); let k = 0;
  const show = () => items.forEach((li, i) => { li.classList.toggle("is-on", i === k); li.classList.toggle("is-done", i < k); });
  $("#ragNext").onclick = () => { k = (k + 1) % items.length; show(); };
  $("#ragPrev").onclick = () => { k = (k - 1 + items.length) % items.length; show(); };
  show();
}
const LIB = { bands: ["0–2 years", "3–5 years", "6–9 years", "10+ years"], kinds: ["Guidance", "Research or article", "Record of an event"],
  data: [[28, 48, 51], [188, 140, 131], [176, 117, 43], [147, 158, 25]] };
function libChart() {
  const host = $("#libChart"), W = 640, H = 260, m = { l: 44, r: 12, t: 22, b: 30 };
  const colors = ["var(--series-a)", "var(--series-b)", "var(--ink-3)"];
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Stacked bars of library items by age band and kind");
  const x = d3.scaleBand().domain(LIB.bands).range([m.l, W - m.r]).padding(0.35);
  const totals = LIB.data.map(d => d3.sum(d));
  const y = d3.scaleLinear().domain([0, d3.max(totals) * 1.12]).range([H - m.b, m.t]);
  svg.append("g").selectAll("line").data(y.ticks(4)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", d => y(d)).attr("y2", d => y(d));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSize(0)).select(".domain").remove();
  LIB.data.forEach((row, bi) => {
    let acc = 0;
    row.forEach((v, ki) => {
      const y0 = y(acc), y1 = y(acc + v); acc += v;
      svg.append("rect").attr("x", x(LIB.bands[bi])).attr("width", x.bandwidth()).attr("y", y1 + 1).attr("height", Math.max(0, y0 - y1 - 2)).attr("rx", ki === row.length - 1 ? 4 : 0).attr("fill", colors[ki])
        .on("pointerenter pointermove", e => showTip(`<b>${LIB.kinds[ki]}</b>${v} items, ${LIB.bands[bi]} old`, e.clientX, e.clientY)).on("pointerleave", hideTip);
    });
    svg.append("text").attr("class", "ann").attr("x", x(LIB.bands[bi]) + x.bandwidth() / 2).attr("y", y(totals[bi]) - 6).attr("text-anchor", "middle").text(totals[bi]);
  });
  $("#libLegend").innerHTML = LIB.kinds.map((k, i) => `<span><i class="sw sw--${"abc"[i]}"></i>${k}</span>`).join("");
}

// ── Spending model: Monte Carlo ──
function monteCarlo() {
  const host = $("#mcChart"), W = 660, H = 250, m = { l: 44, r: 16, t: 18, b: 34 };
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Histogram of the simulated return on security spending");
  const gx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`);
  const bars = svg.append("g"), marks = svg.append("g");
  const KS = { 1: [1.5, "low"], 2: [4, "medium"], 3: [18, "high"] };
  const draw = () => {
    const rate = +$("#mcRate").value, k = KS[$("#mcK").value][0], cost = +$("#mcCost").value, eff = +$("#mcEff").value / 100, spend = +$("#mcSpend").value;
    $("#mcRateOut").textContent = fmt(rate, 1); $("#mcKOut").textContent = KS[$("#mcK").value][1];
    $("#mcCostOut").textContent = "£" + cost + "k"; $("#mcEffOut").textContent = Math.round(eff * 100) + "%"; $("#mcSpendOut").textContent = "£" + spend + "k";
    const r = rng(2026), N = 2000, lo = eff * 0.4, hi = Math.min(0.95, eff * 1.6);
    const a = 1 + 4 * (eff - lo) / (hi - lo), b = 1 + 4 * (hi - eff) / (hi - lo);
    const roi = d3.range(N).map(() => {
      const lam = gamma(r, k) * rate / k;
      const c = cost * Math.exp(0.8 * normal(r));
      const ga = gamma(r, a), gb = gamma(r, b), e = lo + (hi - lo) * ga / (ga + gb);
      return (lam * c * e - spend) / spend * 100;
    });
    const clipped = roi.map(v => Math.max(-100, Math.min(400, v)));
    const x = d3.scaleLinear().domain([-100, 400]).range([m.l, W - m.r]);
    const bins = d3.bin().domain([-100, 400.01]).thresholds(d3.range(-100, 401, 20))(clipped);
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([H - m.b, m.t]);
    gx.call(d3.axisBottom(x).tickValues([-100, 0, 100, 200, 300, 400]).tickFormat(d => (d === 400 ? "400%+" : d + "%")));
    bars.selectAll("rect").data(bins).join("rect")
      .attr("x", d => x(d.x0) + 1).attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("y", d => y(d.length)).attr("height", d => y(0) - y(d.length)).attr("rx", 2)
      .attr("fill", d => d.x0 < 0 ? "var(--series-b)" : "var(--series-a)")
      .on("pointerenter pointermove", (e, d) => showTip(`<b>${d.x0}% to ${d.x1 >= 400 ? "400%+" : d.x1 + "%"}</b>${d.length} of 2,000 runs`, e.clientX, e.clientY)).on("pointerleave", hideTip);
    const med = d3.median(roi), mean = d3.mean(roi), pos = roi.filter(v => v > 0).length / N;
    marks.selectAll("*").remove();
    [[med, "middle run"], [mean, "average"]].forEach(([v, lab], i) => {
      const xv = x(Math.max(-100, Math.min(400, v)));
      marks.append("line").attr("x1", xv).attr("x2", xv).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "var(--ink)").attr("stroke-dasharray", i ? "2 3" : "none").attr("stroke-width", 1.5);
      marks.append("text").attr("class", "ann").attr("x", xv + 5).attr("y", m.t + 10 + i * 14).text(lab);
    });
    $("#mcRead").innerHTML = `Middle run <b>${med >= 0 ? "+" : ""}${fmt(med)}%</b>, average <b>${mean >= 0 ? "+" : ""}${fmt(mean)}%</b>. The measures pay for themselves in <b>${fmt(pos * 100)}%</b> of the 2,000 runs. A long right tail pulls the average above the middle, which is why the middle run is the safer headline.`;
  };
  ["mcRate", "mcK", "mcCost", "mcEff", "mcSpend"].forEach(id => $("#" + id).addEventListener("input", draw));
  draw();
}

// ── Data map: systems ──
const SYS = {
  nodes: [
    { id: "web", label: "Website", x: 110, y: 70, text: "Public pages and the resource library. Sign-up and event forms are embedded here." },
    { id: "forms", label: "Online forms", x: 110, y: 230, text: "Registrations and surveys. An integration writes each submission into the CRM, so field mappings must match the CRM's categories." },
    { id: "crm", label: "CRM", x: 360, y: 150, text: "The record of organisations, contacts, membership and engagement. Where categories drift and duplicate fields for the same fact build up." },
    { id: "mail", label: "Mailing tool", x: 610, y: 70, text: "Newsletters. A sync with the CRM decides who receives what, so opt-outs must agree in both places." },
    { id: "platform", label: "Member platform", x: 610, y: 230, text: "An online community for members. No link to the CRM, so its activity is invisible to engagement reporting." },
    { id: "sheets", label: "Reporting spreadsheets", x: 360, y: 320, text: "Funder and impact figures. Many are retyped by hand from the other systems each month, which is where totals stop agreeing." },
  ],
  links: [["web", "forms", 1], ["forms", "crm", 1], ["crm", "mail", 1], ["crm", "sheets", 0], ["mail", "sheets", 0], ["platform", "sheets", 0]],
};
function systems() {
  const host = $("#sysMap"), W = 720, H = 370;
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Diagram of systems and how data moves between them");
  const byId = Object.fromEntries(SYS.nodes.map(n => [n.id, n]));
  svg.append("defs").append("marker").attr("id", "sysArr").attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
    .append("path").attr("d", "M0,0 L10,5 L0,10 z").attr("fill", "var(--ink-3)");
  const links = svg.append("g").selectAll("line").data(SYS.links).join("line")
    .attr("x1", d => byId[d[0]].x).attr("y1", d => byId[d[0]].y).attr("x2", d => byId[d[1]].x).attr("y2", d => byId[d[1]].y)
    .attr("stroke", "var(--ink-3)").attr("stroke-width", 1.6).attr("stroke-dasharray", d => d[2] ? "none" : "6 5");
  links.each(function (d) { // shorten both ends so lines start and stop at the box edges (boxes are 156 x 48)
    const a = byId[d[0]], b = byId[d[1]], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const edge = Math.min(ux ? 80 / Math.abs(ux) : Infinity, uy ? 26 / Math.abs(uy) : Infinity);
    d3.select(this).attr("x1", a.x + ux * edge).attr("y1", a.y + uy * edge).attr("x2", b.x - ux * (edge + 2)).attr("y2", b.y - uy * (edge + 2)).attr("marker-end", "url(#sysArr)");
  });
  const nodes = svg.append("g").selectAll("g").data(SYS.nodes).join("g").attr("transform", d => `translate(${d.x},${d.y})`).attr("tabindex", 0).attr("role", "button").attr("aria-label", d => d.label).style("cursor", "pointer");
  nodes.append("rect").attr("x", -78).attr("y", -24).attr("width", 156).attr("height", 48).attr("rx", 10)
    .attr("fill", d => d.id === "crm" ? "var(--accent-soft)" : "var(--surface-2)").attr("stroke", d => d.id === "crm" ? "var(--accent)" : "var(--line-2)");
  nodes.append("text").attr("text-anchor", "middle").attr("y", 5).attr("fill", "var(--ink)").attr("font-size", 14).attr("font-weight", 600).text(d => d.label);
  const pick = d => {
    nodes.select("rect").attr("stroke-width", n => n === d ? 2.5 : 1);
    links.attr("stroke", l => l[0] === d.id || l[1] === d.id ? "var(--accent)" : "var(--ink-3)");
    $("#sysRead").innerHTML = `<b>${d.label}.</b> ${d.text}`;
  };
  nodes.on("click", (e, d) => pick(d)).on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d); } });
}

// ── Grid: lineage ──
const LIN = [
  { id: "src_epc", col: 0, row: 0, label: "Energy certificates", state: "source", text: "About 28 million energy performance certificates, the reason this needs a warehouse." },
  { id: "src_settle", col: 0, row: 1, label: "Half-hourly settlement", state: "source", text: "Metered demand and generation every half hour, which forces window functions." },
  { id: "src_constraint", col: 0, row: 2, label: "Constraint costs", state: "source", text: "What the grid pays to switch generation off, by boundary and period." },
  { id: "src_geo", col: 0, row: 3, label: "Postcode lookups", state: "source", text: "Postcode to small area to grid supply point, the join that ties everything to a place." },
  { id: "stg_epc", col: 1, row: 0, label: "stg_epc", state: "built", text: "Cleans certificates: normalises postcodes and removes duplicate certificates. Built and tested on simulated data with planted defects." },
  { id: "stg_settle", col: 1, row: 1, label: "stg_settlement", state: "planned", text: "Planned: one row per settlement period, with gaps made explicit." },
  { id: "stg_constraint", col: 1, row: 2, label: "stg_constraints", state: "planned", text: "Planned: constraint payments mapped to grid areas." },
  { id: "stg_geo", col: 1, row: 3, label: "stg_geography", state: "planned", text: "Planned: one lookup table; a test fails if any area is missing." },
  { id: "mart", col: 2, row: 1.5, label: "mart_flexibility_vs_constraint", state: "built", text: "Where flexible demand exists against where constraint costs fall. Runs on simulated data; its row-loss test catches the planted orphans." },
];
function lineage() {
  const host = $("#lineage"), W = 720, H = 330, colX = [100, 340, 580], rowY = r => 45 + r * 78;
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Warehouse lineage from sources to staging models to the mart");
  ["Sources", "Staging", "Mart"].forEach((t, i) => svg.append("text").attr("class", "ann").attr("x", colX[i]).attr("y", 14).attr("text-anchor", "middle").text(t.toUpperCase()));
  const edges = [["src_epc", "stg_epc"], ["src_settle", "stg_settle"], ["src_constraint", "stg_constraint"], ["src_geo", "stg_geo"], ["stg_epc", "mart"], ["stg_settle", "mart"], ["stg_constraint", "mart"], ["stg_geo", "mart"]];
  const by = Object.fromEntries(LIN.map(n => [n.id, n]));
  const ep = svg.append("g").selectAll("path").data(edges).join("path").attr("fill", "none").attr("stroke", "var(--ink-3)").attr("stroke-width", 1.4)
    .attr("d", ([a, b]) => { const A = by[a], B = by[b], x1 = colX[A.col] + 90, y1 = rowY(A.row), x2 = colX[B.col] - 90, y2 = rowY(B.row), mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; })
    .attr("stroke-dasharray", ([a, b]) => by[a].state === "planned" || by[b].state === "planned" ? "4 4" : "none");
  const g = svg.append("g").selectAll("g").data(LIN).join("g").attr("transform", d => `translate(${colX[d.col]},${rowY(d.row)})`).attr("tabindex", 0).attr("role", "button").attr("aria-label", d => d.label).style("cursor", "pointer");
  g.append("rect").attr("x", -90).attr("y", -20).attr("width", 180).attr("height", 40).attr("rx", 8)
    .attr("fill", d => d.state === "built" ? "var(--accent-soft)" : "var(--surface-2)")
    .attr("stroke", d => d.state === "built" ? "var(--accent)" : "var(--line-2)").attr("stroke-dasharray", d => d.state === "planned" ? "4 3" : "none");
  g.append("text").attr("text-anchor", "middle").attr("y", 4).attr("fill", "var(--ink)").attr("font-size", d => d.col ? 12 : 13).attr("font-family", d => d.col ? "var(--font-mono)" : "var(--font-body)").text(d => d.label.length > 26 ? d.label.slice(0, 25) + "…" : d.label);
  const pick = d => {
    g.select("rect").attr("stroke-width", n => n === d ? 2.5 : 1);
    ep.attr("stroke", ([a, b]) => a === d.id || b === d.id ? "var(--accent)" : "var(--ink-3)");
    $("#lineageRead").innerHTML = `<b>${d.label}</b> <span class="muted">(${d.state})</span>. ${d.text}`;
  };
  g.on("click", (e, d) => pick(d)).on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d); } });
}

// ── Fuel: check against the RAC ──
function fuel() {
  const host = $("#fuelChart"), W = 640, H = 230, m = { l: 46, r: 20, t: 16, b: 30 };
  const pts = [
    { d: "1 March", mine: 132.94, rac: 132.83 }, { d: "31 March", mine: 153.66, rac: 152.83 }, { d: "1 October", mine: 174.68, rac: null },
  ];
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Dot plot comparing the pipeline's average unleaded price with the RAC's published figures");
  const x = d3.scalePoint().domain(pts.map(p => p.d)).range([m.l + 60, W - m.r - 60]);
  const y = d3.scaleLinear().domain([125, 180]).range([H - m.b, m.t]);
  svg.append("g").selectAll("line").data(y.ticks(5)).join("line").attr("class", "gridline").attr("x1", m.l).attr("x2", W - m.r).attr("y1", d => y(d)).attr("y2", d => y(d));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "p"));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSize(0)).select(".domain").remove();
  svg.append("path").attr("fill", "none").attr("stroke", "var(--series-a)").attr("stroke-width", 1.5).attr("stroke-dasharray", "3 3").attr("d", d3.line().x(p => x(p.d)).y(p => y(p.mine))(pts));
  pts.forEach(p => {
    const dot = (v, col, dx, lab) => svg.append("circle").attr("cx", x(p.d) + dx).attr("cy", y(v)).attr("r", 6).attr("fill", col).attr("stroke", "var(--bg)").attr("stroke-width", 2)
      .on("pointerenter pointermove", e => showTip(`<b>${p.d} 2026</b>${lab}: ${fmt(v, 2)}p`, e.clientX, e.clientY)).on("pointerleave", hideTip);
    dot(p.mine, "var(--series-a)", p.rac ? -7 : 0, "My pipeline");
    if (p.rac) dot(p.rac, "var(--series-b)", 7, "RAC published");
    svg.append("text").attr("class", "ann").attr("x", x(p.d) + 14).attr("y", y(p.mine) - 10).text(fmt(p.mine, 2) + "p");
  });
}

// ── Peripatos: grow a tree (same drawing code as the app) ──
const TOPICS = [["Poisson distribution", "#7ca23c"], ["Gamma distribution", "#7ca23c"], ["Monte Carlo simulation", "#4580d8"], ["Retrieval-augmented generation", "#c464ac"], ["Discounting and NPV", "#c0482a"], ["Hash tables", "#c464ac"], ["Bayes' theorem", "#7ca23c"], ["Prospect theory", "#c0482a"]];
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function plantSVG(id, colour, stage, thirst) {
  const r = rng(hashStr(id)), f = n => n.toFixed(1), DEG = Math.PI / 180;
  const leafFill = thirst ? `color-mix(in oklab, ${colour} ${thirst === 1 ? 70 : 42}%, #7d6b45)` : colour;
  const segs = [], leaves = [], blooms = [];
  const leaf = (x, y, ang, L, W) => leaves.push(`<path d="M0 0C${f(L * .3)} ${f(-W)} ${f(L * .7)} ${f(-W)} ${f(L)} 0C${f(L * .7)} ${f(W)} ${f(L * .3)} ${f(W)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})" opacity="${(.78 + r() * .22).toFixed(2)}"/>`);
  const ground = `<ellipse cx="50" cy="93" rx="${stage ? 21 : 13}" ry="3.4" fill="#2b2a1f"/>`;
  if (stage <= 0) return ground + `<path d="M0 -6.5C4.2 -4 4.2 4 0 6.5C-4.2 4 -4.2 -4 0 -6.5Z" transform="translate(50 86.5) rotate(${f(-35 + r() * 70)})" fill="#3d3727" stroke="${colour}" stroke-width="1.6"/>`;
  const droop = thirst * 10;
  if (stage === 1) {
    const lean = (r() - .5) * 10, tx = 50 + lean, ty = 66 + thirst * 4;
    segs.push(`<path d="M50 92Q${f(50 + lean * .1)} 80 ${f(tx)} ${f(ty)}" stroke-width="2.4"/>`);
    leaf(tx, ty, -152 - droop, 18, 7); leaf(tx, ty, -28 + droop, 18, 7);
  } else {
    const depthMax = stage - 1, L0 = [0, 0, 30, 26, 24, 23][stage], W0 = [0, 0, 3.4, 4.2, 4.9, 5.6][stage];
    const grow = (x, y, a, len, depth, w) => {
      const rad = a * DEG, x2 = x + Math.sin(rad) * len, y2 = y - Math.cos(rad) * len, bend = (r() - .5) * len * .3;
      const cx = (x + x2) / 2 + Math.cos(rad) * bend, cy = (y + y2) / 2 + Math.sin(rad) * bend;
      segs.push(`<path d="M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}" stroke-width="${f(Math.max(w, .7))}"/>`);
      if (depth === 0) {
        if (thirst === 2 && r() < .45) return;
        const n = 3 + (r() < .5 ? 1 : 0);
        for (let i = 0; i < n; i++) { const la = a + (i - (n - 1) / 2) * 34 + (r() - .5) * 14; leaf(x2, y2, la + (la >= 0 ? droop : -droop) - 90, 9.5 + r() * 4, 3.4 + r() * 1.1); }
        if (stage === 5 && r() < .75) blooms.push(`<circle cx="${f(x2 + (r() - .5) * 5)}" cy="${f(y2 - 1 - r() * 3)}" r="${f(2.2 + r() * 1.3)}"/>`);
        return;
      }
      if (depth <= 1 && r() < .45) leaf((x + x2) / 2, (y + y2) / 2, a + (r() < .5 ? -55 : 55) - 90, 8, 3);
      const spread = 15 + r() * 12 + thirst * 6, kids = depth >= 2 && r() < .3 ? [-1, 0, 1] : [-1, 1];
      for (const s of kids) grow(x2, y2, a + s * spread * (.75 + r() * .45) + (s === 0 ? (r() - .5) * 10 : 0) + s * thirst * 4, len * (.7 + r() * .12), depth - 1, w * .68);
    };
    grow(50, 92, (r() - .5) * 8, L0, depthMax, W0);
  }
  return ground + `<g fill="none" stroke-linecap="round" stroke="#b5a48b">${segs.join("")}</g><g style="fill:${leafFill}">${leaves.join("")}</g><g fill="#f2d27c">${blooms.join("")}</g>`;
}
function grower() {
  let ti = 0;
  const STAGE = ["a seed", "a sprout", "a sapling", "a young tree", "a tree", "in bloom"];
  const draw = () => {
    const s = +$("#growStage").value, late = +$("#growLate").value, th = late >= 7 ? 2 : late >= 1 ? 1 : 0;
    $("#growStageOut").textContent = s === 1 ? "once" : s + " times";
    $("#growLateOut").textContent = late ? late + " day" + (late === 1 ? "" : "s") + " late" : "on time";
    $("#growTree").innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="${TOPICS[ti][0]}, ${STAGE[s]}">${plantSVG(TOPICS[ti][0], TOPICS[ti][1], s, s ? th : 0)}</svg>`;
    $("#growName").textContent = TOPICS[ti][0] + ": " + STAGE[s] + (s && th ? (th === 2 ? ", wilting" : ", thirsty") : "");
  };
  $("#growStage").addEventListener("input", draw); $("#growLate").addEventListener("input", draw);
  $("#growSeed").addEventListener("click", () => { ti = (ti + 1) % TOPICS.length; draw(); });
  draw();
}

// ── Shenzhen ──
function shenzhen() {
  const range = $("#compareRange"), top = $("#compareTop"), handle = $("#compareHandle");
  const update = () => { const v = Number(range.value); top.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)"; handle.style.left = v + "%"; };
  range.addEventListener("input", update); update();
  const img = $("#lightsImg"), btns = $$(".lights__btn");
  btns.forEach(b => { new Image().src = "assets/images/lights-" + b.dataset.year + ".jpg"; });
  btns.forEach(b => b.addEventListener("click", () => {
    btns.forEach(x => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
    img.src = "assets/images/lights-" + b.dataset.year + ".jpg";
    img.alt = "Nighttime lights over the Shenzhen and Hong Kong region in " + b.dataset.year;
  }));
}

// ── Project index filters ──
$$(".filter").forEach(b => b.addEventListener("click", () => {
  $$(".filter").forEach(x => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-pressed", String(on)); });
  $$("#indexGrid .pcard").forEach(c => { c.hidden = b.dataset.filter !== "all" && c.dataset.cat !== b.dataset.filter; });
}));

const INIT = {
  "p-damage-maps": () => { if (hasD3) { damageMap(); ttest(); } },
  "p-shenzhen": shenzhen,
  "p-displacement": signals,
  "p-peatland": () => hasD3 && did(),
  "p-library-assistant": () => { rag(); if (hasD3) libChart(); },
  "p-spending-model": () => hasD3 && monteCarlo(),
  "p-data-map": () => hasD3 && systems(),
  "p-grid": () => hasD3 && lineage(),
  "p-fuel": () => hasD3 && fuel(),
  "p-peripatos": grower,
};

const year = $("#year");
if (year) year.textContent = new Date().getFullYear();
route();
