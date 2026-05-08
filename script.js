

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
};

let nbaTeamIds={};

async function loadTeamIds(){
    try{
        const response = await fetch("/json/nba_team_id.json");
        nbaTeamIds =await response.json();
        console.log(nbaTeamIds)

    }
    catch(error){
        console.log(error);
    }
}

document.addEventListener("DOMContentLoaded", init);
async function init() {
    //get the team ids
    await loadTeamIds();


    let submitPlayer = document.getElementById("submitPlayer");
    if (submitPlayer) submitPlayer.addEventListener("click", submitPlayerClick);

    const compareBtn = document.getElementById("compareBtn");
    if (compareBtn) compareBtn.addEventListener("click", comparePlayers);
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
        const gameRes = await fetch(`${base_url}/games?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const gamesData = await gameRes.json();

        const oddsRes = await fetch(`${base_url}/odds?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const oddsData = await oddsRes.json();

        const playerRes = await fetch(`${base_url}/players?league=${nba_league_id}&season=${current_season}`, requestOptions);
        const livePlayerData = await playerRes.json();

        // Normalize player photos using NBA.com CDN
        livePlayerData.response.forEach(p => {
            const nbaId =
                p.id ||
                p.player_id ||
                p.nba_id ||
                p.player?.id ||
                p.player?.player_id ||
                null;

            playerPhotos[p.id] = nbaId
                ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`
                : "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";
        });

        apiData = gamesData.response.map(game => {
            const gameOdds = oddsData.response?.find(o => o.game.id === game.id);

            const nbaTeamLogo = id =>
                `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg`;

            return {
                GAME_ID: game.id,
                GAME_DATE: game.date,
                TEAM_NAME: `${game.teams.home.name} vs ${game.teams.away.name}`,
                STATUS: game.status.long,
                SCORE: `${game.scores.home.total} - ${game.scores.away.total}`,
                ODDS: gameOdds ? `Home: ${gameOdds.bookmakers[0].bets[0].values[0].odd}` : 'N/A',
                HOME_LOGO: nbaTeamLogo(game.teams.home.id),
                AWAY_LOGO: nbaTeamLogo(game.teams.away.id)
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
    const errorDiv = document.getElementById("errorDiv");

    if (!name1 || !name2) {
        errorDiv.innerHTML = "<p>Please enter both player names</p>";
        return;
    }

    if(year<2004 || year>2026){
        errorDiv.innerHTML = "<p>Please enter a year between 2004 and 2026.</p>";
        return;

    }

    const season = await loadSeason(year);
    const player1 = season.players.find(p => p.PLAYER_NAME.toLowerCase().includes(name1));
    const player2 = season.players.find(p => p.PLAYER_NAME.toLowerCase().includes(name2));

    if (!player1 || !player2) {
        console.log('player not found');
        return;
    }

    errorDiv.innerHTML = "";
    renderPlayerCard("player1Card", player1);
    renderPlayerCard("player2Card", player2);
}

function renderPlayerCard(elementId, player) {
    const container = document.getElementById(elementId);

    const nbaId =
        player.PLAYER_ID ||
        player.PERSON_ID ||
        player.ID ||
        player.player_id ||
        null;

    const photo = nbaId
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`
        : "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";

    container.innerHTML = `
      <div class="player-card">
        <img src="${photo}" style="width:120px;border-radius:10px;margin-bottom:10px;">
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
    if (!searchInput) {
        searchMessage.innerText = "Please enter a name or team.";
        renderTable([]);
        return;
    }
    if(year<2004 || year>2026){
        searchMessage.innerText = "Please enter a year between 2004 and 2026";
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

    const seasonStart = new Date(year, 9, 1);
    const seasonEnd = new Date(year + 1, 5, 30);

    searchMessage.innerText = "";

    const filteredTeams = nbaData.filter(game => {
        const gameDate = new Date(game.GAME_DATE);
        const matchesTerm = game.TEAM_NAME.toLowerCase().includes(searchTerm);
        const matchesSeason = gameDate >= seasonStart && gameDate <= seasonEnd;
        return matchesTerm && matchesSeason;
    });

    const filteredPlayers = playerData.filter(player => {
        const gameDate = new Date(player.GAME_DATE);
        const matchesTerm = player.PLAYER_NAME.toLowerCase().includes(searchTerm);
        const matchesSeason = gameDate >= seasonStart && gameDate <= seasonEnd;

        const team = player.TEAM_NAME?.toLowerCase();
        const teamId = nbaTeamIds[team];

        player.HOME_LOGO = teamId ? `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg` : "";
        player.AWAY_LOGO = player.HOME_LOGO;

        return matchesTerm && matchesSeason;
    });

    const filteredApiGames = apiData.filter(game =>
        game.TEAM_NAME.toLowerCase().includes(searchTerm)
    );

    const allResults = filteredPlayers.concat(filteredTeams);
    renderTable(allResults.slice(0, 50));

    if (allResults.length === 0) {
        searchMessage.innerText = `No results found for ${term}`;
    }

    renderLiveGames(filteredApiGames);
}

function renderTable(data) {
    const headerRow = document.getElementById("headerRow");
    const tableBody = document.getElementById("tableBody");

    headerRow.innerHTML = "";
    tableBody.innerHTML = "";
    if (data.length === 0) return;

    let columns = [];
    if (data[0].PLAYER_NAME) {
        columns = ["PLAYER_NAME", "HOME_LOGO", "GAME_DATE", "TEAM_NAME", "AWAY_LOGO", "MATCHUP", "PTS", "REB", "AST", "WL"];
    } else {
        columns = ["GAME_DATE", "TEAM_NAME", "MATCHUP", "PTS", "REB", "AST", "WL"];
    }

    columns.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col.replace("_", " ");
        headerRow.appendChild(th);
    });

    data.forEach(row => {
        const tr = document.createElement("tr");

        columns.forEach(col => {
            const td = document.createElement("td");

            if (col === "HOME_LOGO" || col === "AWAY_LOGO") {
                td.innerHTML = row[col]
                    ? `<img src="${row[col]}" width="60" height="60" style="object-fit:contain;">`
                    : "-";
            } else {
                td.innerText = row[col] ?? "-";
            }

            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}

function renderLiveGames(games) {
    const liveDiv = document.getElementById("liveGames");
    liveDiv.innerHTML = "";

    games.forEach(game => {
        const card = document.createElement("div");
        card.className = "game-card";

        card.innerHTML = `
            <p>${game.GAME_DATE.split('T')[0]}</p>
            <div>
                <img width="40" src="${game.HOME_LOGO}"> vs 
                <img width="40" src="${game.AWAY_LOGO}">
            </div>
            <p>${game.TEAM_NAME}</p>
            <p>Score: ${game.SCORE}</p>
            <p>${game.STATUS}</p>
            <p>Odds: ${game.ODDS}</p>
        `;

        liveDiv.appendChild(card);
    });
}