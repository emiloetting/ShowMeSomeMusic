import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

export function createWaveform(rootSelector, layout) {
  const { wave } = layout;

  const svg = d3.select(rootSelector)
    .append("svg")
    .attr("width", wave.width)
    .attr("height", wave.height)
    .attr("class", "waveform-svg");

  const g = svg.append("g")
    .attr("transform", `translate(${wave.margin.left}, ${wave.margin.top})`);

  g.append("line")
    .attr("class", "waveform_baseline")
    .attr("x1", 0)
    .attr("x2", wave.innerWidth)
    .attr("y1", wave.baseline)
    .attr("y2", wave.baseline);

  return { svg, g };
}

export function renderWave({ g, layout, data, tooltipSel, onYearClick }) {
  const { wave } = layout;
  const Db_nks = d3.format(".2f");

  const x = d3.scaleBand()
    .domain(data.map(dp => dp.year))
    .range([wave.innerWidth * 0.05, wave.innerWidth * 0.95]);

  const cleanData = data
    .map(dp => ({ ...dp, mean_db: Number(dp.mean_db) }))
    .filter(dp => Number.isFinite(dp.mean_db));

  const db_vals = cleanData.map(dp => dp.mean_db);
  const domain = [Math.min(...db_vals), Math.max(...db_vals)];
  const amplitude = d3.scaleLinear()
    .domain(domain)
    .range([10, wave.innerHeight * 0.85]);

  // Reference lines (Min / Q1 / Median / Q3 / Max)
  const sorted = [...db_vals].sort((a, b) => a - b);
  const q = (p) => d3.quantileSorted(sorted, p);

  const refLines = [
    { key: "Max", v: d3.max(sorted) },
    { key: "75 percentile", v: q(0.75) },
    { key: "Median", v: q(0.5) },
    { key: "25 percentile", v: q(0.25) },
    { key: "Min", v: d3.min(sorted) },
  ];

  // ref lines
  const refs = g.selectAll("g.wave-refs")
    .data([null])
    .join("g")
    .attr("class", "wave-refs");

  refs.selectAll("*").remove();

  refLines.forEach(({ key, v }) => {
    const yTop = wave.baseline - amplitude(v) / 2;
    const yBot = wave.baseline + amplitude(v) / 2;

    refs.append("line")
      .attr("class", "WaveFormRefLine")
      .attr("x1", 0)
      .attr("x2", wave.innerWidth)
      .attr("y1", yTop)
      .attr("y2", yTop);

    refs.append("line")
      .attr("class", "WaveFormRefLine")
      .attr("x1", 0)
      .attr("x2", wave.innerWidth)
      .attr("y1", yBot)
      .attr("y2", yBot);

    //  label right of margin-line
    refs.append("text")
      .attr("class", "wave-label")
      .attr("x", wave.innerWidth + 5)
      .attr("y", yTop - 6)
      .text(key);
  });

  g.selectAll("line.db-line")
    .data(cleanData, dp => dp.year)
    .join("line")
      .attr("class", "db-line")
      .attr("stroke-width", wave.innerWidth * 0.01)
      .attr("x1", dp => x(dp.year) + x.bandwidth() / 2)
      .attr("x2", dp => x(dp.year) + x.bandwidth() / 2)
      .attr("y1", dp => wave.baseline + amplitude(dp.mean_db)/2)
      .attr("y2", dp => wave.baseline - amplitude(dp.mean_db)/2)
      .on("mouseover", (event, dp) => {
        tooltipSel
          .style("opacity", 1)
          .html(`<strong>Year:</strong> ${dp.year}<br><strong>Ø Loudness:</strong> ${Db_nks(dp.mean_db)} dB`);
      })
      .on("mousemove", (event) => {
        tooltipSel
          .style("left", `${event.pageX}px`)
          .style("top", `${event.pageY}px`);
      })
      .on("mouseout", () => tooltipSel.style("opacity", 0))
      .on("click", (event, dp) => {
        event.stopPropagation();
        onYearClick(dp.year);
      });
}