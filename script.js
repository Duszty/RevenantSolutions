/* ============================================
   REVENANT — Valorant Stats Tracker
   Application Logic
   ============================================ */

const API_BASE = 'https://api.henrikdev.xyz';

// ---- DOM Elements ----
const riotIdInput = document.getElementById('riot-id-input');
const regionSelect = document.getElementById('region-select');
const searchBtn = document.getElementById('search-btn');
const searchError = document.getElementById('search-error');
const recentSearches = document.getElementById('recent-searches');
const recentList = document.getElementById('recent-list');
const backBtn = document.getElementById('back-btn');
const logo = document.getElementById('logo');

const heroSection = document.getElementById('hero-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');

// Result elements
const playerAvatar = document.getElementById('player-avatar');
const playerCardBg = document.getElementById('player-card-bg');
const playerName = document.getElementById('player-name');
const playerTag = document.getElementById('player-tag');
const playerLevel = document.getElementById('player-level');
const rankIcon = document.getElementById('rank-icon');
const rankName = document.getElementById('rank-name');
const rankRR = document.getElementById('rank-rr');
const peakRankValue = document.getElementById('peak-rank-value');
const peakRankIcon = document.getElementById('peak-rank-icon');
const winsValue = document.getElementById('wins-value');
const eloValue = document.getElementById('elo-value');
const regionValue = document.getElementById('region-value');
const matchList = document.getElementById('match-list');

// ---- State ----
let apiKey = localStorage.getItem('revenant_api_key') || '';

// ---- Initialize ----
function init() {
    loadRecentSearches();
    checkApiKey();

    searchBtn.addEventListener('click', handleSearch);
    riotIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    backBtn.addEventListener('click', showSearch);
    logo.addEventListener('click', showSearch);
}

// ---- API Key Management ----
function checkApiKey() {
    if (!apiKey) {
        promptApiKey();
    }
}

function promptApiKey() {
    const key = prompt(
        'REVENANT — API Key Required\n\n' +
        'This app uses the Henrik Valorant API.\n' +
        'Get a FREE key:\n\n' +
        '1. Join: discord.gg/X3GaVkX2YN\n' +
        '2. Go to #get-a-key channel\n' +
        '3. Use the bot to generate a key\n\n' +
        'Paste your API key below:'
    );

    if (key && key.trim()) {
        apiKey = key.trim();
        localStorage.setItem('revenant_api_key', apiKey);
    }
}

// ---- Navigation ----
function showSection(section) {
    heroSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    section.classList.remove('hidden');
}

function showSearch() {
    showSection(heroSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Search ----
async function handleSearch() {
    const input = riotIdInput.value.trim();
    const region = regionSelect.value;

    // Validate input
    if (!input.includes('#')) {
        showError('Enter a valid Riot ID (e.g. Player#NA1)');
        return;
    }

    const [name, tag] = input.split('#');
    if (!name || !tag) {
        showError('Enter a valid Riot ID (e.g. Player#NA1)');
        return;
    }

    if (!apiKey) {
        promptApiKey();
        if (!apiKey) {
            showError('API key is required. Refresh the page to try again.');
            return;
        }
    }

    hideError();
    showSection(loadingSection);

    try {
        // Fetch account, MMR, and matches concurrently
        const [accountData, mmrData, matchData] = await Promise.all([
            fetchAccount(name, tag),
            fetchMMR(region, name, tag),
            fetchMatches(region, name, tag)
        ]);

        renderResults(accountData, mmrData, matchData, region);
        saveRecentSearch(input, region);
        showSection(resultsSection);
    } catch (error) {
        console.error('Search failed:', error);
        showSection(heroSection);
        showError(error.message || 'Failed to retrieve player data. Check the Riot ID and try again.');
    }
}

// ---- API Calls ----
async function fetchAccount(name, tag) {
    const res = await fetch(`${API_BASE}/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, {
        headers: { 'Authorization': apiKey }
    });

    if (!res.ok) {
        if (res.status === 404) throw new Error('Player not found. Check the Riot ID and tag.');
        if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
        if (res.status === 403) throw new Error('Invalid API key. Clear your key and try again.');
        throw new Error(`API error (${res.status})`);
    }

    const json = await res.json();
    if (json.status !== 200) throw new Error(json.errors?.[0]?.message || 'Account lookup failed');
    return json.data;
}

async function fetchMMR(region, name, tag) {
    const res = await fetch(`${API_BASE}/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, {
        headers: { 'Authorization': apiKey }
    });

    if (!res.ok) {
        // MMR may fail if player hasn't played ranked — return null
        if (res.status === 404) return null;
        if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
        return null;
    }

    const json = await res.json();
    if (json.status !== 200) return null;
    return json.data;
}

async function fetchMatches(region, name, tag) {
    const res = await fetch(`${API_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=10`, {
        headers: { 'Authorization': apiKey }
    });

    if (!res.ok) {
        if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
        return [];
    }

    const json = await res.json();
    if (json.status !== 200) return [];
    return json.data || [];
}

// ---- Render Results ----
function renderResults(account, mmr, matches, region) {
    // Player Card
    if (account.card) {
        playerAvatar.src = account.card.small || account.card.large || '';
        playerAvatar.alt = `${account.name}'s player card`;

        // Set wide card as background
        if (account.card.wide) {
            playerCardBg.style.backgroundImage = `linear-gradient(90deg, rgba(15,16,30,0.85), rgba(15,16,30,0.6)), url(${account.card.wide})`;
            playerCardBg.style.backgroundSize = 'cover';
            playerCardBg.style.backgroundPosition = 'center';
        }
    }

    playerName.textContent = account.name || '—';
    playerTag.textContent = `#${account.tag || '—'}`;
    playerLevel.textContent = account.account_level || '—';

    // MMR / Rank
    if (mmr && mmr.current_data) {
        const current = mmr.current_data;

        if (current.images && current.images.small) {
            rankIcon.src = current.images.small;
            rankIcon.style.display = 'block';
        } else {
            rankIcon.style.display = 'none';
        }

        rankName.textContent = current.currenttier_patched || 'Unranked';
        rankRR.textContent = current.ranking_in_tier != null ? `${current.ranking_in_tier} RR` : '— RR';
        eloValue.textContent = current.elo || '—';
    } else {
        rankIcon.style.display = 'none';
        rankName.textContent = 'Unranked';
        rankRR.textContent = '— RR';
        eloValue.textContent = '—';
    }

    // Peak Rank
    if (mmr && mmr.highest_rank) {
        peakRankValue.textContent = mmr.highest_rank.patched_tier || '—';
        peakRankIcon.style.display = 'none'; // No icon URL for peak in v2
    } else {
        peakRankValue.textContent = '—';
        peakRankIcon.style.display = 'none';
    }

    // Wins (from by_season data)
    if (mmr && mmr.by_season) {
        let totalWins = 0;
        Object.values(mmr.by_season).forEach(season => {
            if (season && season.wins) totalWins += season.wins;
        });
        winsValue.textContent = totalWins || '—';
    } else {
        winsValue.textContent = '—';
    }

    // Region
    regionValue.textContent = region.toUpperCase();

    // Matches
    renderMatches(matches, account);
}

function renderMatches(matches, account) {
    matchList.innerHTML = '';

    if (!matches || matches.length === 0) {
        matchList.innerHTML = '<div class="no-matches">NO RECENT MATCHES FOUND</div>';
        return;
    }

    matches.forEach(match => {
        const meta = match.metadata;
        const allPlayers = match.players?.all_players || [];
        const teams = match.teams;

        // Find the current player in the match
        const player = allPlayers.find(p =>
            p.name?.toLowerCase() === account.name?.toLowerCase() &&
            p.tag?.toLowerCase() === account.tag?.toLowerCase()
        ) || allPlayers.find(p => p.puuid === account.puuid);

        if (!player) return;

        const playerTeam = player.team?.toLowerCase();
        const teamData = teams?.[playerTeam === 'red' ? 'red' : 'blue'];
        const enemyData = teams?.[playerTeam === 'red' ? 'blue' : 'red'];

        // Determine win/loss/draw
        let result = 'draw';
        let resultText = 'DRAW';
        if (teamData && enemyData) {
            if (teamData.has_won) {
                result = 'win';
                resultText = 'WIN';
            } else if (enemyData.has_won) {
                result = 'loss';
                resultText = 'LOSS';
            }
        }

        // Score
        const teamScore = teamData?.rounds_won ?? '—';
        const enemyScore = enemyData?.rounds_won ?? '—';

        // KDA
        const stats = player.stats || {};
        const kills = stats.kills || 0;
        const deaths = stats.deaths || 0;
        const assists = stats.assists || 0;
        const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
        const kdClass = kd >= 1.0 ? 'positive' : kd < 1.0 ? 'negative' : 'neutral';

        // Time ago
        const timeAgo = getTimeAgo(meta.game_start * 1000);

        // Agent icon
        const agentIcon = player.assets?.agent?.small || '';
        const agentName = player.character || '—';

        const matchEl = document.createElement('div');
        matchEl.className = `match-item ${result}`;
        matchEl.innerHTML = `
            <div class="match-result">${resultText}</div>
            <div class="match-map">
                <div class="match-map-name">${meta.map || '—'}</div>
                <div class="match-mode">${meta.mode || '—'}</div>
            </div>
            <div class="match-agent">
                ${agentIcon ? `<img class="match-agent-icon" src="${agentIcon}" alt="${agentName}">` : ''}
                <span class="match-agent-name">${agentName}</span>
            </div>
            <div class="match-score">${teamScore} — ${enemyScore}</div>
            <div class="match-kda">
                <div class="match-kda-value">${kills} / ${deaths} / ${assists}</div>
                <div class="match-kda-label">K / D / A</div>
            </div>
            <div class="match-kd ${kdClass}">${kd} KD</div>
            <div class="match-time">${timeAgo}</div>
        `;

        matchList.appendChild(matchEl);
    });
}

// ---- Utilities ----
function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

function showError(message) {
    searchError.textContent = message;
    searchError.classList.remove('hidden');
}

function hideError() {
    searchError.classList.add('hidden');
}

// ---- Recent Searches ----
function loadRecentSearches() {
    const saved = JSON.parse(localStorage.getItem('revenant_recent') || '[]');
    if (saved.length === 0) return;

    recentSearches.classList.remove('hidden');
    recentList.innerHTML = '';

    saved.slice(0, 5).forEach(item => {
        const el = document.createElement('div');
        el.className = 'recent-item';
        el.textContent = `${item.id} (${item.region.toUpperCase()})`;
        el.addEventListener('click', () => {
            riotIdInput.value = item.id;
            regionSelect.value = item.region;
            handleSearch();
        });
        recentList.appendChild(el);
    });
}

function saveRecentSearch(id, region) {
    let saved = JSON.parse(localStorage.getItem('revenant_recent') || '[]');

    // Remove duplicates
    saved = saved.filter(item => !(item.id === id && item.region === region));

    // Add to front
    saved.unshift({ id, region });

    // Keep max 5
    saved = saved.slice(0, 5);

    localStorage.setItem('revenant_recent', JSON.stringify(saved));
    loadRecentSearches();
}

// ---- API Key Reset (Ctrl+Shift+K) ----
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        localStorage.removeItem('revenant_api_key');
        apiKey = '';
        promptApiKey();
    }
});

// ---- Boot ----
document.addEventListener('DOMContentLoaded', init);
