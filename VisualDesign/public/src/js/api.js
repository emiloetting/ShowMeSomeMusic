export async function fetchAvgDbByYear() {
  return fetch("/api/avg_db_by_year").then(r => r.json());
}

export async function fetchSongsDbByYear(year) {
  return fetch(`/api/songs_db/${year}`).then(r => r.json());
}

export async function fetchLoudestAndQuietest() {
  return fetch("/api/minmax_db").then(r => r.json());
}