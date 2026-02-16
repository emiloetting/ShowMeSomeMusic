// Import: matches  -> "version": "7.9.0",
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";


// Print success to console if success
async function initilization() {
    console.log("main.js geladen");
    let avg_dB_year = await fetch("/api/avg_db_by_year").then(response => response.json())
    console.log(avg_dB_year);
    console.log("D3 geladen:", typeof d3.select); // Check load status of d3

    return avg_dB_year
}

// 2 NKS bei floats immer
const Db_nks = d3.format(".2f")

// Grab data for D3 
let avg_db_data = await initilization();    // Await ensure we wait for data to arrive before continueing script! Must do so since initialization() is defined as an async func (although within we already use await)
console.log("Is Array:", Array.isArray(avg_db_data));
console.log("Length:", avg_db_data.length);
console.log("Element pattern and types:", avg_db_data[0]);


// Layout stuff
// ===== Layout Budget (80% viewport height) =====
const VIZ_HEIGHT = window.innerHeight * 0.80;

// optional: Abstand zwischen Waveform und Swarm (CSS margin-top etc.)
const VIZ_GAP = 12;

// Aufteilung: Waveform bekommt mehr Platz als Swarm
const WAVE_H = VIZ_HEIGHT * 0.65;
const SWARM_H = VIZ_HEIGHT - WAVE_H - VIZ_GAP;

// Breite bleibt wie gehabt
const WaveformWIDTH = window.innerWidth * 0.75;
const WaveformHEIGHT = WAVE_H;

// Swarm nutzt gleiche Breite, eigene Höhe aus dem Budget
const LoudnessSwarm_Width = WaveformWIDTH;
const LoudnessSwarm_Height = SWARM_H;

const wave_margin = { top: 20, right: 160, bottom: 0, left: 40 };
const swarm_margin = { top: 0, right: 160, bottom: 40, left: 40 };

const wave_innerWidth  = WaveformWIDTH  - wave_margin.left - wave_margin.right;
const wave_innerHeight = WaveformHEIGHT - wave_margin.top  - wave_margin.bottom;
const wave_baseline = wave_innerHeight / 2;




// MENTAL MODEL:
// SVG (0,0)
//  └── g (margin.left, margin.top)
//       └── "real" visualization itself

// Create the canvas on which to place everything
const WaveFormSVG = d3
    .select("#WaveformVisual")
    .append("svg")    
    .attr("width", WaveformWIDTH)
    .attr("height", WaveformHEIGHT)
    .attr("class", "waveform-svg");     // not the container, but whole of visual-svg

// Create Group of all contents within svg (invisible container)
const WaveformContent = WaveFormSVG
    .append("g")    // must be <g> due to SVG elements (only a small list with official names that must be used)
    .attr("transform", `translate(${wave_margin.left}, ${wave_margin.top})`);     // Move coordinate system according to margins (always start top left)

// Add the plot baseline to container on svg-"canvas"
WaveformContent
    .append("line")
    .attr("class", "waveform_baseline")
    .attr("x1", 0)
    .attr("x2", wave_innerWidth)
    .attr("y1", wave_baseline)
    .attr("y2", wave_baseline);


// Function to render swarm plot of mean db
async function renderLoudnessSwarm(year) {
    const res = await fetch(`/api/songs_db/${year}`);
    const data = await res.json();
    data.forEach(d => {
        d.position = +d.position;   // ensure chart position is correctly casted
        d.mean_db = +d.mean_db;
    });

    const root = d3.select("#Loudness_Swarm"); // clear existing instance to avoid rendering error
    root.selectAll("*").remove();

    // Setup svg
    const svg = root.append("svg")
        .attr("width", LoudnessSwarm_Width)
        .attr("height", LoudnessSwarm_Height);
    
    const g = svg.append("g")
        .attr("transform", `translate(${swarm_margin.left}, ${swarm_margin.top})`);

    const innerWidth = wave_innerWidth;

    const innerHeight = LoudnessSwarm_Height - swarm_margin.top - swarm_margin.bottom;

    const x_axis = d3.scaleLinear()
        .domain(d3.extent(data, d => d.mean_db))
        .nice()  
        .range([0, innerWidth]);

    // color scheme
    const maxPos = d3.max(data, d => d.position) ?? 100;
    const midPos = (maxPos + 1) / 2;
    const color = d3.scaleLinear()
        .domain([1, midPos, maxPos])                 // gut → mittel → schlecht
        .range(["#1a9850", "#fdae61", "#d73027"]);

    g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)   
        .call(d3.axisBottom(x_axis));



    // Settings for swarm-part
    const r = 6;                 // radius (must fit force collide)
    const padding = 1;           // space inbetween points
    const centerY = innerHeight * 0.35; // start with points on singular line (works fine if not 2 Song share same mean db val)
    const yMin = centerY - 60;      // Maximum "width" of swarm
    const yMax = centerY + 60;

    // init pos
    data.forEach(d => {
    d.x = x_axis(d.mean_db);
    d.y = centerY;
    });

    // Force sim.: fix x, centered y, no overlap
    const sim = d3.forceSimulation(data)
    .force("x", d3.forceX(d => x_axis(d.mean_db)).strength(1))
    .force("y", d3.forceY(centerY).strength(0.05))
    .force("collide", d3.forceCollide(r + padding))
    .stop();

    for (let i = 0; i < 220; i++) sim.tick();   // run sim to order points in best way possible

    // clamp y to max height
    data.forEach(d => {
    d.y = Math.max(yMin, Math.min(yMax, d.y));
    });

    // render points
    g.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
        .attr("r", r)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("fill", d => color(d.position))
    .append("title")
        .text(d => `Name: "${d.name}" | Position: ${d.position} | Ø Loudness: ${d.mean_db.toFixed(2)} dB`);

    const defs = svg.append("defs");

    // Build gradient legend 
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");

            // sampling colors
    const N = 30;
    for (let i = 0; i <= N; i++) {
    const t = i / N;
    const pos = 1 + t * (maxPos - 1); // 1..maxPos

    gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(pos));
    }
    
    const legendWidth = 100;
    const legendHeight = 10;

    // underneath Min, Max & Percentiles
    const legendX = wave_innerWidth + 5;  
    const legendY = centerY;              // center to swarm-center

    const legend = g.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", 0)
        .attr("y", -legendHeight / 2)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -legendHeight / 2 - 6)
        .text("Chart Position");

    legend.append("text")
        .attr("x", 0)
        .attr("y", legendHeight / 2 + 16)
        .attr("fill", "#1a9850")
        .attr("text-anchor", "start")
        .attr("font-size", 15)
        .text("1");

    legend.append("text")
        .attr("x", legendWidth)
        .attr("y", legendHeight / 2 + 16)
        .attr("fill", "#d73027")
        .attr("text-anchor", "end")
        .attr("font-size", 15)
        .text(maxPos);
}


// Function to allow for dynmiac data display
function renderWave(data) {
    // Make each year get position on x-Axis
    const x = d3.scaleBand()    // scaleBand for discrete series
        .domain(data.map(dp => dp.year))
        .range([wave_innerWidth*0.05, wave_innerWidth*0.95]);   // use 80& of baseline for vertical lines
    
    //  Describe how vertical bars look
    const db_vals = data.map(dp => dp.mean_db)
    const domain = [Math.min(...db_vals), Math.max(...db_vals)]     // Math.min() expects values, ...unpacks
    const amplitude = d3.scaleLinear()      // make db-line sizes linearly scaled
        .domain(domain)
        .range([10, wave_innerHeight * 0.75]);  // Min of 10, max 45% of available height 

    // Create min, max, 25 & 75 percentile lines (dotted)
    const minDb = d3.min(db_vals);      // Grab min & max
    const maxDb = d3.max(db_vals);
    const sorted = [...db_vals].sort(d3.ascending);  // sort list to get percentiles
    const perc_25 = d3.quantile(sorted, 0.25);    
    const perc_75 = d3.quantile(sorted, 0.75);
    const dotted_refs = {
        "Min": minDb,
        "Max": maxDb,
        "25 percentile": perc_25,
        "75 percentile": perc_75,
    }

    for (const [key, val] of Object.entries(dotted_refs)) {
        // Draw each ref-line symmetrically mirrored to baseline
        const fixed_val = amplitude(val) / 2;

        // Top
        WaveformContent.append("line")
            .attr("class", "WaveFormRefLine")
            .attr("x1", 0)
            .attr("x2", wave_innerWidth)
            .attr("y1", wave_baseline - fixed_val)
            .attr("y2", wave_baseline - fixed_val);

        WaveformContent.append("text")
            .attr("class", "wave-label")
            .attr("x", wave_innerWidth + 5) // slight shift
            .attr("y", wave_baseline - fixed_val)
            .attr("dominant-baseline", "middle")
            .text(key);

        // bottom
        WaveformContent.append("line")
            .attr("class", "WaveFormRefLine")
            .attr("x1", 0)
            .attr("x2", wave_innerWidth)
            .attr("y1", wave_baseline + fixed_val)
            .attr("y2", wave_baseline + fixed_val);
            }


    // Create line for each data point
    WaveformContent
        .selectAll("line.db-line")      // Select all line elements that will represent data (may be empty)
        .data(data, dp => dp.year)      // Insert data, set *key* to year -> does not select year-data, but uses it as key
        .join("line") // Create line for each dp
        
        // dp is placeholder for D3, fills automatically with datapoint in bound data via .data
        .attr("class", "db-line")       // Set class of all elements grabbed by selectAll to this class
        .attr("stroke-width", wave_innerWidth*0.01)
        .attr("x1", dp => x(dp.year) + x.bandwidth() / 2)     // for x-position of a line: calc starting pos of line using early defined constant x, shift half of reseverd width to right to center the line within reserved width 
        .attr("x2", dp => x(dp.year) + x.bandwidth() / 2)     // line has similar x1, x2 vals if vertical
        .attr("y1", dp => wave_baseline + (amplitude(dp.mean_db) / 2))  // make line center at Baseline defined earlier
        .attr("y2", dp => wave_baseline - (amplitude(dp.mean_db) / 2))    // start height calc from baseline, subtract return values of amplitude function from above since it draws into height

        // Tooltip geschichten: Fenster auf wenn drübergehovert
        .on("mouseover", (event, dp) => {
            WaveFormTooltip
            .style("opacity", 1)
            .html(`<strong>Year:</strong> ${dp.year}<br><strong>Ø Loudness:</strong> ${Db_nks(dp.mean_db)} dB`);
        })

        .on("mousemove", (event) => {
            WaveFormTooltip
            .style("left", `${event.pageX}px`)
            .style("top", `${event.pageY}px`);
        })

        .on("mouseout", () => {
            WaveFormTooltip.style("opacity", 0);
        })

        .on("click", async (event, dp) => {
            event.stopPropagation();
            d3.select("#Loudness_Swarm").classed("hidden", false);  // make visible
            await renderLoudnessSwarm(dp.year); ;
        });
}

const WaveFormTooltip = d3.select("#WaveFormTooltip");
renderWave(avg_db_data)

// Make loudness swarm invisible 
window.addEventListener("click", (e) => {
  const clickedBar = e.target && e.target.classList && e.target.classList.contains("db-line");
  if (clickedBar) return;
  d3.select("#Loudness_Swarm").classed("hidden", true);
}, true);