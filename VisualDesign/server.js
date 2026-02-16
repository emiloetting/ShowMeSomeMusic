console.log("Server started!"); // Log activation

// Import libs
const Database = require('better-sqlite3');
const Path = require('path');
const Express = require('express');  

//  Create app and set port
const app = Express();  
const PORT = 3000;
app.use(Express.static("public"));  // Pass dir "public" to browser
app.use(Express.static("public/src"));  // Pass dir "public" to browser
// Set Path for DB
const dbPath = Path.join(__dirname, '..', 'DataStorage', 'avg_loudness_demo.db') 
console.log(dbPath);

// Instantiate DB-connection
const DB = new Database(dbPath);




// FUNCTION 1: GET AVG LOUDNESS OF YEAR
function AvgLoudnessPerYear(db) {
    return db.prepare("SELECT year, AVG(avg_loudness) as mean_db FROM avg_loudness GROUP BY year").all()
}

// FUNCTION 2: Get track name, dB and position for a specific year
function SongsDbByYear(db, year) {
  return db.prepare("SELECT trackname as name, position, avg_loudness as mean_db FROM avg_loudness WHERE year = ?").all(year);
}


// FUNCTION 3: Get Min and Max DB of all songs in DB
function MinMaxDb(db) {
  return db.prepare("SELECT MIN(avg_loudness) as min_db, MAX(avg_loudness) as max_db FROM avg_loudness").get()
}

// DEFINE API

// avg loudness of a year
app.get("/api/avg_db_by_year", (request, response) => {
    response.json(AvgLoudnessPerYear(DB))
    console.log("[API] /api/avg_db_by_year called!")
});

// position, name and bpm of songs in specific year
app.get("/api/songs_db/:year", (req, res) => {
  const year = Number(req.params.year);

  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: "invalid year" });
  }

  if (year < 1959 || year > 2024) {
    return res.status(400).json({ error: `unregistered year ${year}` });
  }

  console.log(`[API] /api/songs_db/${year} called!`);
  res.json(SongsDbByYear(DB, year));
});

// loudest and quietest db nr.
app.get("/api/minmax_db", (req, res) => {
  res.json(MinMaxDb(DB))
  console.log("[API] /api/minmax_db called!")
})

app.listen(PORT, () => {
    console.log(`Running on http:localhost:${PORT}`)
})