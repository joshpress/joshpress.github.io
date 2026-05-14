let nbaData = [];
let playerData = [];

const seasonCache = {};
let nbaTeamIds = {};




document.addEventListener("DOMContentLoaded", init);
//init function to get button clicks and wire up autocomplete
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


    // Wire up autocomplete for the home page search input
    const yearInput = document.getElementById("year");
    if (yearInput) {
        yearInput.addEventListener("change", refreshHomeSuggestions);
        refreshHomeSuggestions();
    }


    // Wire up autocomplete for each player input on the compare page
    const p1Year = document.getElementById("p1Year");
    const p2Year = document.getElementById("p2Year");
    if (p1Year) {
        p1Year.addEventListener("change", () => refreshCompareSuggestions("p1Suggestions", p1Year.value));
        refreshCompareSuggestions("p1Suggestions", p1Year.value);
    }
    if (p2Year) {
        p2Year.addEventListener("change", () => refreshCompareSuggestions("p2Suggestions", p2Year.value));
        refreshCompareSuggestions("p2Suggestions", p2Year.value);
    }
}


//loading team ID json for photos
async function loadTeamIds() {
    try {
        const response = await fetch("/json/nba_team_id.json");
        nbaTeamIds = await response.json();
    } catch (error) {
        console.log(error);
    }
}


//caching for season
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


// Populate a <datalist> with unique player names (and team names).
function populateDatalist(datalistId, players, options = {}) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;


    const { includeTeams = false, games = [] } = options;
    const names = new Set();


    players.forEach(p => {
        if (p.PLAYER_NAME) names.add(p.PLAYER_NAME);
    });


    if (includeTeams) {
        games.forEach(g => {
            if (g.TEAM_NAME) names.add(g.TEAM_NAME);
        });
    }


    datalist.innerHTML = "";
    Array.from(names).sort().forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        datalist.appendChild(opt);
    });
}


async function refreshHomeSuggestions() {
    const year = parseInt(document.getElementById("year").value);
    if (isNaN(year) || year < 2004 || year > 2025) return;
    const season = await loadSeason(year);
    populateDatalist("searchSuggestions", season.players || [], {
        includeTeams: true,
        games: season.games || []
    });
}


async function refreshCompareSuggestions(datalistId, year) {
    const y = parseInt(year);
    if (isNaN(y) || y < 2004 || y > 2025) return;
    const season = await loadSeason(y);
    populateDatalist(datalistId, season.players || []);
}


// Find player rows by name with a fuzzy fallback so users don't have to type
// the exact name. Tries exact match first, then a unique substring match.
// players match, or { rows: [] } if nothing matches at all.
function findPlayerRows(players, rawName) {
    const target = rawName.toLowerCase().trim();


    // Exact match first
    let rows = players.filter(p => (p.PLAYER_NAME || "").toLowerCase() === target);
    if (rows.length) return { rows };


    // Fall back to substring match, but only if unambiguous
    const matchingNames = new Set();
    players.forEach(p => {
        if ((p.PLAYER_NAME || "").toLowerCase().includes(target)) {
            matchingNames.add(p.PLAYER_NAME);
        }
    });


    if (matchingNames.size === 1) {
        const onlyName = Array.from(matchingNames)[0].toLowerCase();
        rows = players.filter(p => (p.PLAYER_NAME || "").toLowerCase() === onlyName);
        return { rows };
    }


    if (matchingNames.size > 1) {
        return { rows: [], ambiguous: Array.from(matchingNames).slice(0, 5) };
    }


    return { rows: [] };
}




//computes stats for player averages
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
    //return the averages for the player
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
    //get inputs and per-player years
    const name1 = document.getElementById("p1Input")?.value.trim();
    const name2 = document.getElementById("p2Input")?.value.trim();
    const year1 = parseInt(document.getElementById("p1Year")?.value);
    const year2 = parseInt(document.getElementById("p2Year")?.value);
    const errorDiv = document.getElementById("errorDiv");


    if (!name1 || !name2) {
        errorDiv.innerText = "Please enter two player names to compare.";
        return;
    }


    const valid = (y) => !isNaN(y) && y >= 2004 && y <= 2025;
    if (!valid(year1) || !valid(year2)) {
        errorDiv.innerText = "Please enter years between 2004 and 2025.";
        return;
    }


    //load each player's season (cache dedupes if both years are the same)
    const [s1, s2] = await Promise.all([loadSeason(year1), loadSeason(year2)]);


    const r1 = findPlayerRows(s1.players || [], name1);
    const r2 = findPlayerRows(s2.players || [], name2);


    //compute averages and render player cards
    errorDiv.innerText = "";
    //check if a player was not found (this is if the user changes the year after searching)
    if (r1.rows.length === 0) {
        errorDiv.innerText = `${name1} not found`;
        //render a blank card to clear out the old one
        renderPlayerCard("player1Card", null, null);

    }
    if (r2.rows.length === 0) {
        errorDiv.innerText = `${name2} not found`;
        renderPlayerCard("player2Card", null, null);

    }
    //if both players don't exist
    if (r1.rows.length === 0 && r2.rows.length === 0) {
        errorDiv.innerText = `${name1} and ${name2} not found`;
        renderPlayerCard("player1Card", null, null);
        renderPlayerCard("player2Card", null, null);

    }
    const player1Data = computeSeasonAverages(r1.rows);
    const player2Data = computeSeasonAverages(r2.rows);
    renderPlayerCard("player1Card", player1Data, player2Data);
    renderPlayerCard("player2Card", player2Data, player1Data);
}




function renderPlayerCard(elementId, player, comparisonPlayer) {
    const container = document.getElementById(elementId);
    //render a blank card
    if (!player) container.innerHTML = "";

    if (!container || !player) return;
    //make sure data exists
    const nbaId =
        player.PLAYER_ID ||
        player.PERSON_ID ||
        player.ID ||
        player.player_id ||
        null;
    //get photo from NBA website, also uses nba_team_id.json
    const photo = nbaId
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`
        : "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";
    //sets up style based on comparison, red is lower, green is higher
    const getStatStyle = (statKey) => {
        if (!comparisonPlayer) return "";
        const val1 = player[statKey];
        const val2 = comparisonPlayer[statKey];


        if (val1 > val2) return 'style="color: green; font-weight: bold;"';
        if (val1 < val2) return 'style="color: red;"';
        //black if there is a tie
        return "";
    };
    //render the list based on the stat colors
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
                <li ${getStatStyle('MIN_SEC')}><strong>Minutes:</strong> ${player.MIN_SEC}</li>
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
    //get the season for the year
    const season = await loadSeason(year);


    nbaData = season.games;
    playerData = season.players;
    search(searchInput);
}




function search(term) {
    const searchTerm = term.toLowerCase();
    const searchMessage = document.getElementById("searchMessage");
    const year = parseInt(document.getElementById("year").value);
    //this starts the season in october and ends in june 30th of next year
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



    //player filtering
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



    const allResults = filteredPlayers.concat(filteredTeams);


    renderTable(allResults.slice(0, 50));


    if (!allResults.length) {
        searchMessage.innerText = `No results found for ${term}`;
    }


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