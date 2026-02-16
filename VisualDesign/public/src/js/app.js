// js/app.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { getLayout } from "./layout.js";
import { fetchAvgDbByYear } from "./api.js";
import { createWaveform, renderWave } from "./waveform.js";
import { renderLoudnessSwarm } from "./loudnessSwarm.js";

const layout = getLayout();
const avg = await fetchAvgDbByYear();

const tooltip = d3.select("#WaveFormTooltip");
const wf = createWaveform("#WaveformVisual", layout);

renderWave({
  g: wf.g,
  layout,
  data: avg,
  tooltipSel: tooltip,
  onYearClick: async (year) => {
    d3.select("#Loudness_Swarm").classed("hidden", false);
    await renderLoudnessSwarm("#Loudness_Swarm", layout, year);
  }
});

window.addEventListener("click", (e) => {
  const clickedBar = e.target?.classList?.contains("db-line");
  if (clickedBar) return;
  d3.select("#Loudness_Swarm").classed("hidden", true);
}, true);

window.addEventListener("resize", async () => {
  const newLayout = getLayout();
  location.reload();
});