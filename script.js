
let nbaData = [];
let playerData = [];
let apiData = [];
const seasonCache = {};

const API_KEY = '75d593d10d0e92056e834e5b58bd72e8';
const base_url = 'https://v1.basketball.api-sports.io';
const nba_league_id = 12;
const current_season = '2024-2025';
let playerPhotos = {};
let liveDataLoaded = false;

const requestOptions = {
    method: "GET",
    headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v1.basketball.api-sports.io"
    }
}


document.addEventListener("DOMContentLoaded", DOMContentLoaded);
function DOMContentLoaded() {
    let submitPlayer = document.getElementById("submitPlayer");

    if (submitPlayer) {
        submitPlayer.addEventListener("click", submitPlayerClick);

    }
    const compareBtn = document.getElementById("compareBtn");
    if (compareBtn) {
        compareBtn.addEventListener("click", comparePlayers);
    }
}

// loads one season's games + players, caches the result so repeat picks are instant.
async function loadSeason(year) {
    if (seasonCache[year]) return seasonCache[year];
    try {
        const [gamesRes, playersRes] = await Promise.all([
            fetch(`/json/games_${year}.json`),
            fetch(`/json/players_${year}.json`)
        ]);
        seasonCache[year] = {
            games: await gamesRes.json(),
            players: await playersRes.json()
        };
        return seasonCache[year];
    }
    catch (error) {
        console.log(`Error loading season ${year}: ${error}`);
        return { games: [], players: [] };
    }
}

// Fetches live game data from the API — only runs on first search
async function loadLiveData() {
    if (liveDataLoaded) return;

    try {
        //fetching games
        const gameRes = await fetch(`${base_url}/games?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const gamesData = await gameRes.json();
        console.log(gamesData);

        //fetching betting odds
        const oddsRes = await fetch(`${base_url}/odds?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const oddsData = await oddsRes.json();

        //fetching player data
        const playerRes = await fetch(`${base_url}/players?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const livePlayerData = await playerRes.json();

        //getting player photos, mapping playerid to imgURL
        livePlayerData.response.forEach(p => {
            playerPhotos[p.id] = p.photo;
        });

        //getting odds game data
        apiData = gamesData.response.map(game => {
            //find a match for the game
            const gameOdds = oddsData.response?.find(o => o.game.id === game.id);
            return {
                GAME_ID: game.id,
                GAME_DATE: game.date,
                TEAM_NAME: `${game.teams.home.name} vs ${game.teams.away.name}`,
                STATUS: game.status.long,
                SCORE: `${game.scores.home.total} - ${game.scores.away.total}`,
                ODDS: gameOdds ? `Home: ${gameOdds.bookmakers[0].bets[0].values[0].odd}` : 'N/A',
                HOME_LOGO: game.teams.home.logo,
                AWAY_LOGO: game.teams.away.logo
            };
        });

        renderLiveGames(apiData);
        liveDataLoaded = true;
    }
    catch (error) {
        console.log(`Error loading live data: ${error}`);
    }
}
async function comparePlayers() {
    const year = parseInt(document.getElementById("compareYear").value);
    const name1 = document.getElementById("p1Input").value.toLowerCase();
    const name2 = document.getElementById("p2Input").value.toLowerCase();
    const errorDiv=document.getElementById("errorDiv")
    if (!name1 || !name2) {
        errorDiv.innerHTML = "<p>Please enter both player names</p>";
        return;
    }
    const season = await loadSeason(year);
    const player1 = season.players.find(p => p.PLAYER_NAME.toLowerCase().includes(name1));
    const player2 = season.players.find(p => p.PLAYER_NAME.toLowerCase().includes(name2));

    if (!player1 || !player2) {
        console.log('player not found');
        return;
    }
   
    errorDiv.innerHTML="";
    renderPlayerCard("player1Card", player1);
    renderPlayerCard("player2Card", player2);
}

function renderPlayerCard(elementId, player) {
    const container = document.getElementById(elementId);


    container.innerHTML = `
  <div class="player-card">
    <h2>${player.PLAYER_NAME}</h2>
    <p><strong>Season:</strong> ${player.SEASON_YEAR || 'N/A'}</p>
    <ul style="list-style: none; padding: 0;">
      <li><strong>Points:</strong> ${player.PTS || 0}</li>
      <li><strong>Rebounds:</strong> ${player.REB || 0}</li>
      <li><strong>Assists:</strong> ${player.AST || 0}</li>
      <li><strong>Steals:</strong> ${player.STL || 0}</li>
      <li><strong>FG%:</strong> ${(player.FG_PCT * 100).toFixed(1)}%</li>
      <li><strong>Minutes:</strong> ${player.MIN_SEC || '0:00'}</li>
    </ul>
  </div>
`;
}

async function submitPlayerClick() {
    const year = parseInt(document.getElementById("year").value);
    const searchMessage = document.getElementById("searchMessage");
    const searchInput = document.getElementById("searchInput").value;
    //if no search term is entered
     if (!searchInput) {
        searchMessage.innerText = "Please enter a name or team.";
        renderTable([]);
        return;
    }
    searchMessage.innerText = "Loading...";

    const season = await loadSeason(year);
    nbaData = season.games;
    playerData = season.players;

    await loadLiveData();
  
    search(searchInput);
}


function search(term) {
    const searchTerm = term.toLowerCase();
    const searchMessage = document.getElementById("searchMessage");
    const year = parseInt(document.getElementById("year").value);
    //october is index 9
    const seasonStart = new Date(year, 9, 1);
    //june 30 of next year
    const seasonEnd = new Date(year + 1, 5, 30);

    searchMessage.innerText = "";
    //filter by name and year
    const filteredTeams = nbaData.filter(game => {
        const gameDate = new Date(game.GAME_DATE)
        const matchesTerm = game.TEAM_NAME.toLowerCase().includes(searchTerm) ||
            game.GAME_DATE.includes(searchTerm)
        //only check where year exists and is in the season
        const matchesSeason = !year || (gameDate >= seasonStart && gameDate <= seasonEnd);

        return matchesTerm && matchesSeason;
    });
    //player filter
    const filteredPlayers = playerData.filter(player => {
        const gameDate = new Date(player.GAME_DATE);
        const matchesTerm = player.PLAYER_NAME.toLowerCase().includes(searchTerm);

        const matchesSeason = !year || (gameDate >= seasonStart && gameDate <= seasonEnd);
        return matchesTerm && matchesSeason;
    });



    const filteredApiGames = apiData.filter(game => {
        const matchesTerm = game.TEAM_NAME.toLowerCase().includes(searchTerm);

        return matchesTerm;
    })
    const allResults = filteredPlayers.concat(filteredTeams);
    renderTable(allResults.slice(0, 50));
    if (allResults.length === 0) {
        searchMessage.innerText = `No results found for ${term}`;
    }
    renderLiveGames(filteredApiGames)
}

function renderTable(data) {
    const headerRow = document.getElementById("headerRow");
    const tableBody = document.getElementById("tableBody");

    headerRow.innerHTML = "";
    tableBody.innerHTML = "";
    if (data.length === 0) return
    let columns = [];
    if (data[0].PLAYER_NAME) {
        //if a player is in data
        columns = ["PLAYER_NAME", "HOME_LOGO", "GAME_DATE", "TEAM_NAME", "AWAY_LOGO", "MATCHUP", "PTS", "REB", "AST", "WL"]
    }
    else {
        //if team name
        columns = ["GAME_DATE", "TEAM_NAME", "MATCHUP", "PTS", "REB", "AST", "WL"]
    }
    //creating columns
    columns.forEach(col => {
        const th = document.createElement("th")
        th.innerText = col.replace("_", " ");
        headerRow.appendChild(th)
    });
    //creating rows
    data.forEach(row => {
        const tr = document.createElement("tr")
        columns.forEach(col => {
            const td = document.createElement("td")
            td.innerText = row[col] ?? "-"
            tr.appendChild(td)
        })
        tableBody.appendChild(tr)
    })
}
function renderLiveGames(games) {
    console.log(games)
    const liveDiv = document.getElementById("liveGames");
    liveDiv.innerHTML = "";

    games.forEach(game => {
        const stats=document.querySelectorAll("statsContainer")
        stats.className = "game-card";
        stats.innerHTML = `
                <p>${game.GAME_DATE.split('T')[0]}</p>
                <div>
                    <img width=30px src="${game.HOME_LOGO}""> vs 
                    <img width=30px src="${game.AWAY_LOGO}"">
                </div>
                <p>${game.TEAM_NAME}</p>
                <p>Score: ${game.SCORE}</p>
                <p>${game.STATUS}</p>
                <p>Odds: ${game.ODDS}</p>
            </div>
        `;
        liveDiv.appendChild(stats);
    });
}