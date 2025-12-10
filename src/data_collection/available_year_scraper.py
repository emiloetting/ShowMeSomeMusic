import os
import json
import requests
import bs4 as bs 
from dotenv import load_dotenv

load_dotenv()
parent_link = os.environ.get("TOP_100_YEAR_LISTS_PAGE")
print(parent_link)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
}
html = requests.get(url=parent_link, headers=headers)
print(html.status_code)

soup = bs.BeautifulSoup(html.content, "html.parser")

# Year-Link Dict to store as json
links = {}
for link in soup.find_all('a', recursive=True):
    print(link)
    title = link.text   # get everythig in anchor tag
    if "Hot 100 singles of" in title:   # check if content is searched for
        href = link.get('href') # get hyperlink (relative)
        full_link = f"https://en.wikipedia.org{href}"  # make absolute
        links[str(title).split("singles of")[1].strip()] = full_link # append to dict
        print(full_link)

# Only store file if links were found
if len(links) > 0:
    with open("data/hot_100_year_links.json", 'w') as f:
        json.dump(links, f, indent=4)