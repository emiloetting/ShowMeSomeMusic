import os
import numpy as np
from dotenv import load_dotenv
import base64
from requests import post, get
import json
import time
from logging import Logger
from urllib.parse import quote
from jarowinkler import jaro_similarity


class SpotifyScraper:
    """Class to fetch data from spotify API."""
    def __init__(self, logger:Logger):
        self.logger = logger
        load_dotenv()
        self.client_id = os.getenv("CLIENT_ID")
        self.client_secret = os.getenv("CLIENT_SECRET")
        self.url = None
        self.token = None
        self.token_expiration = None
        self.auth_header = None
        self.get_token()


    def _list_artists(self, artist_s:str) -> list:
        """Parser for multiple artist as listed in top_100_songs.
        
        Args:
            artist_s (str): Artist(s) to parse correctly into list.
        
        Returns:
            prepared (list): List containing artists prepared to be used in self.search.
        """
        assert type(artist_s) == str, f"Expected string, got <{type(artist_s)}>"

        to_replace = ["(feat.", " feat." "(featuring", " featuring", " and", "(with", " FEAT. ", "(FEAT. ", " FEATURING ", " AND ", " WITH "]
        for x in to_replace:
            artist_s = artist_s.replace(x, "§") # use highly unlikely char to split later on -> avoids "," due to e.g. "Earth, Wind & Fire"

        artist_s = artist_s.split(sep="§")
        artist_s = [artist.strip() for artist in artist_s]

        return artist_s  # Pay respect to Requests library for handling special unicode chars


    def search(self, song_name:str, artist_s:str) -> dict|None:
        """Sends request to Spotify-API searching for a specific song.
        
        Args:
            song_name (str): Name of track to search.
            artist_s (list[str]): List of artist names to take into consideration when evaluating results.
            full_str (str): 
            
        Returns:
            top_result (dict|None): Top result dictionary-entry of dict returned by API. None if no match was found at all.
        """
        self.token_expiration_check()
        artist_list = self._list_artists(artist_s)
        self.logger.info(f"Searching track '{song_name}' by {artist_list}")
        url = "https://api.spotify.com/v1/search"
        
        artists_joined = [artist for artist in artist_list[:2]]    # take only first three to avoid query length > 250 chars 
        artists_joined = " ".join(artists_joined)            
        
        params = {
            "q": f'{song_name} {artists_joined} ',
            "type": "track",
            "limit": 5        # evaluate top 5 results
        }
        self.logger.info(f"Search query: {params["q"]}")
        result = get(url=url, 
                        headers=self.auth_header,
                        params=params)
        
        if result.status_code != 200:
            self.logger.error(
                f"Error accessing Spotify-API, status code: {result.status_code}, "
                f"Content-Type={result.headers.get('Content-Type')}, "
                f"Body='{result.text[:200]}'"
            )
    
            # Account for rate limiting
            sleeping_for = 1
            while result.status_code == 429:
                time.sleep(sleeping_for)
                sleeping_for = np.clip(sleeping_for, 1, 30)   # Clip to max 30s since that's window of rate calculation for Spotify
                sleeping_for *= 2
                result = get(url=url, 
                            headers=self.auth_header,
                            params=params)
                self.logger.info(f"Status: {result.status_code}")

        # Early return if nothing helped
        if result.status_code != 200:
            return None
        
        result = json.loads(result.content)
        if len(result["tracks"]["items"]) == 0:
            self.logger.warning("No search results given!")
            return None

        # Calc metric to evaluate quality of matches and select best
        matches = {}

        # Found tracks
        for i, track_result in enumerate(result["tracks"]["items"]):
            jaros_sum = 0

            for artist in artist_list:
                jaros = [jaro_similarity(x["name"], artist, score_cutoff=0.3)  # set 0 if match-score < 0.7 -> allows for full simpler ietarion over all artists without big chances of distortion in metric due to
                            for x in track_result["artists"][:2]]
                
                jaros_sum += max(jaros)     # only consider highest match 
            
            weighted_jaros = jaros_sum / len(artist_list)

            # append to dict of general match-scores
            matches[i] = weighted_jaros   

        # Get key/index with highest jaros_sum
        res = max(matches, key=matches.get)
        self.logger.info(f"Best artist jaro-sim: {matches[res]}")

        # Consider best match-score might still be absolute trash:
        # if matches[res] < 0.4:
        #     # Check if Spotify-Artist is several names, e.g.
        #     self.logger.info("Comparing first spotify-artist to whole entry in artist-row.")
        #     # Combine artist names for comparison
        #     full_artist_name = ", ".join([x["name"] for x in track_result["artists"]])
        #     full_jaro = jaro_similarity(full_artist_name, artist_s)
        #     if full_jaro < 0.4:
        #         return None
        
        self.logger.info(f"Chose track '{result["tracks"]["items"][res]["name"]}' (ID: {result["tracks"]["items"][res]["id"]})")

        artists = ", ".join([artist["name"] for artist in result["tracks"]["items"][res]["artists"]])
        self.logger.info(f"By: {artists}")
        return dict(result["tracks"]["items"][res])     # return respective item 
    

    def get_token(self):
        self.logger.info("Starting token retrieval process")
        auth_str    = self.client_id+":"+self.client_secret
        auth_bytes  = auth_str.encode("utf-8")
        auth_base64 = str(base64.b64encode(auth_bytes), "utf-8")

        url = "https://accounts.spotify.com/api/token"
        headers = {
            "Authorization": "Basic "+auth_base64,
            "Content-Type" : "application/x-www-form-urlencoded"
        }
        
        data = {"grant_type": "client_credentials"}
        result = post(url=url,
                      headers=headers,
                      data=data)
        
        result = json.loads(result.content)
        self.token_expiration = time.time()+result["expires_in"]
        self.token = result["access_token"]
        self.auth_header = {"Authorization": "Bearer "+self.token}
        self.logger.info(f"New token: {self.token}")    # log


    def token_expiration_check(self) -> bool:
        """Returns True if token is valid for more than 5min before expected expiration time."""
        remaining_s = self.token_expiration - time.time()
        if remaining_s > 300:
            return True
    
        self.logger.warning(f"API-Token expires in {remaining_s}s! Grabbing new token")
        self.get_token()
        return False



class ReccoScraper():
    """Searches using Recco_API."""
    def __init__(self, logger:Logger):
        self.logger = logger
        self.headers = {"Accept": "application/json"}


    def _make_url(self, id:str):
        """Creates valid url."""
        return f"https://api.reccobeats.com/v1/audio-features?ids={id.strip()}"
    

    def get_features(self, id:str):
        """Sends get request for track's audio feature analysis to reccobeats.com.
        
        Args:
            id (str): Spotify-ID for track.
        
        Returns:
            result (dict|None): Results of analysis as dictionary, None if no analysis available.
        """
        if id is None:
            return None

        url = self._make_url(id)
        res = get(url=url, headers=self.headers)

        # Rate limiting
        sleeping_for = 1
        while res.status_code == 429:
            time.sleep(sleeping_for)
            sleeping_for = min(sleeping_for * 2, 30)
            res = get(url=url, headers=self.headers)

        if res.status_code != 200:
            self.logger.warning(
                f"Recco API error {res.status_code}: {res.text[:200]}"
            )
            return None

        try:
            data = res.json()
        except ValueError:
            self.logger.warning("Recco API returned non-JSON response")
            return None

        content = data.get("content", [])
        if not content:
            return None

        return content[0]