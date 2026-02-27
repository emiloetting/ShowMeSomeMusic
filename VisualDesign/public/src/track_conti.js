// public/src/track_conti.js
import { prepareSongContinuity } from "./api.js";

// Default data-window (show all)
let viewConfig = {
  yearMin: 1959,
  yearMax: 2024,
  posMin: 1,
  posMax: 100
};


// def. colors
const STATUS_COLORS = {
  initial: "#ffffff",        
  consecutive_up: "#00c853",  
  consecutive_down: "#ff1744", 
  consecutive_same: "#b0b0b0", 
  reentry: "#d8b4fe"           
};

function ensureTooltip() {
  let tip = document.querySelector(".tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tooltip";
    tip.style.opacity = "0";
    document.body.appendChild(tip);
  }
  return tip;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function createScales(innerW, innerH) {
  const yearSpan = viewConfig.yearMax - viewConfig.yearMin;
  const posSpan = viewConfig.posMax - viewConfig.posMin;

  const x = (year) => {
    const t = (year - viewConfig.yearMin) / (yearSpan || 1);
    return t * innerW;
  };

  const y = (pos) => {
    const t = (pos - viewConfig.posMin) / (posSpan || 1);
    return t * innerH;
  };

  return { x, y };
}

function render(rootEl, data, onPickTrack) {
  const filteredNodes = data.nodes.filter(n =>
    n.year >= viewConfig.yearMin &&
    n.year <= viewConfig.yearMax &&
    n.position >= viewConfig.posMin &&
    n.position <= viewConfig.posMax
    );

  const filteredLinks = data.links.filter(l =>
    l.fromYear >= viewConfig.yearMin &&
    l.fromYear <= viewConfig.yearMax &&
    l.toYear >= viewConfig.yearMin &&
    l.toYear <= viewConfig.yearMax &&
    l.fromPos >= viewConfig.posMin &&
    l.fromPos <= viewConfig.posMax &&
    l.toPos >= viewConfig.posMin &&
    l.toPos <= viewConfig.posMax
  );

  const nodes = filteredNodes;
  const links = filteredLinks;

  rootEl.innerHTML = "";

  const bounds = rootEl.getBoundingClientRect();
  const width = Math.max(700, Math.floor(bounds.width));
  const height = Math.max(560, Math.floor(bounds.height || 560));

  const margin = { top: 18, right: 18, bottom: 28, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { x, y } = createScales(innerW, innerH);

  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.classList.add("continuity-svg");

  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  const axis = document.createElementNS(svgNS, "g");
  axis.classList.add("axis-hints");

  const tL = document.createElementNS(svgNS, "text");
  tL.setAttribute("x", 0);
  tL.setAttribute("y", innerH + 20);
  tL.textContent = String(viewConfig.yearMin);
  axis.appendChild(tL);

  const tR = document.createElementNS(svgNS, "text");
  tR.setAttribute("x", innerW);
  tR.setAttribute("y", innerH + 20);
  tR.setAttribute("text-anchor", "end");
  tR.textContent = String(viewConfig.yearMax);
  axis.appendChild(tR);

  g.appendChild(axis);


  const linksG = document.createElementNS(svgNS, "g");
  linksG.classList.add("links");
  g.appendChild(linksG);

  for (const L of links) {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x(L.fromYear));
    line.setAttribute("y1", y(L.fromPos));
    line.setAttribute("x2", x(L.toYear));
    line.setAttribute("y2", y(L.toPos));
    line.classList.add("continuity-link");
    line.__track_id = L.track_id;
    linksG.appendChild(line);
  }

  // Layer: Nodes
  const nodesG = document.createElementNS(svgNS, "g");
  nodesG.classList.add("nodes");
  g.appendChild(nodesG);

  const tip = ensureTooltip();

  const yearsShown = (viewConfig.yearMax - viewConfig.yearMin + 1);
  const posShown = (viewConfig.posMax - viewConfig.posMin + 1);

  const r = clamp(
    Math.min(innerW / yearsShown, innerH / posShown) * 0.35,
    1.2,
    3.0
  );

  function dimByTrack(trackId, onCircle) {
    svg.classList.add("is-hovering");
    for (const c of nodesG.querySelectorAll("circle")) {
      c.classList.toggle("dim", c !== onCircle && c.__track_id !== trackId);
    }
    for (const l of linksG.querySelectorAll("line")) {
      l.classList.toggle("dim", l.__track_id !== trackId);
    }
  }

  function clearDim() {
    svg.classList.remove("is-hovering");
    for (const c of nodesG.querySelectorAll("circle")) c.classList.remove("dim");
    for (const l of linksG.querySelectorAll("line")) l.classList.remove("dim");
  }

  for (const n of nodes) {
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", x(n.year));
    c.setAttribute("cy", y(n.position));
    c.setAttribute("r", r);

    c.__track_id = n.track_id;

    const fill = STATUS_COLORS[n.status] ?? "#ffffff";
    c.setAttribute("fill", fill);
    c.classList.add("continuity-node");
    if (n.status === "initial") c.classList.add("is-initial");

    c.addEventListener("mouseenter", (ev) => {
      tip.innerHTML = `
        <div><strong>${n.trackname}</strong></div>
        <div>${n.artist}</div>
        <div>Year: ${n.year}</div>
        <div> Pos: ${n.position}</div>
        <div>Status: ${n.status}</div>
      `;
      tip.style.opacity = "1";
      tip.style.left = `${ev.clientX + 12}px`;
      tip.style.top = `${ev.clientY + 12}px`;
      dimByTrack(n.track_id, c);
    });

    c.addEventListener("mousemove", (ev) => {
      tip.style.left = `${ev.clientX + 12}px`;
      tip.style.top = `${ev.clientY + 12}px`;
    });

    c.addEventListener("mouseleave", () => {
      tip.style.opacity = "0";
      clearDim();
    });

    c.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (onPickTrack) onPickTrack(n.track_id);
    });

    nodesG.appendChild(c);
  }

  rootEl.appendChild(svg);
}

export async function initTrackContinuity(rootSelector = "#continuity-Viz") {
  const rootEl = document.querySelector(rootSelector);
  if (!rootEl) throw new Error(`initTrackContinuity: Root not found: ${rootSelector}`);

  rootEl.innerHTML = `
    <div class="conti-controls">
      <div class="conti-control">
        <div class="conti-label">
          Years: <span id="yearRangeLabel"></span>
        </div>
        <div id="yearSlider"></div>
      </div>

      <br>
      <br>
      <br>
      <br>
      <br>    
  
      <div class="conti-control">
        <div class="conti-label">
          Positions: <span id="posRangeLabel"></span>
        </div>
        <div id="posSlider"></div>
      </div>
    </div>

    <div id="contiStage"></div>
    <div id="contiDetails" class="conti-details"></div>

        <br>
    <br>
    <br>
    <br>
    <br>
  `;

  const stageEl = rootEl.querySelector("#contiStage");


  const data = await prepareSongContinuity();
  const detailsEl = rootEl.querySelector("#contiDetails");

  
  const byTrack = new Map();
  for (const n of data.nodes) {
    if (!byTrack.has(n.track_id)) byTrack.set(n.track_id, []);
    byTrack.get(n.track_id).push(n);
  }
  for (const arr of byTrack.values()) {
    arr.sort((a, b) => a.year - b.year);
  }

  function computeStats(entries) {
    const years = entries.map(e => e.year);
    const positions = entries.map(e => e.position);

    const yearsInCharts = entries.length;
    const avgPosition = positions.reduce((a,b) => a + b, 0) / Math.max(1, positions.length);
    const bestPosition = Math.min(...positions);

    let reentries = 0;
    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < years.length; i++) {
      if (years[i] === years[i - 1] + 1) {
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        reentries += 1;    
        currentStreak = 1;
      }
    }

    return {
      firstYear: years[0],
      lastYear: years[years.length - 1],
      yearsInCharts,
      reentries,
      runs: reentries + 1,
      longestStreak,
      avgPosition,
      bestPosition
    };
  }

  function renderDetails(track_id) {
    const entries = byTrack.get(track_id);
    if (!entries?.length) {
      detailsEl.innerHTML = "";
      return;
    }

    const any = entries[0];
    const s = computeStats(entries);

    detailsEl.innerHTML = `
      <div class="conti-details__title">
      <span class="conti-details__artist">${any.artist}</span>
      <span class="conti-details__track">- ${any.trackname}</span>
      </div>

      <div class="conti-details__grid">

        <div class="stat">
          <span class="stat-label">Years in charts</span>
          <span class="stat-leader"></span>
          <b>${s.yearsInCharts}</b>
        </div>

        <div class="stat">
          <span class="stat-label">Re-entries</span>
          <span class="stat-leader"></span>
          <b>${s.reentries}</b>
        </div>

        <div class="stat">
          <span class="stat-label">Runs</span>
          <span class="stat-leader"></span>
          <b>${s.runs}</b>
        </div>

        <div class="stat">
          <span class="stat-label">Longest streak</span>
          <span class="stat-leader"></span>
          <b>${s.longestStreak}</b>
        </div>

        <div class="stat">
          <span class="stat-label">First / last year</span>
          <span class="stat-leader"></span>
          <b>${s.firstYear} – ${s.lastYear}</b>
        </div>

        <div class="stat">
          <span class="stat-label">Avg position</span>
          <span class="stat-leader"></span>
          <b>${s.avgPosition.toFixed(1)}</b>
        </div>

        <div class="stat">
          <span class="stat-label">Best position</span>
          <span class="stat-leader"></span>
          <b>${s.bestPosition}</b>
        </div>

      </div>
          <br>
    <br>
    <br>
    <br>
    <br>
    `;
  }


  const yearLabel = rootEl.querySelector("#yearRangeLabel");
  const posLabel = rootEl.querySelector("#posRangeLabel");


  const yearSlider = rootEl.querySelector("#yearSlider");
  const posSlider = rootEl.querySelector("#posSlider");

  if (!window.noUiSlider) {
    throw new Error("noUiSlider not found. Did you include the CDN script tag before the module script?");
  }

 
  window.noUiSlider.create(yearSlider, {
    start: [viewConfig.yearMin, viewConfig.yearMax],
    connect: true,
    step: 1,
    range: { min: 1959, max: 2024 }
  });

  window.noUiSlider.create(posSlider, {
    start: [viewConfig.posMin, viewConfig.posMax],
    connect: true,
    step: 1,
    range: { min: 1, max: 100 }
  });

  const rerender = () => render(stageEl, data, renderDetails);

  yearSlider.noUiSlider.on("update", (values) => {
    const [min, max] = values.map(v => Math.round(Number(v)));
    viewConfig.yearMin = min;
    viewConfig.yearMax = max;
    yearLabel.textContent = `${min}–${max}`;
    rerender();
  });

  posSlider.noUiSlider.on("update", (values) => {
    const [min, max] = values.map(v => Math.round(Number(v)));
    viewConfig.posMin = min;
    viewConfig.posMax = max;
    posLabel.textContent = `${min}–${max}`;
    rerender();
  });

 
  yearLabel.textContent = `${viewConfig.yearMin}–${viewConfig.yearMax}`;
  posLabel.textContent = `${viewConfig.posMin}–${viewConfig.posMax}`;
  rerender();

  const ro = new ResizeObserver(() => rerender());
  ro.observe(stageEl);
}

