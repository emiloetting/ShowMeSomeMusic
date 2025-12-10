import os
import warnings
import json
import requests
import bs4 as bs 
from dotenv import load_dotenv
import time
import random
import pandas as pd


# ignore FutureWarnings
warnings.simplefilter(action='ignore', category=FutureWarning)


# Activte access to .env variables
load_dotenv()

# load dict containing links to scrape
with open("data/hot_100_year_links.json", 'r') as f:
    year_links = json.load(f)

# Act as Chrome browser to wikipedia for 403 avoidance
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
}   

# Setup big Dict to rule them all
songs = {}


# Iterate over all colletced links and scrape table within each
for year, link in year_links.items():
    
    print(f"Scraping Hot 100 of {year}")
    html = requests.get(url=link, headers=headers)

    # If request denied show why
    if not int(html.status_code) == 200:
        print("status: ",html.status_code) 

    # Extract table from html
    soup = bs.BeautifulSoup(markup=html.content, features="html.parser")
    table = soup.find("table", {"class": "wikitable sortable"})

    # read into df & add year
    df = pd.read_html(str(table))[0]    # returns list of DFs, we want first
    df.rename(columns={'№': 'position', 'No.': 'position'}, inplace=True)
    df['year'] = [year]*len(df)
    df.reset_index(drop=True, inplace=True)
    df.astype({'year': 'Int32', 'position': 'Int16'})

    current_year = {}
    # Add current year to data
    for row in df.itertuples():

        # Account for possible errors while reading out
        try:
            # Fill 
            current_year[row.position] = {"title": row.Title, "artists": row._3}

        except Exception as e:
            print(e)
            print(f"Skipped song: {row.Title}\n")

    songs[year] = current_year
    time.sleep(random.uniform(0.2, 0.5))  # make wikipedia think we're human


# dump as json
os.makedirs("data", exist_ok=True)
with open("data/top_100_songs.json", "w") as f:
    json.dump(songs, f)