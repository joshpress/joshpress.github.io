
let nbaData = [];
let playerData = [];
let apiData = [];

const seasonCache = {};
let nbaTeamIds = {};
let liveDataLoaded = false;
let playerPhotos = {};

const API_KEY = '75d593d10d0e92056e834e5b58bd72e8';
const base_url = 'https://v1.basketball.api-sports.io';
const nba_league_id = 12;
const current_season = '2024-2025';

const requestOptions = {
    method: "GET",
    headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v1.basketball.api-sports.io"
    }
};


document.addEventListener("DOMContentLoaded", init);

async function init() {
    await loadTeamIds();

    const submitPlayer = document.getElementById("submitPlayer");
    if (submitPlayer) {
        submitPlayer.addEventListener("click", submitPlayerClick);
    }

    const compareBtn = document.getElementById("compareBtn");
    if (compareBtn) {
        compareBtn.addEventListener("click", comparePlayers);
    }
}


async function loadTeamIds() {
    try {
        const response = await fetch("/json/nba_team_id.json");
        nbaTeamIds = await response.json();
    } catch (error) {
        console.log(error);
    }
}


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
    } catch (error) {
        console.log(`Error loading season ${year}: ${error}`);
        return { games: [], players: [] };
    }
}


async function loadLiveData() {
    if (liveDataLoaded) return;

    try {
        const [gamesRes, oddsRes, playerRes] = await Promise.all([
            fetch(`${base_url}/games?league=${nba_league_id}&season=${current_season}`, requestOptions),
            fetch(`${base_url}/odds?league=${nba_league_id}&season=${current_season}`, requestOptions),
            fetch(`${base_url}/players?league=${nba_league_id}&season=${current_season}`, requestOptions)
        ]);

        const gamesData = await gamesRes.json();
        const oddsData = await oddsRes.json();
        const livePlayerData = await playerRes.json();

        // Cache player photos
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

            return {
                GAME_ID: game.id,
                GAME_DATE: game.date,
                TEAM_NAME: `${game.teams.home.name} vs ${game.teams.away.name}`,
                STATUS: game.status.long,
                SCORE: `${game.scores.home.total} - ${game.scores.away.total}`,
                ODDS: gameOdds
                    ? `Home: ${gameOdds.bookmakers[0].bets[0].values[0].odd}`
                    : "N/A",
                HOME_LOGO: `https://cdn.nba.com/logos/nba/${game.teams.home.id}/global/L/logo.svg`,
                AWAY_LOGO: `https://cdn.nba.com/logos/nba/${game.teams.away.id}/global/L/logo.svg`
            };
        });

        renderLiveGames(apiData);
        liveDataLoaded = true;
    } catch (error) {
        console.log(`Error loading live data: ${error}`);
    }
}


function computeSeasonAverages(games) {
    if (!games.length) return null;

    const gp = games.length;
    const sum = key =>
        games.reduce((total, game) => total + (Number(game[key]) || 0), 0);

    const totalFGM = sum("FGM");
    const totalFGA = sum("FGA");
    const totalFG3M = sum("FG3M");
    const totalFG3A = sum("FG3A");
    const totalFTM = sum("FTM");
    const totalFTA = sum("FTA");

    const avgMin = gp > 0 ? sum("MIN") / gp : 0;

    return {
        PLAYER_NAME: games[0].PLAYER_NAME,
        SEASON_YEAR: games[0].SEASON_YEAR,
        PLAYER_ID:
            games[0].PLAYER_ID ||
            games[0].PERSON_ID ||
            games[0].ID ||
            null,

        GP: gp,
        PTS: +(sum("PTS") / gp).toFixed(1),
        REB: +(sum("REB") / gp).toFixed(1),
        AST: +(sum("AST") / gp).toFixed(1),
        STL: +(sum("STL") / gp).toFixed(1),

        FG_PCT: totalFGA > 0 ? totalFGM / totalFGA : 0,
        FG3_PCT: totalFG3A > 0 ? totalFG3M / totalFG3A : 0,
        FT_PCT: totalFTA > 0 ? totalFTM / totalFTA : 0,

        MIN_SEC: avgMin.toFixed(2)
    };
}


async function comparePlayers() {
    const yearInput = document.getElementById("compareYear");
    const p1Input = document.getElementById("p1Input");
    const p2Input = document.getElementById("p2Input");
    const errorDiv = document.getElementById("errorDiv");

    const year = parseInt(yearInput?.value);
    const name1 = p1Input?.value.trim().toLowerCase();
    const name2 = p2Input?.value.trim().toLowerCase();

    if (!name1 || !name2) {
        errorDiv.innerText = "Please enter two player names to compare.";
        return;
    }

    if (isNaN(year) || year < 2004 || year > 2025) {
        errorDiv.innerText = "Please enter a year between 2004 and 2025";
        return;
    }

    const season = await loadSeason(year);
    const players = season.players || [];
    //changed includes to === to not double count names
    const p1Rows = players.filter(p =>
        (p.PLAYER_NAME || "").toLowerCase()===name1
    );

    const p2Rows = players.filter(p =>
        (p.PLAYER_NAME || "").toLowerCase()===name2
    );

    if (!p1Rows.length || !p2Rows.length) {
        errorDiv.innerText = "One or both players not found for that season.";
        return;
    }

    errorDiv.innerText = "";
    const player1Data = computeSeasonAverages(p1Rows);
    const player2Data = computeSeasonAverages(p2Rows);
    renderPlayerCard(
        "player1Card",
        player1Data,
        player2Data
    );

    renderPlayerCard(
        "player2Card",
        player2Data,
        player1Data
    );
}


function renderPlayerCard(elementId, player, comparisonPlayer) {
    const container = document.getElementById(elementId);
    if (!container || !player) return;

    const nbaId =
        player.PLAYER_ID ||
        player.PERSON_ID ||
        player.ID ||
        player.player_id ||
        null;

    const photo = nbaId
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`
        : "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";
    //sets up style based on comparison
    const getStatStyle = (statKey) => {
        if (!comparisonPlayer) return "";
        const val1 = player[statKey];
        const val2 = comparisonPlayer[statKey];

        if (val1 > val2) return 'style="color: green; font-weight: bold;"';
        if (val1 < val2) return 'style="color: red;"';
        return "";
    };
    //render the table based on the stat colors
    container.innerHTML = `
        <div class="player-card">
            <img 
                src="${photo}" 
                alt="${player.PLAYER_NAME}"
                style="width:120px;border-radius:10px;margin-bottom:10px;"
            >

            <h2>${player.PLAYER_NAME}</h2>
            <p><strong>Season:</strong> ${player.SEASON_YEAR || "N/A"}</p>

            <ul style="list-style:none;padding:0;">
                <li ${getStatStyle('GP')}><strong>Games:</strong> ${player.GP}</li>
                <li ${getStatStyle('PTS')}><strong>Points:</strong> ${player.PTS}</li>
                <li ${getStatStyle('REB')}><strong>Rebounds:</strong> ${player.REB}</li>
                <li ${getStatStyle('AST')}><strong>Assists:</strong> ${player.AST}</li>
                <li ${getStatStyle('STL')}><strong>Steals:</strong> ${player.STL}</li>
                <li ${getStatStyle('FG_PCT')}><strong>FG%:</strong> ${(player.FG_PCT * 100).toFixed(1)}%</li>
                <li><strong>Minutes:</strong> ${player.MIN_SEC}</li>
            </ul>
        </div>
    `;

}


async function submitPlayerClick() {
    const year = parseInt(document.getElementById("year").value);
    const searchInput = document.getElementById("searchInput").value.trim();
    const searchMessage = document.getElementById("searchMessage");

    if (!searchInput) {
        searchMessage.innerText = "Please enter a name or team.";
        renderTable([]);
        return;
    }

    if (year < 2004 || year > 2025) {
        searchMessage.innerText = "Please enter a year between 2004 and 2025.";
        return;
    }

    searchMessage.innerText = "Loading...";

    const season = await loadSeason(year);

    nbaData = season.games;
    playerData = season.players;

    //  await loadLiveData();

    search(searchInput);
}


function search(term) {
    const searchTerm = term.toLowerCase();
    const searchMessage = document.getElementById("searchMessage");
    const year = parseInt(document.getElementById("year").value);

    const seasonStart = new Date(year, 9, 1);
    const seasonEnd = new Date(year + 1, 5, 30);

    searchMessage.innerText = "";

    // Team/game filtering
    const filteredTeams = nbaData
        .filter(game => {
            const gameDate = new Date(game.GAME_DATE);

            return (
                game.TEAM_NAME.toLowerCase().includes(searchTerm) &&
                gameDate >= seasonStart &&
                gameDate <= seasonEnd
            );
        })
        .map(game => ({
            ...game,
            TEAM_LOGO: game.TEAM_ID
                ? `https://cdn.nba.com/logos/nba/${game.TEAM_ID}/global/L/logo.svg`
                : null
        }));


    const filteredPlayers = playerData.filter(player => {
        const gameDate = new Date(player.GAME_DATE);

        const matchesTerm =
            player.PLAYER_NAME.toLowerCase().includes(searchTerm);

        const matchesSeason =
            gameDate >= seasonStart &&
            gameDate <= seasonEnd;

        const playerAbbr = player.TEAM_ABBREVIATION;

        const matchupParts = player.MATCHUP.split(" ");

        const opponentAbbr = matchupParts.find(
            part =>
                part !== playerAbbr &&
                part !== "@" &&
                part !== "vs."
        );

        const opponentId = nbaTeamIds[opponentAbbr];

        player.HOME_LOGO =
            `https://cdn.nba.com/logos/nba/${player.TEAM_ID}/global/L/logo.svg`;

        player.AWAY_LOGO = opponentId
            ? `https://cdn.nba.com/logos/nba/${opponentId}/global/L/logo.svg`
            : "";

        return matchesTerm && matchesSeason;
    });

    const filteredApiGames = apiData.filter(game =>
        game.TEAM_NAME.toLowerCase().includes(searchTerm)
    );

    const allResults = filteredPlayers.concat(filteredTeams);

    renderTable(allResults.slice(0, 50));

    if (!allResults.length) {
        searchMessage.innerText = `No results found for ${term}`;
    }

    // renderLiveGames(filteredApiGames);
}

function renderTable(data) {
    const headerRow = document.getElementById("headerRow");
    const tableBody = document.getElementById("tableBody");

    headerRow.innerHTML = "";
    tableBody.innerHTML = "";

    if (!data.length) return;

    const columns = data[0].PLAYER_NAME
        ? [
            "PLAYER_NAME",
            "HOME_LOGO",
            "GAME_DATE",
            "TEAM_NAME",
            "AWAY_LOGO",
            "MATCHUP",
            "PTS",
            "REB",
            "AST",
            "WL"
        ]
        : [
            "GAME_DATE",
            "TEAM_NAME",
            "MATCHUP",
            "PTS",
            "REB",
            "AST",
            "WL"
        ];

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

    if (!liveDiv) return;

    liveDiv.innerHTML = "";

    games.forEach(game => {
        const card = document.createElement("div");

        card.className = "game-card";

        card.innerHTML = `
            <p>${game.GAME_DATE.split("T")[0]}</p>

            <div>
                <img width="40" src="${game.HOME_LOGO}">
                vs
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