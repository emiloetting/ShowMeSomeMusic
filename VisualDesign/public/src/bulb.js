// public/src/energyBulbs.js
import { prepareAvgEnergy } from "./api.js";


// function to ensure intuitive read-out of speed fader
function getSpeedIntervalMs(speed) {
  const min = Number(speed.min);
  const max = Number(speed.max);
  const v = Number(speed.value);
  return min + (max - v);
}

const SVG_SCALE = 0.85;

export async function initEnergyBulbs(root) {
  root.innerHTML = `
    <div class="energy-controls">
      <button id="btnPlay">Play</button>
      <input id="yearSlider" type="range" min="0" max="0" value="0" step="1" />
      <label>Speed
        <input id="speed" type="range" min="50" max="1200" value="350" step="50" />
      </label>
    </div>

    <svg class="energy-svg" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid meet">
      <defs>
        <!-- Glow -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Glas-Gradient -->
        <radialGradient id="glassGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.55" />
          <stop offset="45%" stop-color="#ffd36a" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ffd36a" stop-opacity="0.12" />
        </radialGradient>

        <!-- Metal-Gradient -->
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#777" stop-opacity="1"/>
          <stop offset="40%" stop-color="#3f3f3f" stop-opacity="1"/>
          <stop offset="70%" stop-color="#666" stop-opacity="1"/>
          <stop offset="100%" stop-color="#2b2b2b" stop-opacity="1"/>
        </linearGradient>

        <linearGradient id="silverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="100%" stop-color="#6f6f6f" />
        </linearGradient>
      </defs>

      <!-- Scaling the elements wihtin the viz -->
      <g id="energyContent" transform="scale(${SVG_SCALE}) translate(80, 40)">
        <g id="bulbs"></g>
        <g id="labels"></g>
        <g id="yearDisplay"></g>
      </g>
    </svg>
  `;

  const data = await prepareAvgEnergy(); // [{year, buckets:[5]}]
  if (!data?.length) {
    root.querySelector(".energy-svg").outerHTML = "<p>Keine Energy-Daten gefunden.</p>";
    return;
  }

  const all = data.flatMap(d => d.buckets).filter(v => Number.isFinite(v));
  const min = Math.min(...all);
  const max = Math.max(...all);
  const norm = v => (max === min ? 0.5 : (v - min) / (max - min));

  // ui stuff to setup animation
  const btnPlay = root.querySelector("#btnPlay");
  const yearSlider = root.querySelector("#yearSlider");
  const speed = root.querySelector("#speed");

  yearSlider.max = String(data.length - 1);

  // bulb layout 
  const bucketsNames = ["1–10", "11–20"];
  const bulbsG = root.querySelector("#bulbs");
  const labelsG = root.querySelector("#labels");
  const yearG = root.querySelector("#yearDisplay");

  // center & spacing stuff
  const centerX = 450;
  const yearY = 400;    
  const gap = 80;       // between year nrs

  // group containing visible years
  const yearStrip = document.createElementNS("http://www.w3.org/2000/svg", "g");
  yearStrip.setAttribute("class", "year-strip");
  yearG.appendChild(yearStrip);

  // helper to text
  function createYearText(className) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", centerX);         
    t.setAttribute("y", yearY);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", className);
    return t;
  }

  let yearPrev = createYearText("year-side");
  let yearNow  = createYearText("year-current");
  let yearNext = createYearText("year-side");

  yearStrip.appendChild(yearPrev);
  yearStrip.appendChild(yearNow);
  yearStrip.appendChild(yearNext);

  // helper for styling of visible years (center big)
  function setRole(el, role) {
    el.classList.toggle("year-current", role === "current");
    el.classList.toggle("year-side", role === "side");
    el.style.opacity = role === "current" ? "1" : "0.35";
  }

  // helper for positions
  function setX(el, x) {
    el.style.transform = `translateX(${x}px)`;
  }

  // enable smooth animation
  [yearPrev, yearNow, yearNext].forEach(el => {
    el.style.transition = "transform 320ms ease, opacity 320ms ease";
  });

  // initial layout
  setX(yearPrev, -gap);
  setX(yearNow, 0);
  setX(yearNext, gap);
  setRole(yearPrev, "side");
  setRole(yearNow, "current");
  setRole(yearNext, "side");
  
  const cx = [300, 600];
  const cy = 125;

  // smooth glow
  const state = new Array(2).fill(0.15);   // current intensity
  let targets = new Array(2).fill(0.15);   // target intensity

  // bulb svg parts
  const bulbEls = [];
  for (let i = 0; i < 2; i++) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // glow
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glow.setAttribute("cx", cx[i]);
    glow.setAttribute("cy", cy);
    glow.setAttribute("r", "58");
    glow.setAttribute("filter", "url(#glow)");
    glow.setAttribute("class", "bulb-glow");

    // glas feel
    const glass = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glass.setAttribute("cx", cx[i]);
    glass.setAttribute("cy", cy);
    glass.setAttribute("r", "55");
    glass.setAttribute("fill", "url(#glassGrad)");
    glass.setAttribute("class", "bulb-glass");

    // inside electronics
    const leadL = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leadL.setAttribute("x1", cx[i] - 14);
    leadL.setAttribute("y1", cy + 20);
    leadL.setAttribute("x2", cx[i] - 14);
    leadL.setAttribute("y2", cy - 10);
    leadL.setAttribute("class", "bulb-lead");

    const leadR = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leadR.setAttribute("x1", cx[i] + 14);
    leadR.setAttribute("y1", cy + 20);
    leadR.setAttribute("x2", cx[i] + 14);
    leadR.setAttribute("y2", cy - 10);
    leadR.setAttribute("class", "bulb-lead");

    const filament = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // smooth wave of lighting wire
    filament.setAttribute(
      "d",
      `M ${cx[i] - 14} ${cy - 10}
       C ${cx[i] - 8} ${cy - 22}, ${cx[i] - 2} ${cy - 2}, ${cx[i] + 4} ${cy - 14}
       C ${cx[i] + 10} ${cy - 26}, ${cx[i] + 12} ${cy - 6}, ${cx[i] + 14} ${cy - 10}`
    );
    filament.setAttribute("class", "bulb-filament");

    // filaments glow
    const filamentGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    filamentGlow.setAttribute("cx", cx[i]);
    filamentGlow.setAttribute("cy", cy - 14);
    filamentGlow.setAttribute("r", "14");
    filamentGlow.setAttribute("filter", "url(#glow)");
    filamentGlow.setAttribute("class", "bulb-filament-glow");

    // bottom part below bulb
    const base = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    base.setAttribute("x", cx[i] - 28);
    base.setAttribute("y", cy + 46);
    base.setAttribute("width", "56");
    base.setAttribute("height", "34");
    base.setAttribute("rx", "8");
    base.setAttribute("fill", "url(#metalGrad)");
    base.setAttribute("class", "bulb-base");

    // most bottom part (screw part)
    const screw = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    screw.setAttribute("x", cx[i] - 26);
    screw.setAttribute("y", cy + 70);   
    screw.setAttribute("width", "52");
    screw.setAttribute("height", "42"); 
    screw.setAttribute("rx", "10");
    screw.setAttribute("fill", "url(#silverGrad)");
    screw.setAttribute("class", "bulb-screw");

    // lines to indicate screw-in part of bulb
    const screwRidges = [];
    const screwRidgeYs = [cy + 80, cy + 90, cy + 102];
    for (const y of screwRidgeYs) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "line");
      r.setAttribute("x1", cx[i] - 24);
      r.setAttribute("x2", cx[i] + 24);
      r.setAttribute("y1", y);
      r.setAttribute("y2", y);
      r.setAttribute("class", "bulb-screw-ridge");
      screwRidges.push(r);
    }

    // build bulb design

    g.appendChild(screw);
    for (const r of screwRidges) g.appendChild(r);
    g.appendChild(base);

    // bulb
    g.appendChild(glow);
    g.appendChild(glass);

    // insides
    g.appendChild(filamentGlow);
    g.appendChild(leadL);
    g.appendChild(leadR);
    g.appendChild(filament);

    bulbsG.appendChild(g);

    bulbEls.push({ glow, glass, filament, filamentGlow, leadL, leadR });
  }

  // Labels of chart pos
  for (let i = 0; i < 2; i++) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", cx[i]);
    t.setAttribute("y", "300");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "bulb-label");
    labelsG.appendChild(t);

    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    line1.setAttribute("x", cx[i]);
    line1.setAttribute("dy", "0");
    line1.textContent = "Positions:";

    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    line2.setAttribute("x", cx[i]);
    line2.setAttribute("dy", "1.2em");
    line2.textContent = bucketsNames[i];

    t.appendChild(line1);
    t.appendChild(line2);
  }

  // apply year
  let idx = 0;

  function applyYearInstant(newIdx) {
    idx = Math.max(0, Math.min(data.length - 1, newIdx));
    yearSlider.value = String(idx);

    yearPrev.textContent = data[idx - 1]?.year ?? "";
    yearNow.textContent  = data[idx].year;
    yearNext.textContent = data[idx + 1]?.year ?? "";
    targets = data[idx].buckets.map(v => norm(v));
  }

  applyYearInstant(0);

  // -animation loop
  let lastStep = performance.now();
  let playing = false;

  function render() {
    for (let i = 0; i < 2; i++) {
      state[i] += (targets[i] - state[i]) * 0.12;
      const a = Math.max(0, Math.min(1, state[i]));

      // glow/glas
      bulbEls[i].glow.style.opacity = String(0.10 + a * 0.90);
      bulbEls[i].glass.style.opacity = String(0.30 + a * 0.70);

      // light based on energy
      bulbEls[i].filament.style.opacity = String(0.25 + a * 0.75);
      bulbEls[i].filamentGlow.style.opacity = String(0.05 + a * 0.85);

      // detais
      const leadOpacity = 0.25 + a * 0.25;
      bulbEls[i].leadL.style.opacity = String(leadOpacity);
      bulbEls[i].leadR.style.opacity = String(leadOpacity);
      const r = 58 + a * 10;
      bulbEls[i].glow.setAttribute("r", String(r));
    }

    // autoplay step
    if (playing) {
      const now = performance.now();
      const interval = getSpeedIntervalMs(speed);

      if (now - lastStep >= interval) {
        lastStep = now;
        const nextIdx = (idx + 1) % data.length;
        applyYearInstant(nextIdx);
      }
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ctrls
  btnPlay.addEventListener("click", () => {
    playing = !playing;
    btnPlay.textContent = playing ? "Pause" : "Play";
    lastStep = performance.now();
  });

  yearSlider.addEventListener("input", (e) => {
    playing = false;
    btnPlay.textContent = "Play";
    applyYearInstant(Number(e.target.value));
  });
}