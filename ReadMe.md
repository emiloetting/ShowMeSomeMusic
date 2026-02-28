# Show Me Some Music
A student project as part of the "Interactive Storytelling" - module by Prof. Kay Schröder.


## About
This project aims to provide an interactive overview over how popular music has evolved over time.    
The data basis consists of the Billboard Year-End Hot 100 singles from 1959 to 2024.  
Based on this, multiple interactive visualizations have been created, each focussing on a different aspect of how the music has changed.    
The data is based on automatically gathered chart-lists on Wikipedia, the songs on which were then analyzed and visualized.   
Enjoy the change of music and encounter remarkable findings hidden within!  

## Getting started
In order to access the visuals, a few steps need to be executed.  
Simply follow the instructions listed below and you should be ready to go.  

1️⃣ **Installing Node.js:**  
Ensure to install a version of Node >= 18. For replicating the testing environment, use version v24.12.0.
Use e.g. nvm:
```
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```
```
nvm install 24
nvm use 24
```
or use brew:
```
brew install node@24
```
Varify installation via
```
node -v
```

2️⃣ **Cloning the repo:**  
Run the following command within your preferred directory to clone this repository:
```shell
git clone https://github.com/emiloetting/ShowMeSomeMusic
```

3️⃣ **Navigating to the VisualDesign directory:**  
In order to get the web interface up and running, check out the VisualDesign subdirectory after entering the repository directory
```shell
cd ShowMeSomeMusic\
cd VisualDesign
```

4️⃣ **Colleciting required modules:**  
Before starting, ensure to execture the following command within the VisualDesign subdirectoy to collect code-dependencies!
```
npm install
```

5️⃣ **Start up server-file:**  
Within your CLI, start the server by entering
```
node server.js
```

6️⃣ **Enjoy** 🍵  
Open your browser (tested with Google Chrome), visit your localhost and connect to port 3000
( Type ```http://localhost:3000/``` into your browser )
This will lead you to the landing page, from which you can start exploring :)

**Note**
This repository also features python modules which have been used in the process of data collection.  
They are irrelevant for opening the visualizations, hence they can be neglected.  


## Impressions
<img width="2486" height="1111" alt="Development of average song loudness" src="https://github.com/user-attachments/assets/9623db10-3e7d-4118-9a18-9c7c54552651" />
<br>

*Figure 1: Development of average song loudness* 

<br>
<br>
<br>

<img width="2541" height="1182" alt="image" src="https://github.com/user-attachments/assets/d32577a9-34ed-4f66-85dd-ebe0c42f43c1" />
<br>

*Figure 2: Danceability of chart listed songs over the past decaades*   

<br>
<br>
<br>

<img width="2540" height="1257" alt="image" src="https://github.com/user-attachments/assets/0fdab938-a871-4c42-8a54-a60feca4d430" />
<br>

*Figure 3: Average Energy levels over chart positional interval over time* 

<br>
<br>
<br>

<img width="2557" height="764" alt="image" src="https://github.com/user-attachments/assets/a9c11be8-b6a8-41dd-a0a2-d8652afe5b0d" />
<br>

*Figure 4: Songs' movements through the charts*
