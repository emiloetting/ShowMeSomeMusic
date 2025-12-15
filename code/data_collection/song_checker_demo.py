from spotify_recco_fetcher import SpotifyScraper, ReccoScraper
from log_setup import setup_logger




# Mappings according zto: https://reccobeats.com/docs/apis/get-audio-features
key_mapping = {
    -1 : "not detected",
    0 : "C",
    1 : "C#/Db",
    2 : "D",
    3 : "D#/Eb",
    4: "E",
    5: "F",
    6: "F#/Gb",
    7: "G",
    8: "G#/Ab",
    9: "A",
    10: "A#/Bb",
    11: "B"
}

mode_mapping = {
    0: "minor",
    1: "Major"
}


# Init logger, DB Handle, SpotifyAPI Handle
logger = setup_logger()


spotify_scraper = SpotifyScraper(logger=logger)
recco_scraper = ReccoScraper(logger=logger)


# Search for name, artist
# res = spotify_scraper.search("The Battle of New Orleans", "Johnny Horton")
res = spotify_scraper.search("Panama", "Van Halen")
if res is None:     # later important during for-loop
    pass

# Extract info
logger.info("Spotify Results:")
artist_info = res["artists"]
artist_ids  = [artist_info[i]["id"] for i in range(len(artist_info))]
artist_names = [artist_info[i]["name"] for i in range(len(artist_info))]
logger.info(f'  Artist(s): {artist_names}')
logger.info(f'  Artist-ID(s): {artist_ids}')

song_id   = res["id"]
song_name = res["name"]
duration = res["duration_ms"]
logger.info(f'  Track name: {song_name}')
logger.info(f'  Track-ID: {song_id}')
logger.info(f"  duration (ms): {duration}")
logger.info("")
logger.info("Recco Results: ")
recco_res = recco_scraper.get_features(id=str(song_id).strip())

logger.info(f"  Spotify-IDs align: {str(recco_res["href"]).split(sep="/")[-1] == song_id}")
logger.info(f"  Recco-ID: {recco_res["id"]}")

logger.info(f"  Spotify-ID: {str(recco_res["href"]).split(sep="/")[-1]}")
logger.info(f"  acousticness: {recco_res["acousticness"]}")
logger.info(f"  danceability: {recco_res["danceability"]}")
logger.info(f"  energy: {recco_res["energy"]}")
logger.info(f"  instrumentalness: {recco_res["instrumentalness"]}")
logger.info(f"  key: {key_mapping[recco_res["key"]]}")

if not ("mode" in dict(recco_res).keys()):
    logger.info("  mode: NULL")
else:
    logger.info(f"  mode: {mode_mapping[recco_res["mode"]]}")

logger.info(f"  liveness: {recco_res["liveness"]}")
logger.info(f"  loudness: {recco_res["loudness"]}")
logger.info(f"  speechiness: {recco_res["speechiness"]}")
logger.info(f"  tempo: {recco_res["tempo"]}")
logger.info(f"  valence: {recco_res["valence"]}")
logger.info("")
logger.info("")
logger.info("")