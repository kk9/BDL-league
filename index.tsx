
// --- DATA STRUCTURES ---
interface Player {
  id: string;
  name: string;
}

interface Pair {
  id: string;
  name: string;
  player1Id: string;
  player2Id: string;
}

interface Match {
  id: string;
  pair1Id: string;
  pair2Id: string;
  pair1Score: number;
  pair2Score: number;
}

interface League {
    id: string;
    name: string;
    players: Player[];
    pairs: Pair[];
    matches: Match[];
}

interface LeagueDB {
    leagues: Record<string, League>;
    activeLeagueId: string | null;
}

// --- CONFIGURATION ---
const POINTS_FOR_WIN = 2;
const DB_KEY = 'badminton_leagues_db';

// --- STATE MANAGEMENT ---
let state: LeagueDB = {
    leagues: {},
    activeLeagueId: null,
};

function loadState() {
    const savedStateJSON = localStorage.getItem(DB_KEY);
    if (savedStateJSON) {
        const savedState: LeagueDB = JSON.parse(savedStateJSON);
        // Basic data migration for legacy single-league structure
        if (!savedState.leagues && (savedState as any).players) {
            const legacyState = savedState as any;
             const defaultLeagueId = createUniqueId();
             state.leagues[defaultLeagueId] = {
                 id: defaultLeagueId,
                 name: 'My First League',
                 players: legacyState.players || [],
                 pairs: (legacyState.pairs || []).map((p: any): Pair => {
                    const player1Name = (legacyState.players.find((pl: Player) => pl.id === p.player1Id)?.name || 'Unknown');
                    const player2Name = (legacyState.players.find((pl: Player) => pl.id === p.player2Id)?.name || 'Unknown');
                    return { ...p, name: p.name || `${player1Name} & ${player2Name}` };
                 }),
                 matches: legacyState.matches || [],
             };
             state.activeLeagueId = defaultLeagueId;
             saveState();
        } else {
            state = savedState;
        }
    }
}


function saveState() {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
}

function getActiveLeague(): League | null {
    if (state.activeLeagueId && state.leagues[state.activeLeagueId]) {
        return state.leagues[state.activeLeagueId];
    }
    return null;
}

// --- DOM ELEMENT GETTERS ---
function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id) as T | null;
    if (!element) {
        throw new Error(`Element with id '${id}' not found`);
    }
    return element;
}


// --- UTILITY FUNCTIONS ---
function createUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getPlayerName(playerId: string): string {
    const league = getActiveLeague();
    if (!league) return 'Unknown Player';
    const player = league.players.find(p => p.id === playerId);
    return player ? player.name : 'Unknown Player';
}

function getPairName(pairId: string): string {
    const league = getActiveLeague();
    if (!league) return 'Unknown Team';
    const pair = league.pairs.find(p => p.id === pairId);
    return pair ? pair.name : 'Unknown Team';
}

// --- RENDER FUNCTIONS ---
function renderAppUI() {
    const leagueIds = Object.keys(state.leagues);
    const mainContent = getElement('main-content');
    const welcomeScreen = getElement('welcome-screen');
    const leagueControls = getElement('league-controls');

    if (leagueIds.length === 0 || !state.activeLeagueId) {
        mainContent.style.display = 'none';
        welcomeScreen.style.display = 'block';
        leagueControls.style.display = 'none';
        getElement('nav-leaderboard').click();
    } else {
        mainContent.style.display = 'block';
        welcomeScreen.style.display = 'none';
        leagueControls.style.display = 'flex';
        renderLeagueSwitcher();
        renderAll();
    }
}

function renderLeagueSwitcher() {
    const switcher = getElement<HTMLSelectElement>('league-switcher');
    switcher.innerHTML = '';
    Object.values(state.leagues).forEach(league => {
        const option = document.createElement('option');
        option.value = league.id;
        option.textContent = league.name;
        switcher.appendChild(option);
    });
    if (state.activeLeagueId) {
        switcher.value = state.activeLeagueId;
    }
}

function renderPlayersList() {
    const league = getActiveLeague();
    if (!league) return;
    const playersList = getElement('players-list');
    playersList.innerHTML = '';
    league.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => deletePlayer(player.id);
        
        li.appendChild(deleteBtn);
        playersList.appendChild(li);
    });
    updatePlayerSelects();
}

function renderPairsList() {
    const league = getActiveLeague();
    if (!league) return;
    const pairsList = getElement('pairs-list');
    pairsList.innerHTML = '';
    league.pairs.forEach(pair => {
        const li = document.createElement('li');
        const contentSpan = document.createElement('span');
        contentSpan.innerHTML = `<strong>${pair.name}</strong> <span class="players-in-pair">(${getPlayerName(pair.player1Id)} & ${getPlayerName(pair.player2Id)})</span>`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = () => deletePair(pair.id);

        li.appendChild(contentSpan);
        li.appendChild(deleteBtn);
        pairsList.appendChild(li);
    });
    updatePairSelects();
}

function renderMatchHistory() {
    const league = getActiveLeague();
    if (!league) return;
    const historyList = getElement('match-history-list');
    historyList.innerHTML = '';
    [...league.matches].reverse().forEach(match => {
        const li = document.createElement('li');
        const pair1Name = getPairName(match.pair1Id);
        const pair2Name = getPairName(match.pair2Id);
        li.innerHTML = `
            <span class="team">${pair1Name}</span>
            <span class="score">${match.pair1Score} - ${match.pair2Score}</span>
            <span class="team">${pair2Name}</span>
        `;
        historyList.appendChild(li);
    });
}

function renderLeaderboard() {
    const league = getActiveLeague();
    if (!league) return;
    const leaderboardBody = getElement<HTMLTableSectionElement>('leaderboard-tbody');
    leaderboardBody.innerHTML = '';

    const pairPoints = new Map<string, number>();
    league.pairs.forEach(p => pairPoints.set(p.id, 0));

    league.matches.forEach(match => {
        if (match.pair1Score !== match.pair2Score) {
            const winnerId = match.pair1Score > match.pair2Score ? match.pair1Id : match.pair2Id;
            if (pairPoints.has(winnerId)) {
                pairPoints.set(winnerId, (pairPoints.get(winnerId) || 0) + POINTS_FOR_WIN);
            }
        }
    });

    const rankedPairs = Array.from(pairPoints.entries())
        .map(([pairId, points]) => ({ pairId, points }))
        .sort((a, b) => b.points - a.points);

    rankedPairs.forEach((rankedPair, index) => {
        const row = leaderboardBody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${getPairName(rankedPair.pairId)}</td>
            <td>${rankedPair.points}</td>
        `;
    });
}

function updatePlayerSelects() {
    const league = getActiveLeague();
    if (!league) return;
    const createPairForm = getElement('create-pair-form');
    const selects = createPairForm.querySelectorAll<HTMLSelectElement>('select');
    
    selects.forEach(select => {
        const selectedValue = select.value;
        select.innerHTML = '<option value="">Select a player</option>';
        league.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);
        });
        select.value = selectedValue;
    });
}

function updatePairSelects() {
    const league = getActiveLeague();
    if (!league) return;
    const recordMatchForm = getElement('record-match-form');
    const selects = recordMatchForm.querySelectorAll<HTMLSelectElement>('select');

    selects.forEach(select => {
        const selectedValue = select.value;
        select.innerHTML = '<option value="">Select a team</option>';
        league.pairs.forEach(pair => {
            const option = document.createElement('option');
            option.value = pair.id;
            option.textContent = getPairName(pair.id);
            select.appendChild(option);
        });
        select.value = selectedValue;
    });
}

function renderAll() {
    renderPlayersList();
    renderPairsList();
    renderMatchHistory();
    renderLeaderboard();
}

// --- EVENT HANDLERS & LOGIC ---

function handleAddPlayer(event: Event) {
    event.preventDefault();
    const league = getActiveLeague();
    if (!league) return;

    const nameInput = getElement<HTMLInputElement>('player-name');
    const name = nameInput.value.trim();
    if (name) {
        if (league.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert('Player with this name already exists in this league.');
            return;
        }
        league.players.push({ id: createUniqueId(), name });
        nameInput.value = '';
        saveState();
        renderPlayersList();
    }
}

function deletePlayer(playerId: string) {
    const league = getActiveLeague();
    if (!league) return;
    if (!confirm('Are you sure you want to delete this player? This will also delete any pairs they are in and all related matches.')) {
        return;
    }

    const affectedPairIds = league.pairs
        .filter(p => p.player1Id === playerId || p.player2Id === playerId)
        .map(p => p.id);
    
    affectedPairIds.forEach(pairId => {
        league.matches = league.matches.filter(m => m.pair1Id !== pairId && m.pair2Id !== pairId);
        league.pairs = league.pairs.filter(p => p.id !== pairId);
    });

    league.players = league.players.filter(p => p.id !== playerId);
    
    saveState();
    renderAll();
}

function handleCreatePair(event: Event) {
    event.preventDefault();
    const league = getActiveLeague();
    if (!league) return;

    const teamNameInput = getElement<HTMLInputElement>('team-name-input');
    const player1Select = getElement<HTMLSelectElement>('player1-select');
    const player2Select = getElement<HTMLSelectElement>('player2-select');
    const name = teamNameInput.value.trim();
    const player1Id = player1Select.value;
    const player2Id = player2Select.value;

    if (!name) {
        alert('Please provide a team name.');
        return;
    }
    if (league.pairs.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('A team with this name already exists in this league.');
        return;
    }

    if (player1Id && player2Id && player1Id !== player2Id) {
        const pairExists = league.pairs.some(p =>
            (p.player1Id === player1Id && p.player2Id === player2Id) ||
            (p.player1Id === player2Id && p.player2Id === player1Id)
        );

        if (pairExists) {
            alert('This pair of players already exists.');
            return;
        }

        const playerAlreadyInPair = league.pairs.some(p => p.player1Id === player1Id || p.player2Id === player1Id || p.player1Id === player2Id || p.player2Id === player2Id);
        if (playerAlreadyInPair) {
            alert('One of the selected players is already in another team. Each player can only be in one team per league.');
            return;
        }

        league.pairs.push({ id: createUniqueId(), name, player1Id, player2Id });
        teamNameInput.value = '';
        player1Select.value = '';
        player2Select.value = '';
        saveState();
        renderPairsList();
    } else if (player1Id && player1Id === player2Id) {
        alert('Please select two different players.');
    } else {
        alert('Please select two players.');
    }
}

function deletePair(pairId: string) {
    const league = getActiveLeague();
    if (!league) return;
    if (!confirm('Are you sure you want to delete this pair? This will also delete their match history.')) {
        return;
    }
    league.matches = league.matches.filter(m => m.pair1Id !== pairId && m.pair2Id !== pairId);
    league.pairs = league.pairs.filter(p => p.id !== pairId);

    saveState();
    renderAll();
}

function handleRecordMatch(event: Event) {
    event.preventDefault();
    const league = getActiveLeague();
    if (!league) return;

    const form = getElement<HTMLFormElement>('record-match-form');
    const pair1Select = getElement<HTMLSelectElement>('pair1-select');
    const pair2Select = getElement<HTMLSelectElement>('pair2-select');
    const pair1ScoreInput = getElement<HTMLInputElement>('pair1-score');
    const pair2ScoreInput = getElement<HTMLInputElement>('pair2-score');

    const pair1Id = pair1Select.value;
    const pair2Id = pair2Select.value;
    const pair1Score = parseInt(pair1ScoreInput.value, 10);
    const pair2Score = parseInt(pair2ScoreInput.value, 10);

    if (!pair1Id || !pair2Id) {
        alert('Please select both teams.'); return;
    }
    if (pair1Id === pair2Id) {
        alert('A team cannot play against itself.'); return;
    }
    if (isNaN(pair1Score) || isNaN(pair2Score)) {
        alert('Please enter valid scores for both teams.'); return;
    }
    if (pair1Score === pair2Score) {
        alert('Scores cannot be the same. Please determine a winner.'); return;
    }

    league.matches.push({
        id: createUniqueId(),
        pair1Id, pair2Id, pair1Score, pair2Score,
    });
    
    form.reset();
    saveState();
    renderAll();
}


function handleCreateLeague(event: Event) {
    event.preventDefault();
    const leagueNameInput = getElement<HTMLInputElement>('league-name-input');
    const name = leagueNameInput.value.trim();
    if (name) {
        const newId = createUniqueId();
        state.leagues[newId] = {
            id: newId, name, players: [], pairs: [], matches: [],
        };
        state.activeLeagueId = newId;
        saveState();
        leagueNameInput.value = '';
        getElement('create-league-modal').style.display = 'none';
        renderAppUI();
    }
}

function handleSwitchLeague(event: Event) {
    const target = event.target as HTMLSelectElement;
    state.activeLeagueId = target.value;
    saveState();
    renderAppUI();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-btn');
    const sections = document.querySelectorAll<HTMLElement>('.content-section');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            sections.forEach(section => section.classList.remove('active'));

            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            const targetSectionId = button.id.replace('nav-', '') + '-section';
            const targetSection = getElement(targetSectionId);
            targetSection.classList.add('active');
        });
    });
}

function showCreateLeagueModal() {
    getElement('create-league-modal').style.display = 'flex';
    getElement<HTMLInputElement>('league-name-input').focus();
}

// --- INITIALIZATION ---
function init() {
    // Core App Listeners
    getElement('add-player-form').addEventListener('submit', handleAddPlayer);
    getElement('create-pair-form').addEventListener('submit', handleCreatePair);
    getElement('record-match-form').addEventListener('submit', handleRecordMatch);
    
    // League Management Listeners
    getElement('create-league-btn').addEventListener('click', showCreateLeagueModal);
    getElement('welcome-create-league-btn').addEventListener('click', showCreateLeagueModal);
    getElement('create-league-form').addEventListener('submit', handleCreateLeague);
    getElement('cancel-league-creation').addEventListener('click', () => {
        getElement('create-league-modal').style.display = 'none';
    });
    getElement('league-switcher').addEventListener('change', handleSwitchLeague);

    setupNavigation();
    loadState();
    renderAppUI();
}

// Run app
init();
