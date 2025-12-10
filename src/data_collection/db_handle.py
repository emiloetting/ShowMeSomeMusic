import sqlite3 
import os
import traceback
from logging import Logger
from abc import ABC


class DBHandler(ABC):
    """abstract class to handle DB-interactions."""
    def __init__(self, db_pth:str, logger:Logger) -> None:
        self.con = None
        self.crs = None
        self.logger = logger
        self.setup_con(db_pth)    # Establish connection


    def setup_con(self, pth:str) -> None:
        """Tries to establish a connection to a dabase.
        
        Args:
            pth (str): Path to DB-file
        
        Returns:
            None
        """
        try:
            if not os.path.exists(pth):
                self.logger.critical(f"Path <{pth}> does not exist!")
                raise FileExistsError(f"Path <{pth}> does not exist!")
            
            if not os.path.isfile(pth):
                self.logger.critical(f"Provided path <{pth}> does not lead to a file!")
                raise FileNotFoundError(f"Provided path <{pth}> does not lead to a file!")
            
            if not pth.endswith(".db"):
                self.logger.critical(f"Provided path <{pth} does not lead to a database!")
                raise ValueError(f"Provided path <{pth} does not lead to a database!")

            self.con = sqlite3.connect(pth)
            self.logger.info(f"Connected to database at: {pth}")
            self.crs = self.con.cursor()
            self.logger.info("Connection to database fully established.")
            self.logger.info("")
            self.logger.info("")


        except Exception as e:
            self.logger.critical(f"Could not establish connection to {os.path.split(pth)[1]}!")     # specifiy failed connection
            self.logger.error(e)

        

class ChordonomiconHandle(DBHandler):
    """Class to handle interactions with Chordonomicon DB."""
    def __init__(self, db_path:str, logger:Logger):
        super().__init__(db_pth=db_path,
                         logger=logger)


    def id_lookup(self, id:str) -> list|None:
        """Searches in connected DB's attribute 'spotify_song_id' for given id.
        
        Args:
            id (str): Spotify-ID to lookup
            
        Returns:
            found (list|bool): List if results
        """
        query = f"""
        SELECT * FROM data
        WHERE spotify_song_id = "{id}";
        """
        self.crs.execute(query)
        results = self.crs.fetchall()

        # Early-return None if nothing found
        if len(results) == 0:
            self.logger.warning("No matching entry found in Chordonomicon!")    # log
            return None
        
        self.logger.info("\nFound entry in Chordonomicon.")
        return list(results[0])
        

class DataCoreHandle(DBHandler):
    """Class to handle interactions with DataCore DB."""

    def __init__(self, db_path:str, logger:Logger, key_mapping:dict, mode_mapping:dict):
        super().__init__(db_pth=db_path, 
                         logger=logger)
        self.key_mapping = key_mapping
        self.mode_mapping = mode_mapping


    def _create_tables(self):
        song_table_qry = """
        CREATE TABLE IF NOT EXISTS tracks (
        track_id TEXT PRIMARY KEY,
        track_name TEXT,
        acousticness FLOAT,
        danceability FLOAT,
        duration_ms INTEGER,
        energy FLOAT,
        instrumentalness FLOAT,
        key INTEGER,
        mode INTEGER,
        liveness FLOAT,
        loudness FLOAT,
        speechiness FLOAT,
        tempo FLOAT,
        valence FLOAT
        );
        """

        artist_table_qry = """
        CREATE TABLE IF NOT EXISTS artists (
        artist_id TEXT PRIMARY KEY,
        artist_name TEXT
        );
        """

        chart_entries_qry = """
        CREATE TABLE IF NOT EXISTS chart_entries (
        track_id REFERENCES tracks(track_id),
        year INTEGER,
        position INTEGER NOT NULL,
        PRIMARY KEY (track_id, year)
        );
        """

        song_artists_qry = """
        CREATE TABLE IF NOT EXISTS track_artists (
        track_id TEXT REFERENCES tracks(track_id),
        artist_id TEXT REFERENCES artists(artist_id),
        PRIMARY KEY (track_id, artist_id)
        );
        """

        queries = [song_table_qry, chart_entries_qry, artist_table_qry, song_artists_qry]
        for query in queries:
            self.crs.execute(query)
        
        self.con.commit()


    def enter_into_table(self, table:str, *args) -> bool:
        """Prepares entering of data into database, does not commit for cross-dependency security!
        <br>  
        **WARNING**: Args have to be in passed in correct order for db-insertion!
        
        Args:
            table (str): Table to which tuple specified via args is to be added to.
            *args: Values (sorted to match table-structure) to be added.
        
        Returns:
            success (bool): Whether or not insertion could be done.
        """
        # Verify data type of arguments
        if not isinstance(table,str):
            raise TypeError(f"Got <{type(table)}> passed as table. Expected <str>!")

        try: 
            # Check compatibilty of arguments and table
            self.crs.execute(f"PRAGMA table_info({table})")
            table_cols = self.crs.fetchall()

            if len(args) != len(table_cols):
                self.logger.critical(f"Invalid amount of arguments for insertion into table {table} was given! Song could not be added.")
                return False    # Return info of failed insertion

            # Prepare query
            params = ",".join(["?"]*len(table_cols))
            query = f"""
            INSERT INTO {table} 
            VALUES ({params});
            """
            
            # Actual insertion
            self.crs.execute(query, args)
            return True

        except Exception:
            traceback.print_exc()   # Display where exactly error happened.
            return False


    def _search_artist(self, artist_id:str) -> list:
        """Searches for artist in table of artists.
        
        Args:
            artist_id (str): Spotify-ID of artist.
        
        Returns:
            results (list): Results of query.
        """
        self.crs.execute("""
        SELECT * FROM artists
        WHERE artist_id=?;           
        """, (artist_id,))
        return self.crs.fetchall()
    

    def insert_song(self, spotify_res:dict, recco_res:dict, year:int, pos:int) -> None:
        """Fills DataCore.db with song information provided by Spotify-API and Recco_beats-API.
        
        Args:
            spotify_res (dict): Dictionary-like object containing metadata from Spotify-API.
            recco_res (dict): Dictionary-like object containing further information provided by Recco_beats-API.
            year (int): Year in which track charted at given position.
            pos (int): Chart position of track in given year.

        Returns:
            None
        """
        assert type(year) == int, f"<{type(year)}> parsed as year. Expected <int>!"
        assert type(pos) == int, f"<{type(pos)}> parsed as pos. Expected <int>!"

        # Catch missing information in logs
        if spotify_res is None:
            self.logger.critical("NO SPOTIFY INFORMATION WAS PROVIDED - SKIPPED SONG!")
            return
        
        if recco_res is None:
            self.logger.warning("NO RECCO-BEATS INFORMATION ON SONG WAS PROVIDED!")

        track_id = spotify_res["id"]
        track_name = spotify_res["name"]
        duration_ms = spotify_res["duration_ms"]

        # Set to None as default in case recco_res is None
        acousticness = danceability = energy = instrumentalness = None
        key = mode = liveness = loudness = speechiness = tempo = valence = None


        if (recco_res is not None) and (str(recco_res["href"]).split(sep="/")[-1] == track_id):     # only extact info if spotify IDs align

            acousticness = recco_res["acousticness"]
            danceability = recco_res["danceability"]
            energy = recco_res["energy"]
            instrumentalness = recco_res["instrumentalness"]
            key = self.key_mapping[recco_res["key"]]
            if not ("mode" in dict(recco_res).keys()):
                mode = None     # sqlite handles as NULL automatically
            else:
                mode = self.mode_mapping[recco_res["mode"]]
            
            liveness = recco_res["liveness"]
            loudness = recco_res["loudness"]
            speechiness = recco_res["speechiness"]
            tempo = recco_res["tempo"]
            valence = recco_res["valence"]        

        try:
            pass
            # Fill table tracks
            tracks_success = self.enter_into_table("tracks",
                                  track_id, track_name, acousticness,
                                  danceability, duration_ms, energy, 
                                  instrumentalness, key, mode,
                                  liveness, loudness, speechiness, 
                                  tempo, valence
                                  )
            
            # Insert artist if not already happened
            artist_cntr = 0
            for artist in spotify_res["artists"]:
                if self._search_artist(artist_id=artist["id"]) == []:
                    temp_suc = self.enter_into_table("artists",
                                          artist["id"], artist["name"])
                    if (temp_suc):
                        artist_cntr += 1
                
                else:
                    artist_cntr += 1

            artist_success = (len(spotify_res["artists"]) == artist_cntr)
                    

            # Enter chart position
            chart_success = self.enter_into_table("chart_entries",
                                  track_id, year, pos
                                  )
            
            # Enter track_artists
            track_artist_cntr = 0  
            for artist in spotify_res["artists"]:
                temp_suc = self.enter_into_table("track_artists",
                                      track_id, artist["id"]
                                  )
                if (temp_suc):
                        track_artist_cntr += 1
            track_artist_success = (len(spotify_res["artists"]) == track_artist_cntr)
            
            if (tracks_success and artist_success and chart_success and track_artist_success):
                self.con.commit()
                self.logger.info(f"Successfully Added: {year} - {pos}")


        except Exception:
            self.con.rollback()  # Clear transaction to avoid accidental insertion on later commit
            self.logger.exception(f"SKIPPED SONG: '{track_name}' by '{[spotify_res["artists"][i]["name"] for i in range(len(spotify_res["artists"]))]}'")
        
        self.logger.info("")