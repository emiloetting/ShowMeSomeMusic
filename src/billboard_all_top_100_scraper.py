import warnings
import json
import sqlite3
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

# Setup big DF to rule them all
full_df = pd.DataFrame({'position':[], 
                       'Title':[], 
                       'Artist(s)':[], 
                       'year':[]})


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

    # Add current year to data
    full_df = pd.concat([full_df, df], ignore_index=True)

    time.sleep(random.uniform(0.5, 1))  # make wikipedia think we're human

    
# ensure the accumulator has the intended nullable integer dtypes as well
full_df = full_df.astype({'year': 'Int32', 'position': 'Int16'})
full_df.reset_index(drop=True, inplace=True)
print()
print(full_df.info())
print()
print(full_df.describe())
print()
print(full_df.head())
print()
print(full_df.tail())


# dump as json
full_df.to_json("data/full_charts.json")