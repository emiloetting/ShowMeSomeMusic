// Waveform-Viz
export async function fetchAvgDbByYear() {
  return fetch("/api/avg_db_by_year").then(r => r.json());
}

// DB-Swarm
export async function fetchSongsDbByYear(year) {
  return fetch(`/api/songs_db/${year}`).then(r => r.json());
}

// DB-Swarm Axis
export async function fetchLoudestAndQuietest() {
  return fetch("/api/minmax_db").then(r => r.json());
}

// Disco-Ball
// api.js
export async function prepareDiscoData() {
  const response = await fetch("/api/full_danceability");
  const raw_data = await response.json();

  const yearStart = 1959;
  const yearEnd = 2024;
  const latCount = 100;
  const lonCount = yearEnd - yearStart + 1;

  const values = new Array(lonCount * latCount).fill(0);
  const missing = new Array(lonCount * latCount).fill(255);

  const meta = new Array(lonCount * latCount).fill(null);

  for (const row of raw_data) {
    const { trackname, artist, year, position, danceability } = row;

    if (
      year < yearStart ||
      year > yearEnd ||
      !Number.isInteger(position) ||
      position < 1 ||
      position > latCount
    ) continue;

    const yearIndex = year - yearStart;
    const latIndex = (latCount - position); // top position on top
    const idx = yearIndex + latIndex * lonCount;
    meta[idx] = { trackname, artist };
    const hasDanceability =
      danceability !== null &&
      danceability !== undefined &&
      !(typeof danceability === "string" && danceability.trim() === "");

    const v = hasDanceability ? Number(danceability) : NaN;

    if (Number.isFinite(v)) {
      // valid val
      missing[idx] = 0;
      values[idx] = Math.max(0, Math.min(1, v));
    } else {
      // missing
      missing[idx] = 255;
      values[idx] = 0;
    }
  }
  return {
    years: Array.from({ length: lonCount }, (_, i) => yearStart + i),
    lonCount,
    latCount,
    values,
    missing,
    meta
  };
}


// Light-bulbs
export async function prepareAvgEnergy() {
  const r = await fetch("/api/energy_top20");
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`energy_top20 failed (${r.status}): ${t.slice(0, 200)}`);
  }
  const rows = await r.json();

  return rows.map(d => ({
    year: d.year,
    buckets: [d.top10, d.next10]
  }));
}


export async function prepareSongContinuity() {
  const r = await fetch("/api/track_continuity");
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`continuity_rows failed (${r.status}): ${t.slice(0, 200)}`);
  }
  const rows = await r.json();

  const yearStart = 1959;
  const yearEnd = 2024;
  const latCount = 100;

  // track_id -> Map(year -> entry)
  // (ensure song appears only once in charts, take top pos otherwise)
  const byTrack = new Map();

  for (const row of rows) {
    const track_id = String(row.track_id ?? "").trim();
    const year = Number(row.year);
    const position = Number(row.position);

    if (!track_id) continue;
    if (!Number.isInteger(year) || year < yearStart || year > yearEnd) continue;
    if (!Number.isInteger(position) || position < 1 || position > latCount) continue;

    if (!byTrack.has(track_id)) byTrack.set(track_id, new Map());
    const byYear = byTrack.get(track_id);

    const cur = byYear.get(year);
    // keep higher pos (smaller val)
    if (!cur || position < cur.position) {
      byYear.set(year, {
        track_id,
        year,
        position,
        trackname: row.trackname ?? "",
        artist: row.artist ?? ""
      });
    }
  }

  const nodes = [];
  const links = [];

  for (const [track_id, byYear] of byTrack.entries()) {
    const years = Array.from(byYear.keys()).sort((a, b) => a - b);

    for (let i = 0; i < years.length; i++) {
      const y = years[i];
      const cur = byYear.get(y);
      const prevYear = y - 1;
      const prev = byYear.get(prevYear);

      let status = "initial"; // initial entry to colorize later
      let prevPosition = null;

      if (!prev) {
        // if truly initial, otherwise reentry
        status = (i === 0) ? "initial" : "reentry"; // reentry: helllila
      } else {
        // consecutive
        prevPosition = prev.position;

        if (cur.position < prev.position) status = "consecutive_up";       // later green
        else if (cur.position > prev.position) status = "consecutive_down"; // later red
        else status = "consecutive_same"; // if pos is stayssame in between 2 years

        links.push({
          track_id,
          fromYear: prev.year,
          fromPos: prev.position,
          toYear: cur.year,
          toPos: cur.position
        });
      }

      nodes.push({
        track_id,
        year: cur.year,
        position: cur.position,
        trackname: cur.trackname,
        artist: cur.artist,
        status,
        ...(prevPosition != null ? { prevPosition } : {})
      });
    }
  }

  return { yearStart, yearEnd, latCount, nodes, links };
}