// Import: matches  -> "version": "7.9.0",
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";


// Print success to console if success
async function initilization() {
    console.log("main.js geladen");
    let avg_dB_year = await fetch("/api/dB_by_year").then(response => response.json())
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

// Set margins to make content of SVG not stick to svg border
const margin = {
    top: 20,
    right: 120,
    bottom: 30,
    left: 40
};

// Define relative WaveformPlot dims based on screen
const WaveformWIDTH = window.innerWidth * 0.7;
const WaveformHEIGHT = window.innerHeight * 0.5;

// Set inner object sizes with respect to above defined margins for content
const wave_innerWidth = WaveformWIDTH - margin.left - margin.right;
const wave_innerHeight = WaveformHEIGHT - margin.top - margin.bottom;
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
    .attr("transform", `translate(${margin.left}, ${margin.top})`);     // Move coordinate system according to margins (always start top left)

// Add the plot baseline to container on svg-"canvas"
WaveformContent
    .append("line")
    .attr("class", "waveform_baseline")
    .attr("x1", 0)
    .attr("x2", wave_innerWidth)
    .attr("y1", wave_baseline)
    .attr("y2", wave_baseline);


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
        .range([10, wave_innerHeight * 0.45]);  // Min of 10, max 45% of available height 

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
            .attr("class", "WaveFormRefLine-Label")
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
        // Sichtbar machen & Daten anzeigen
        .on("mouseover", (event, dp) => {
            WaveFormTooltip
            .style("opacity", 1)
            .html(`<strong>Year:</strong> ${dp.year}<br><strong>Ø Loudness:</strong> ${Db_nks(dp.mean_db)} dB`);
        })
        // Tooltip mit Maus bewegen
        .on("mousemove", (event) => {
            WaveFormTooltip
            .style("left", `${event.pageX}px`)
            .style("top", `${event.pageY}px`);
        })

        // Schließen wenn Maus wech von Balken
        .on("mouseout", () => {
            WaveFormTooltip.style("opacity", 0);
        })

        .on("click", async (event, dp) => {
            event.stopPropagation();
            await renderBpmStrip(dp.year);
            d3.select("#BpmStrip").classed("hidden", false);
        });
}

const WaveFormTooltip = d3.select("#WaveFormTooltip");
renderWave(avg_db_data)