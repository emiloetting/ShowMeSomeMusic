import os
import json
from spotify_recco_fetcher import SpotifyScraper, ReccoScraper
from db_handle import DataCoreHandle
from log_setup import setup_logger
from create_datacore import make_datacore



cwd = os.getcwd()
dcore_pth = os.path.join(cwd, "DataStorage", "DataCore.db")


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

def main(fill_missing_singular: bool=True):
    """Main function to create (if not already existant) DataCore.db, gathers and fills in data."""

    # Create DB file
    if not os.path.exists(
        os.path.join(
            os.getcwd(), "DataStorage", "DataCore.db")
    ):
        make_datacore()
    
    # Init logger, DB Handle, SpotifyAPI Handle
    logger = setup_logger()


    spotify_scraper = SpotifyScraper(logger=logger)
    recco_scraper = ReccoScraper(logger=logger)
    datacore = DataCoreHandle(db_path=dcore_pth, 
                            logger=logger,
                            key_mapping=key_mapping,
                            mode_mapping=mode_mapping)
    
    found_year = datacore.crs.execute("""SELECT MAX(year) FROM chart_entries;""").fetchone()[0]
    logged_year = int(found_year) if found_year is not None else 1959
    current_index = datacore.crs.execute("SELECT MAX(position) FROM chart_entries WHERE year=?;",(logged_year,)).fetchone()[0]
    current_index = int(current_index) if current_index is not None else 0


    # Load JSON with chart info
    with open("DataStorage/top_100_songs.json", "r") as f:
        charts = dict(json.load(f))


    # Actual Search
    for year_s in sorted(charts.keys()):

        if not fill_missing_singular:
            if int(year) < logged_year:
                continue

        for pos_s in sorted(charts[year_s].keys()):

            pos = int(pos_s)
            year = int(year_s)

            if not fill_missing_singular:
                if year == logged_year and pos <= current_index:
                    continue

            if datacore.slot_exists(year, pos):
                continue  # if entry already found

            # Spotify
            spotify_res = spotify_scraper.search(song_name=charts[year_s][pos_s]["title"],
                                                artist_s=charts[year_s][pos_s]["artists"])
            
            if spotify_res is None:
                logger.warning("COULD NOT FIND SONG ON SPOTIFY")
                logger.warning(f"SKIPPING: {year}-{pos}")
                continue
            recco_res = recco_scraper.get_features(id=spotify_res["id"])

            datacore.insert_song(spotify_res=spotify_res, 
                                 recco_res=recco_res, 
                                 year=int(year),
                                 pos=int(pos))
            
            # Quick sanity check: do we have exactly 100 positions for this year?
        datacore.crs.execute("SELECT COUNT(*) FROM chart_entries WHERE year=?;", (int(year),))
        cnt = datacore.crs.fetchone()[0]

        datacore.crs.execute("SELECT position FROM chart_entries WHERE year=?;", (int(year),))
        got = {r[0] for r in datacore.crs.fetchall()}
        missing = [p for p in range(1, 101) if p not in got]

        logger.info(f"YEAR SUMMARY {year}: {cnt}/100 entries. Missing positions: {missing[:20]}{' ...' if len(missing) > 20 else ''}")

        datacore.create_monster_view()  # update mega-view once every chart-year


    
if __name__ == "__main__":
    main()