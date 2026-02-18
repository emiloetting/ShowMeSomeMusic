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
export async function prepareDiscoData() {

  const response = await fetch("/api/full_danceability");
  const raw_data = await response.json();

  const yearStart = 1959;
  const yearEnd = 2024;
  const latCount = 100;
  const lonCount = yearEnd - yearStart + 1;

  const values = new Array(lonCount * latCount).fill(0);
  const missing = new Array(lonCount * latCount).fill(1); // to indicate null - vals

  // Iterate over all return vals from db
  for (const row of raw_data) {

    const { year, position, danceability } = row; // unpack

    // Validate response (sanity)
    if (
      year < yearStart || 
      year > yearEnd || 
      !Number.isInteger(position) || 
      position < 1 || 
      position > latCount
    ) continue;

    // Set iteration vals
    const yearIndex = year - yearStart;
    const latIndex = position - 1;
    const idx = yearIndex * latCount + latIndex;

    // Keep val as missing if missing oder not finite
    const v = Number(danceability);
    if (danceability == null || !Number.isFinite(v)) {
      missing[idx] = 1;
      values[idx] = 0;
    } else {
      missing[idx] = 0;
      values[idx] = Math.max(0, Math.min(1, danceability)); // Calamp to [0,1] -> again sanity only
    }
  }

  // return good format for later viz
  return {
    years: Array.from({ length: lonCount }, (_, i) => yearStart + i),
    lonCount,
    latCount,
    values,
    missing
  };
}