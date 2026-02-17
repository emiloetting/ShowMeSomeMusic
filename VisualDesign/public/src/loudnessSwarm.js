import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchSongsDbByYear, fetchLoudestAndQuietest } from "./api.js";



export async function renderLoudnessSwarm(rootSelector, layout, year) {
  const { swarm, wave } = layout;

  const data = await fetchSongsDbByYear(year);
  data.forEach(d => { d.position = +d.position; d.mean_db = +d.mean_db; });

  const root = d3.select(rootSelector);
  root.selectAll("*").remove();

  const svg = root.append("svg")
    .attr("width", swarm.width)
    .attr("height", swarm.height);

  const g = svg.append("g")
    .attr("transform", `translate(${swarm.margin.left}, ${swarm.margin.top})`);

  const innerWidth = wave.innerWidth;
  const axisZoneH = 60;         
  const plotH = swarm.innerHeight - axisZoneH;

  // Display Year 
  g.append("text")
    .attr("x", 0)
    .attr("y", 40)              // slightly shifted
    .attr("fill", "white")
    .attr("font-size", 22)
    .attr("font-weight", 500)
    .text(year)
    // center 
    .attr("x", innerWidth / 2)
    .attr("text-anchor", "center");

  const { min_db, max_db } = await fetchLoudestAndQuietest();

  // Create x-axis
  const x_axis = d3.scaleLinear()
    .domain([min_db - 1, max_db + 1])
    .nice()
    .range([0, innerWidth]);


  // axis labels
  const xAxisG = g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${plotH})`)
    .call(
      d3.axisBottom(x_axis)
        .tickValues([-20, -16, -12, -8, -4])
        .tickFormat(d => `${d3.format(".0f")(d)} dB`)
    );

  xAxisG.selectAll(".tick text")
  .attr("dy", "1.8em");

  xAxisG.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", axisZoneH - 10)
    .attr("text-anchor", "middle")
    .text("Ø Loudness (dB)");

  // map data
  const maxPos = d3.max(data, d => d.position) ?? 100;
  const midPos = (maxPos + 1) / 2;
  const color = d3.scaleLinear()
    .domain([1, midPos, maxPos])
    .range(["#1a9850", "#fdae61", "#d73027"]);

  // dp settings
  const r = 5, padding = 1;
  const swarmRadius = r + padding;
  const swarmHeight = swarmRadius * Math.sqrt(data.length);

  const centerY = plotH - swarmHeight / 2;

  const yMin = centerY - swarmHeight / 2;
  const yMax = centerY + swarmHeight / 2;

  // Legend (gradient on swarm center line)
  const legendWidth = 105;
  const legendHeight = 10;
  const gradId = `legend-gradient-${year}`;

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", gradId);

  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const pos = 1 + t * (maxPos - 1);
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(pos));
  }

  const legendStartX = innerWidth + 5;                       // start of right col
  const legendMaxX = innerWidth + swarm.margin.right;        // end of inner svg

  // legend as right as possible
  const legendXFit = legendMaxX - legendWidth;

  const legend = g.append("g")
    .attr("transform", `translate(${legendXFit}, ${centerY})`);

  legend.append("rect")
    .attr("x", 0)
    .attr("y", -legendHeight / 2)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", `url(#${gradId})`);

  legend.append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", -legendHeight / 2 - 10)
    .attr("text-anchor", "center")
    .text("Chart Position");

  legend.append("text")
    .attr("class", "legend-desc")
    .attr("x", 0)
    .attr("y", legendHeight / 2 + 16)
    .attr("text-anchor", "start")
    .text("1");

  legend.append("text")
    .attr("class", "legend-desc")
    .attr("x", legendWidth)
    .attr("y", legendHeight / 2 + 16)
    .attr("text-anchor", "end")
    .text(maxPos);

  // Baseline
  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", centerY)
    .attr("y2", centerY)
    .attr("stroke", "white")
    .attr("opacity", 0.25)
    .attr("stroke-dasharray", "6 6");

  // calc pos for each dp
  data.forEach(d => { d.x = x_axis(d.mean_db); d.y = centerY; });

  // create force simulation to find vertical point positions in plot
  const sim = d3.forceSimulation(data)
    .force("x", d3.forceX(d => x_axis(d.mean_db)).strength(1))
    .force("y", d3.forceY(centerY).strength(0.05))
    .force("collide", d3.forceCollide(r + padding))
    .stop();

  // run sim
  for (let i = 0; i < 220; i++) sim.tick();
  data.forEach(d => { d.y = Math.max(yMin, Math.min(yMax, d.y)); });

  // render data points
  g.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
      .attr("r", r)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("fill", d => color(d.position))
    // on hover - field
    .append("title")
      .text(d => `Name: "${d.name}" | Position: ${d.position} | Ø Loudness: ${d.mean_db.toFixed(2)} dB`);

}