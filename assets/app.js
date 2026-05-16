const DATA_URL = "data/worldcup-2026.json";
const STORAGE_KEY = "kipi-m2026-state-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  nextTeams: $("#next-match-teams"),
  nextMeta: $("#next-match-meta"),
  metricMatches: $("#metric-matches"),
  metricPlayers: $("#metric-players"),
  metricLeader: $("#metric-leader"),
  metricScoring: $("#metric-scoring"),
  matchList: $("#match-list"),
  groupGrid: $("#group-grid"),
  rankingBody: $("#ranking-body"),
  predictionList: $("#prediction-list"),
  predictionSummary: $("#prediction-summary"),
  activePlayer: $("#active-player"),
  newPlayer: $("#new-player"),
  addPlayer: $("#add-player"),
  search: $("#match-search"),
  stageFilter: $("#stage-filter"),
  groupFilter: $("#group-filter"),
  exportState: $("#export-state"),
  importState: $("#import-state"),
  resetState: $("#reset-state"),
  importBox: $("#state-import"),
  dataStatus: $("#data-status"),
  generatedFrom: $("#generated-from"),
  loginForm: $("#login-form"),
  loginEmail: $("#login-email"),
  loginStatus: $("#login-status"),
  userSession: $("#user-session"),
  sessionEmail: $("#session-email"),
  logoutButton: $("#logout-button"),
};

let data;
let state;

function cleanPlayers(players = []) {
  return [...new Set(players.map((name) => String(name || "").trim()).filter(Boolean))]
    .filter((name) => name.toLowerCase() !== "nazwa");
}

function createInitialState(source) {
  const players = cleanPlayers(source.defaultPlayers);
  const fallback = players.length ? players : ["Anna", "Lewy", "Peter"];
  return {
    players: fallback,
    activePlayer: fallback[0],
    user: null,
    results: {},
    predictions: {},
    updatedAt: new Date().toISOString(),
  };
}

function loadState(source) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return createInitialState(source);
    const players = cleanPlayers(saved.players);
    const next = {
      ...createInitialState(source),
      ...saved,
      players: players.length ? players : cleanPlayers(source.defaultPlayers),
      user: saved.user && typeof saved.user === "object" ? saved.user : null,
      results: saved.results && typeof saved.results === "object" ? saved.results : {},
      predictions: saved.predictions && typeof saved.predictions === "object" ? saved.predictions : {},
    };
    if (!next.players.includes(next.activePlayer)) next.activePlayer = next.players[0];
    return next;
  } catch {
    return createInitialState(source);
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isGmailAddress(email) {
  return /^[^\s@]+@(gmail\.com|googlemail\.com)$/.test(email);
}

function playerNameFromEmail(email) {
  const localPart = email.split("@")[0].replace(/\+.*/, "");
  const words = localPart.split(/[._-]+/).filter(Boolean);
  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return name || email;
}

function ensurePlayer(name) {
  if (!state.players.includes(name)) {
    state.players.push(name);
  }
  state.activePlayer = name;
}

function loginWithEmail(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!isGmailAddress(email)) {
    els.loginStatus.textContent = "Podaj adres w domenie gmail.com.";
    return;
  }
  const player = playerNameFromEmail(email);
  ensurePlayer(player);
  state.user = {
    email,
    player,
    provider: "gmail",
    loggedInAt: new Date().toISOString(),
  };
  saveState();
  els.loginEmail.value = "";
  els.loginStatus.textContent = "";
  renderAll();
  renderAuth();
}

function logout() {
  state.user = null;
  saveState();
  renderAuth();
}

function renderAuth() {
  const isLoggedIn = Boolean(state.user?.email);
  document.body.classList.toggle("is-authenticated", isLoggedIn);
  document.body.classList.toggle("login-pending", !isLoggedIn);
  els.userSession.hidden = !isLoggedIn;
  if (isLoggedIn) {
    els.sessionEmail.textContent = state.user.email;
  }
}

function formatDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatLongDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function scoreValue(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function readPair(home, away) {
  const h = scoreValue(home);
  const a = scoreValue(away);
  return h === null || a === null ? null : { home: h, away: a };
}

function isComplete(pair) {
  return pair && Number.isInteger(pair.home) && Number.isInteger(pair.away);
}

function getResult(matchId) {
  const result = state.results[String(matchId)];
  return isComplete(result) ? result : null;
}

function getPrediction(player, matchId) {
  const prediction = state.predictions[player]?.[String(matchId)];
  return isComplete(prediction) ? prediction : null;
}

function setResult(matchId, pair) {
  if (!pair) delete state.results[String(matchId)];
  else state.results[String(matchId)] = pair;
  saveState();
  renderAll();
}

function setPrediction(player, matchId, pair) {
  state.predictions[player] ||= {};
  if (!pair) delete state.predictions[player][String(matchId)];
  else state.predictions[player][String(matchId)] = pair;
  saveState();
  renderAll();
}

function outcome(pair) {
  if (!pair) return null;
  if (pair.home > pair.away) return "H";
  if (pair.home < pair.away) return "A";
  return "D";
}

function scorePrediction(prediction, actual) {
  if (!isComplete(prediction) || !isComplete(actual)) {
    return { total: 0, exact: false, sign: false };
  }
  const rules = data.scoring;
  const exact = prediction.home === actual.home && prediction.away === actual.away;
  const sign = outcome(prediction) === outcome(actual);
  const goalDifference = prediction.home - prediction.away === actual.home - actual.away;
  const manyGoals = prediction.home + prediction.away >= 8 && actual.home + actual.away >= 8;
  let total = 0;
  if (sign) total += rules.outcome || 0;
  if (goalDifference) total += rules.goalDifference || 0;
  if (exact) total += rules.exactGoals || 0;
  if (manyGoals) total += rules.manyGoals || 0;
  return { total, exact, sign };
}

function ranking() {
  return state.players
    .map((player) => {
      let total = 0;
      let exact = 0;
      let signs = 0;
      let typed = 0;
      data.matches.forEach((match) => {
        const actual = getResult(match.id);
        const prediction = getPrediction(player, match.id);
        if (prediction) typed += 1;
        const score = scorePrediction(prediction, actual);
        total += score.total;
        if (score.exact) exact += 1;
        if (score.sign) signs += 1;
      });
      return { player, total, exact, signs, typed };
    })
    .sort((a, b) => b.total - a.total || b.exact - a.exact || b.signs - a.signs || a.player.localeCompare(b.player));
}

function groupStandings(groupCode) {
  const teams = data.groups[groupCode] || [];
  const table = new Map(
    teams.map((team) => [
      team.name,
      { team: team.name, slot: team.slot, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 },
    ]),
  );
  data.matches
    .filter((match) => match.stage === "Faza grupowa" && match.group === groupCode)
    .forEach((match) => {
      const result = getResult(match.id);
      if (!result || !table.has(match.homeTeam) || !table.has(match.awayTeam)) return;
      const home = table.get(match.homeTeam);
      const away = table.get(match.awayTeam);
      home.played += 1;
      away.played += 1;
      home.gf += result.home;
      home.ga += result.away;
      away.gf += result.away;
      away.ga += result.home;
      if (result.home > result.away) {
        home.wins += 1;
        away.losses += 1;
        home.pts += 3;
      } else if (result.home < result.away) {
        away.wins += 1;
        home.losses += 1;
        away.pts += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.pts += 1;
        away.pts += 1;
      }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });

  return [...table.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
}

function matchStatus(match) {
  const result = getResult(match.id);
  if (result) return `${result.home}:${result.away}`;
  return "Do rozegrania";
}

function filteredMatches() {
  const query = els.search.value.trim().toLowerCase();
  const stage = els.stageFilter.value;
  const group = els.groupFilter.value;
  return data.matches.filter((match) => {
    const haystack = `${match.homeTeam} ${match.awayTeam} ${match.venue} ${match.stage}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!stage || match.stage === stage) && (!group || match.group === group);
  });
}

function createScoreInputs(kind, match, pair, player = "") {
  const wrap = document.createElement("div");
  wrap.className = "score-inputs";
  const home = document.createElement("input");
  const away = document.createElement("input");
  const sep = document.createElement("span");
  home.type = "text";
  away.type = "text";
  home.pattern = "[0-9]*";
  away.pattern = "[0-9]*";
  home.inputMode = "numeric";
  away.inputMode = "numeric";
  home.value = pair?.home ?? "";
  away.value = pair?.away ?? "";
  home.ariaLabel = `${match.homeTeam} gole`;
  away.ariaLabel = `${match.awayTeam} gole`;
  sep.textContent = ":";
  const onChange = () => {
    const homeRaw = home.value.trim();
    const awayRaw = away.value.trim();
    if (!homeRaw && !awayRaw) {
      if (kind === "result") setResult(match.id, null);
      if (kind === "prediction") setPrediction(player, match.id, null);
      return;
    }
    const nextPair = readPair(homeRaw, awayRaw);
    if (!nextPair) return;
    if (kind === "result") setResult(match.id, nextPair);
    if (kind === "prediction") setPrediction(player, match.id, nextPair);
  };
  home.addEventListener("input", onChange);
  away.addEventListener("input", onChange);
  home.addEventListener("change", onChange);
  away.addEventListener("change", onChange);
  wrap.append(home, sep, away);
  return wrap;
}

function matchCard(match) {
  const card = document.createElement("article");
  card.className = "match-card";
  const result = getResult(match.id);
  card.innerHTML = `
    <span class="match-no">${match.id}</span>
    <div class="teams">
      <strong>${match.homeTeam} - ${match.awayTeam}</strong>
      <div class="match-meta">${match.stage}${match.group ? ` · Grupa ${match.group}` : ""}</div>
    </div>
    <div class="match-meta">
      <div>${formatLongDate(match.polandTime)}</div>
      <div>${match.venue}</div>
      <span class="status-pill ${result ? "" : "empty"}">${matchStatus(match)}</span>
    </div>
  `;
  card.append(createScoreInputs("result", match, result));
  return card;
}

function predictionCard(match) {
  const player = state.activePlayer;
  const prediction = getPrediction(player, match.id);
  const actual = getResult(match.id);
  const score = scorePrediction(prediction, actual);
  const card = document.createElement("article");
  card.className = "prediction-card";
  card.innerHTML = `
    <span class="match-no">${match.id}</span>
    <div class="teams">
      <strong>${match.homeTeam} - ${match.awayTeam}</strong>
      <div class="match-meta">${formatDate(match.polandTime)} · ${match.venue}</div>
      <span class="status-pill ${actual ? "" : "empty"}">${actual ? `Wynik ${actual.home}:${actual.away}` : "Bez wyniku"}</span>
      ${actual && prediction ? `<span class="status-pill">${score.total} pkt</span>` : ""}
    </div>
  `;
  card.append(createScoreInputs("prediction", match, prediction, player));
  return card;
}

function renderDashboard() {
  const played = Object.values(state.results).filter(isComplete).length;
  const next = data.matches.find((match) => !getResult(match.id)) || data.matches[data.matches.length - 1];
  const rankingRows = ranking();
  els.nextTeams.textContent = next ? `${next.homeTeam} vs ${next.awayTeam}` : "Turniej zakończony";
  els.nextMeta.innerHTML = next
    ? `<span>${formatLongDate(next.polandTime)}</span><span>${next.stage}${next.group ? ` · Grupa ${next.group}` : ""}</span><span>${next.venue}</span>`
    : "";
  els.metricMatches.textContent = `${played} / ${data.matches.length}`;
  els.metricPlayers.textContent = state.players.length;
  els.metricLeader.textContent = rankingRows[0] ? `${rankingRows[0].player} · ${rankingRows[0].total}` : "-";
  els.metricScoring.textContent = `${data.scoring.outcome}/${data.scoring.goalDifference}/${data.scoring.exactGoals}`;
  els.generatedFrom.textContent = data.meta?.generatedAt ? `Dane z Excela: ${data.meta.generatedAt}` : "";
}

function renderFilters() {
  const stages = [...new Set(data.matches.map((match) => match.stage))];
  const currentStage = els.stageFilter.value;
  els.stageFilter.innerHTML = `<option value="">Wszystkie fazy</option>${stages
    .map((stage) => `<option value="${stage}">${stage}</option>`)
    .join("")}`;
  els.stageFilter.value = stages.includes(currentStage) ? currentStage : "";

  const groups = Object.keys(data.groups);
  const currentGroup = els.groupFilter.value;
  els.groupFilter.innerHTML = `<option value="">Wszystkie grupy</option>${groups
    .map((group) => `<option value="${group}">Grupa ${group}</option>`)
    .join("")}`;
  els.groupFilter.value = groups.includes(currentGroup) ? currentGroup : "";
}

function renderMatches() {
  const matches = filteredMatches();
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Brak meczów dla wybranego filtra.";
    els.matchList.replaceChildren(empty);
    return;
  }
  els.matchList.replaceChildren(...matches.map(matchCard));
}

function renderGroups() {
  const cards = Object.keys(data.groups).map((groupCode) => {
    const card = document.createElement("article");
    card.className = "group-card";
    const rows = groupStandings(groupCode)
      .map(
        (row) => `
          <tr>
            <td>${row.slot}</td>
            <td>${row.team}</td>
            <td>${row.played}</td>
            <td>${row.pts}</td>
            <td>${row.gd}</td>
            <td>${row.gf}:${row.ga}</td>
          </tr>
        `,
      )
      .join("");
    card.innerHTML = `
      <h3><span>Grupa ${groupCode}</span><span>${data.groups[groupCode].length}</span></h3>
      <table class="group-table">
        <thead>
          <tr><th>Kod</th><th>Drużyna</th><th>M</th><th>PKT</th><th>RB</th><th>Bramki</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    return card;
  });
  els.groupGrid.replaceChildren(...cards);
}

function renderPlayers() {
  const active = state.activePlayer;
  els.activePlayer.innerHTML = state.players.map((player) => `<option value="${player}">${player}</option>`).join("");
  els.activePlayer.value = state.players.includes(active) ? active : state.players[0];
}

function renderPredictions() {
  const player = state.activePlayer;
  const typed = Object.keys(state.predictions[player] || {}).length;
  const ranked = ranking().find((row) => row.player === player);
  els.predictionSummary.innerHTML = `
    <span>Aktywny typer</span>
    <strong>${player}</strong>
    <div>${ranked?.total ?? 0} pkt · ${typed} typów · ${ranked?.exact ?? 0} dokładnych</div>
  `;
  els.predictionList.replaceChildren(...data.matches.map(predictionCard));
}

function renderRanking() {
  els.rankingBody.innerHTML = ranking()
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.player}</td>
          <td>${row.total}</td>
          <td>${row.exact}</td>
          <td>${row.signs}</td>
          <td>${row.typed}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAll() {
  renderDashboard();
  renderFilters();
  renderMatches();
  renderGroups();
  renderPlayers();
  renderPredictions();
  renderRanking();
  renderAuth();
}

function addPlayer() {
  const name = els.newPlayer.value.trim();
  if (!name || state.players.includes(name)) return;
  state.players.push(name);
  state.activePlayer = name;
  els.newPlayer.value = "";
  saveState();
  renderAll();
}

function exportState() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "mundial-2026-typer-state.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importState() {
  try {
    const payload = JSON.parse(els.importBox.value);
    const imported = payload.state || payload;
    if (!imported.players || !Array.isArray(imported.players)) throw new Error("Brak listy typerów.");
    state = {
      ...createInitialState(data),
      ...imported,
      players: cleanPlayers(imported.players),
      user: imported.user || null,
      results: imported.results || {},
      predictions: imported.predictions || {},
    };
    if (!state.players.includes(state.activePlayer)) state.activePlayer = state.players[0];
    saveState();
    els.importBox.value = "";
    els.dataStatus.textContent = "Zaimportowano dane.";
    renderAll();
  } catch (error) {
    els.dataStatus.textContent = `Błąd importu: ${error.message}`;
  }
}

function resetState() {
  const ok = window.confirm("Wyczyścić lokalne wyniki, typy i typerów?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState(data);
  saveState();
  renderAll();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginWithEmail(els.loginEmail.value);
  });
  els.logoutButton.addEventListener("click", logout);
  els.search.addEventListener("input", renderMatches);
  els.stageFilter.addEventListener("change", renderMatches);
  els.groupFilter.addEventListener("change", renderMatches);
  els.activePlayer.addEventListener("change", () => {
    state.activePlayer = els.activePlayer.value;
    saveState();
    renderAll();
  });
  els.addPlayer.addEventListener("click", addPlayer);
  els.newPlayer.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addPlayer();
  });
  els.exportState.addEventListener("click", exportState);
  els.importState.addEventListener("click", importState);
  els.resetState.addEventListener("click", resetState);
}

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Nie można wczytać ${DATA_URL}`);
  data = await response.json();
  data.defaultPlayers = cleanPlayers(data.defaultPlayers);
  state = loadState(data);
  bindEvents();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app-section"><h1>Błąd danych</h1><p>${error.message}</p></main>`;
});
