import os
import json
from spotify_recco_fetcher import SpotifyScraper, ReccoScraper
from db_handle import DataCoreHandle
from log_setup import setup_logger



cwd = os.getcwd()
dcore_pth = os.path.join(cwd, "data", "DataCore.db")


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
    0 : "minor",
    1: "Major"
}

def main():

    # Init logger, DB Handle, SpotifyAPI Handle
    logger = setup_logger()


    spotify_scraper = SpotifyScraper(logger=logger)
    recco_scraper = ReccoScraper(logger=logger)
    datacore = DataCoreHandle(db_path=dcore_pth, 
                            logger=logger,
                            key_mapping=key_mapping,
                            mode_mapping=mode_mapping)

    # Load JSON with chart info
    with open("data/top_100_songs.json", "r") as f:
        charts = dict(json.load(f))


    # Actual Search
    for year in charts.keys():
        for pos in charts[year].keys():

            # Spotify
            spotify_res = spotify_scraper.search(song_name=charts[year][pos]["title"],
                                                artist_s=charts[year][pos]["artists"])
            
            recco_res = recco_scraper.get_features(id=spotify_res["id"])

            datacore.insert_song(spotify_res=spotify_res, 
                                 recco_res=recco_res, 
                                 year=int(year),
                                 pos=int(pos))

    
if __name__ == "__main__":
    main()