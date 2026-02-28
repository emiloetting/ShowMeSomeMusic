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
const dbPath = Path.join(__dirname, '..', 'DataStorage', 'DataCore.db') 
console.log(dbPath);

// Instantiate DB-connection
const DB = new Database(dbPath);




// FUNCTION 1: GET AVG LOUDNESS OF YEAR
function AvgLoudnessPerYear(db) {
  return db.prepare(`
    SELECT
      year,
      AVG(NULLIF(loudness, 0)) AS mean_db
    FROM main
    WHERE loudness IS NOT NULL
      AND loudness <> 0
    GROUP BY year
  `).all();
}

// FUNCTION 2: Get track name, dB and position for a specific year
function SongsDbByYear(db, year) {
  return db.prepare(`
    SELECT
      track_name AS name,
      artists,
      position,
      loudness AS mean_db
    FROM main
    WHERE year = ?
      AND loudness IS NOT NULL
      AND loudness <> 0
  `).all(year);
}


// FUNCTION 3: Get Min and Max DB of all songs in DB
function MinMaxDb(db) {
  return db.prepare(`
    SELECT
      MIN(loudness) AS min_db,
      MAX(loudness) AS max_db
    FROM main
    WHERE loudness IS NOT NULL
      AND loudness <> 0
  `).get();
}

// FUNCTION 4: Get all danceability
function fullDanceability(db) {
  return db.prepare("SELECT track_name, artists, year, position, danceability FROM main").all()
}

// FUNCITON 5: Data for tracking pos
function ContinuityRows(db) {
  return db.prepare(`
    SELECT
      track_id,
      track_name,
      artists,
      year,
      position
    FROM main
    WHERE year BETWEEN 1959 AND 2024
      AND position BETWEEN 1 AND 100
      AND track_id IS NOT NULL
      AND TRIM(track_id) <> ''
    ORDER BY year ASC, position ASC;
  `).all();
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

// Danceability
app.get("/api/full_danceability", (req, res) => {
  res.json(fullDanceability(DB))
  console.log("[API] /api/full_danceability called!")
})

// Energy
app.get("/api/energy_top20", (req, res) => {
  try {
    const rows = DB.prepare(`
      SELECT
        year,
        AVG(CASE WHEN position BETWEEN 1 AND 10 THEN energy END)  AS top10,
        AVG(CASE WHEN position BETWEEN 11 AND 20 THEN energy END) AS next10
      FROM main
      WHERE year BETWEEN 1959 AND 2024
      GROUP BY year
      ORDER BY year;
    `).all();

    res.json(rows);
  } catch (err) {
    console.error("[API] /api/energy_top20 failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/track_continuity", (req, res) => {
  try {
    res.json(ContinuityRows(DB));
    console.log("[API] /api/track_continuity called!");
  } catch (err) {
    console.error("[API] /api/track_continuity failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
    console.log(`Running on http:localhost:${PORT}`)
})

