const DATA_URL = "data/worldcup-2026.json";
const STORAGE_KEY = "kipi-m2026-state-v1";
const ACCOUNT_STORAGE_KEY = "kipi-m2026-accounts-v1";
const APP_VIEWS = new Set(["dashboard", "matches", "groups", "account", "predictions", "ranking", "data-tools"]);

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
  registerForm: $("#register-form"),
  showLogin: $("#show-login"),
  showRegister: $("#show-register"),
  loginEmail: $("#login-email"),
  loginPassword: $("#login-password"),
  loginStatus: $("#login-status"),
  registerFirstName: $("#register-first-name"),
  registerLastName: $("#register-last-name"),
  registerEmail: $("#register-email"),
  registerNickname: $("#register-nickname"),
  registerPassword: $("#register-password"),
  registerStatus: $("#register-status"),
  verificationBox: $("#verification-box"),
  verificationLink: $("#verification-link"),
  userSession: $("#user-session"),
  sessionEmail: $("#session-email"),
  logoutButton: $("#logout-button"),
  themeToggle: $("#theme-toggle"),
  headerThemeToggle: $("#header-theme-toggle"),
  settingsForm: $("#settings-form"),
  settingsNickname: $("#settings-nickname"),
  settingsTeam: $("#settings-team"),
  settingsAccent: $("#settings-accent"),
  settingsCompact: $("#settings-compact"),
  settingsStatus: $("#settings-status"),
  accountDisplayName: $("#account-display-name"),
  accountMeta: $("#account-meta"),
  accountScore: $("#account-score"),
  accountRank: $("#account-rank"),
  accountTyped: $("#account-typed"),
  accountExact: $("#account-exact"),
  adminPanel: $("#admin-panel"),
  adminAddForm: $("#admin-add-form"),
  adminFirstName: $("#admin-first-name"),
  adminLastName: $("#admin-last-name"),
  adminEmail: $("#admin-email"),
  adminNickname: $("#admin-nickname"),
  adminPassword: $("#admin-password"),
  adminRole: $("#admin-role"),
  adminVerified: $("#admin-verified"),
  adminStatus: $("#admin-status"),
  adminUsersBody: $("#admin-users-body"),
  viewPanes: $$(".view-pane"),
  viewLinks: $$(".brand, .main-nav a, .hero-controls a"),
};

let data;
let state;
let accounts = [];

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

function loadAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveAccounts() {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
}

function viewFromHash() {
  const hash = window.location.hash.replace("#", "");
  return APP_VIEWS.has(hash) ? hash : "dashboard";
}

function showView(view = viewFromHash(), updateUrl = false, shouldScroll = true) {
  const nextView = APP_VIEWS.has(view) ? view : "dashboard";
  els.viewPanes.forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.view === nextView);
  });
  els.viewLinks.forEach((link) => {
    const linkView = (link.getAttribute("href") || "").replace("#", "");
    link.classList.toggle("is-active", linkView === nextView);
  });
  if (updateUrl && window.location.hash !== `#${nextView}`) {
    history.pushState(null, "", `#${nextView}`);
  }
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt = randomToken()) {
  return {
    salt,
    hash: await sha256(`${salt}:${password}`),
  };
}

function displayNameForAccount(account) {
  const nickname = String(account.nickname || "").trim();
  if (nickname) return nickname;
  return `${account.firstName || ""} ${account.lastName || ""}`.trim() || "Użytkownik";
}

function accountByEmail(email) {
  return accounts.find((account) => account.email === normalizeEmail(email));
}

function accountById(id) {
  return accounts.find((account) => account.id === id);
}

function accountRole(account) {
  return account?.role === "admin" ? "admin" : "client";
}

function isAdmin(account = accountById(state.user?.accountId)) {
  return accountRole(account) === "admin";
}

function adminAccounts() {
  return accounts.filter((account) => accountRole(account) === "admin");
}

function ensureAdminBootstrap() {
  let changed = false;
  accounts.forEach((account) => {
    if (!account.role) {
      account.role = "client";
      changed = true;
    }
    if (!account.preferences) {
      account.preferences = {
        theme: "dark",
        accent: "#f1861d",
        compact: false,
        favoriteTeam: "",
      };
      changed = true;
    } else if (!account.preferences.theme) {
      account.preferences.theme = "dark";
      changed = true;
    }
  });
  if (adminAccounts().length) {
    if (changed) saveAccounts();
    return;
  }
  const current = state.user?.accountId ? accountById(state.user.accountId) : null;
  const candidate = current || accounts.find((account) => account.verified) || accounts[0];
  if (candidate) {
    candidate.role = "admin";
    changed = true;
  }
  if (changed) saveAccounts();
}

function ensurePlayer(name) {
  if (!state.players.includes(name)) {
    state.players.push(name);
  }
  state.activePlayer = name;
}

function migratePlayerName(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  const index = state.players.indexOf(oldName);
  if (index >= 0 && !state.players.includes(newName)) {
    state.players[index] = newName;
  } else if (!state.players.includes(newName)) {
    state.players.push(newName);
  }
  if (state.predictions[oldName] && !state.predictions[newName]) {
    state.predictions[newName] = state.predictions[oldName];
    delete state.predictions[oldName];
  }
  if (state.activePlayer === oldName) state.activePlayer = newName;
}

function activateAccount(account) {
  const player = displayNameForAccount(account);
  ensurePlayer(player);
  state.user = {
    accountId: account.id,
    email: account.email,
    player,
    loggedInAt: new Date().toISOString(),
  };
  saveState();
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  els.registerForm.classList.toggle("is-hidden", !isRegister);
  els.loginForm.classList.toggle("is-hidden", isRegister);
  els.showRegister.classList.toggle("is-active", isRegister);
  els.showLogin.classList.toggle("is-active", !isRegister);
  els.loginStatus.textContent = "";
  els.registerStatus.textContent = "";
  els.verificationBox.classList.add("is-hidden");
}

function verificationUrl(token) {
  const url = new URL(window.location.href);
  url.searchParams.set("verify", token);
  url.hash = "";
  return url.toString();
}

function showVerificationLink(account) {
  const url = verificationUrl(account.verificationToken);
  els.verificationLink.href = url;
  els.verificationLink.textContent = url;
  els.verificationBox.classList.remove("is-hidden");
}

function validateRegistration(form) {
  if (!form.firstName || !form.lastName) return "Podaj imię i nazwisko.";
  if (!isEmailAddress(form.email)) return "Podaj poprawny adres e-mail.";
  if (form.password.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  return "";
}

async function registerAccount() {
  const form = {
    firstName: els.registerFirstName.value.trim(),
    lastName: els.registerLastName.value.trim(),
    email: normalizeEmail(els.registerEmail.value),
    nickname: els.registerNickname.value.trim(),
    password: els.registerPassword.value,
  };
  const error = validateRegistration(form);
  if (error) {
    els.registerStatus.textContent = error;
    return;
  }

  let account = accountByEmail(form.email);
  if (account?.verified) {
    els.registerStatus.textContent = "Konto z tym adresem już istnieje. Zaloguj się.";
    setAuthMode("login");
    return;
  }

  const password = await hashPassword(form.password, account?.passwordSalt);
  if (!account) {
    account = {
      id: randomToken(),
      email: form.email,
      createdAt: new Date().toISOString(),
      preferences: {
        theme: "dark",
        accent: "#f1861d",
        compact: false,
        favoriteTeam: "",
      },
      role: accounts.some((item) => accountRole(item) === "admin") ? "client" : "admin",
    };
    accounts.push(account);
  }
  Object.assign(account, {
    firstName: form.firstName,
    lastName: form.lastName,
    nickname: form.nickname,
    passwordSalt: password.salt,
    passwordHash: password.hash,
    verified: false,
    verificationToken: randomToken(),
    pendingSince: new Date().toISOString(),
  });
  saveAccounts();
  showVerificationLink(account);
  els.registerPassword.value = "";
  els.registerStatus.textContent =
    "Wysłano link potwierdzający. W statycznym demo link jest widoczny powyżej; produkcyjnie wyśle go backend.";
}

async function loginWithCredentials() {
  const email = normalizeEmail(els.loginEmail.value);
  const account = accountByEmail(email);
  if (!account) {
    els.loginStatus.textContent = "Nie znaleziono konta dla tego adresu.";
    return;
  }
  if (!account.verified) {
    setAuthMode("register");
    showVerificationLink(account);
    els.registerStatus.textContent = "Najpierw potwierdź adres e-mail.";
    return;
  }
  const passwordCheck = await hashPassword(els.loginPassword.value, account.passwordSalt);
  if (passwordCheck.hash !== account.passwordHash) {
    els.loginStatus.textContent = "Nieprawidłowy e-mail lub hasło.";
    return;
  }
  activateAccount(account);
  els.loginPassword.value = "";
  els.loginStatus.textContent = "";
  renderAll();
}

function verifyAccountFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("verify");
  if (!token) return false;
  const account = accounts.find((item) => item.verificationToken === token);
  if (!account) {
    els.loginStatus.textContent = "Link potwierdzający jest nieprawidłowy albo wygasł.";
    url.searchParams.delete("verify");
    history.replaceState({}, "", url);
    return false;
  }
  account.verified = true;
  account.verifiedAt = new Date().toISOString();
  account.verificationToken = "";
  saveAccounts();
  activateAccount(account);
  url.searchParams.delete("verify");
  history.replaceState({}, "", url);
  return true;
}

function applyAccountPreferences() {
  const account = state.user?.accountId ? accountById(state.user.accountId) : null;
  const preferences = account?.preferences || {};
  const theme = preferences.theme === "light" ? "light" : "dark";
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("compact-view", Boolean(preferences.compact));
  document.documentElement.style.setProperty("--orange", preferences.accent || "#f1861d");
  const themeLabel = theme === "dark" ? "Tryb jasny" : "Tryb ciemny";
  if (els.themeToggle) els.themeToggle.textContent = themeLabel;
  if (els.headerThemeToggle) els.headerThemeToggle.textContent = themeLabel;
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
    const account = accountById(state.user.accountId);
    const label = account ? displayNameForAccount(account) : state.user.player;
    els.sessionEmail.textContent = `${label} · ${isAdmin(account) ? "administrator" : "klient"}`;
  }
  applyAccountPreferences();
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
  const admin = isAdmin();
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
  if (admin) {
    card.append(createScoreInputs("result", match, result));
  }
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
  const admin = isAdmin();
  const myPlayer = state.user?.player;
  const players = admin
    ? state.players
    : myPlayer && state.players.includes(myPlayer)
      ? [myPlayer]
      : state.players;
  const active = state.activePlayer;

  els.activePlayer.innerHTML = players.map((p) => `<option value="${p}">${p}</option>`).join("");
  els.activePlayer.value = players.includes(active) ? active : players[0];

  if (!admin && myPlayer && state.activePlayer !== myPlayer && state.players.includes(myPlayer)) {
    state.activePlayer = myPlayer;
    saveState();
  }

  els.newPlayer.classList.toggle("is-hidden", !admin);
  els.addPlayer.classList.toggle("is-hidden", !admin);
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

function renderAccountPanel() {
  const account = state.user?.accountId ? accountById(state.user.accountId) : null;
  if (!account) return;
  const rows = ranking();
  const index = rows.findIndex((row) => row.player === state.activePlayer);
  const mine = rows[index] || { total: 0, typed: 0, exact: 0 };
  els.accountDisplayName.textContent = displayNameForAccount(account);
  els.accountMeta.textContent = `${account.firstName} ${account.lastName} · ${account.email} · ${isAdmin(account) ? "administrator" : "klient"}`;
  els.accountScore.textContent = mine.total;
  els.accountRank.textContent = `Pozycja w rankingu: ${index >= 0 ? index + 1 : "-"}`;
  els.accountTyped.textContent = mine.typed;
  els.accountExact.textContent = `Dokładne trafienia: ${mine.exact}`;
  els.settingsNickname.value = account.nickname || "";
  els.settingsTeam.value = account.preferences?.favoriteTeam || "";
  els.settingsAccent.value = account.preferences?.accent || "#f1861d";
  els.settingsCompact.checked = Boolean(account.preferences?.compact);
}

function renderAdminPanel() {
  const current = state.user?.accountId ? accountById(state.user.accountId) : null;
  const canAdmin = isAdmin(current);
  els.adminPanel.classList.toggle("is-hidden", !canAdmin);
  if (!canAdmin) {
    els.adminUsersBody.replaceChildren();
    return;
  }

  const rows = accounts
    .slice()
    .sort((a, b) => displayNameForAccount(a).localeCompare(displayNameForAccount(b), "pl"))
    .map((account) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const emailCell = document.createElement("td");
      const roleCell = document.createElement("td");
      const statusCell = document.createElement("td");
      const actionsCell = document.createElement("td");
      const roleSelect = document.createElement("select");
      const statusSelect = document.createElement("select");
      const deleteButton = document.createElement("button");

      nameCell.textContent = displayNameForAccount(account);
      emailCell.textContent = account.email;
      roleSelect.dataset.accountId = account.id;
      roleSelect.dataset.action = "role";
      roleSelect.innerHTML = '<option value="client">Klient</option><option value="admin">Administrator</option>';
      roleSelect.value = accountRole(account);
      statusSelect.dataset.accountId = account.id;
      statusSelect.dataset.action = "status";
      statusSelect.innerHTML = '<option value="verified">Potwierdzone</option><option value="pending">Oczekuje</option>';
      statusSelect.value = account.verified ? "verified" : "pending";
      deleteButton.className = "button button-danger button-small";
      deleteButton.type = "button";
      deleteButton.dataset.accountId = account.id;
      deleteButton.dataset.action = "delete";
      deleteButton.textContent = "Usuń";
      if (account.id === current.id) deleteButton.disabled = true;

      roleCell.append(roleSelect);
      statusCell.append(statusSelect);
      actionsCell.className = "admin-actions";
      actionsCell.append(deleteButton);
      row.append(nameCell, emailCell, roleCell, statusCell, actionsCell);
      return row;
    });

  els.adminUsersBody.replaceChildren(...rows);
}

function removePlayerForAccount(account) {
  const player = displayNameForAccount(account);
  state.players = state.players.filter((name) => name !== player);
  if (state.predictions[player]) delete state.predictions[player];
  if (state.activePlayer === player) {
    state.activePlayer = state.players[0] || "";
  }
}

function updateAccountRole(account, role) {
  if (!account) return;
  if (accountRole(account) === "admin" && role !== "admin" && adminAccounts().length <= 1) {
    flashStatus(els.adminStatus, "Nie można odebrać roli ostatniemu administratorowi.", true);
    renderAdminPanel();
    return;
  }
  account.role = role === "admin" ? "admin" : "client";
  saveAccounts();
  flashStatus(els.adminStatus, "Zmieniono rolę użytkownika.");
  renderAll();
}

function updateAccountStatus(account, status) {
  if (!account) return;
  account.verified = status === "verified";
  if (account.verified) {
    account.verifiedAt ||= new Date().toISOString();
    account.verificationToken = "";
  } else {
    account.verificationToken ||= randomToken();
  }
  saveAccounts();
  flashStatus(els.adminStatus, "Zmieniono status konta.");
  renderAll();
}

function deleteAccount(account) {
  const currentId = state.user?.accountId;
  if (!account || account.id === currentId) return;
  if (accountRole(account) === "admin" && adminAccounts().length <= 1) {
    flashStatus(els.adminStatus, "Nie można usunąć ostatniego administratora.", true);
    return;
  }
  const ok = window.confirm(`Usunąć użytkownika ${displayNameForAccount(account)}?`);
  if (!ok) return;
  removePlayerForAccount(account);
  accounts = accounts.filter((item) => item.id !== account.id);
  saveAccounts();
  saveState();
  flashStatus(els.adminStatus, "Usunięto użytkownika.");
  renderAll();
}

async function addAccountFromAdmin() {
  if (!isAdmin()) return;
  const form = {
    firstName: els.adminFirstName.value.trim(),
    lastName: els.adminLastName.value.trim(),
    email: normalizeEmail(els.adminEmail.value),
    nickname: els.adminNickname.value.trim(),
    password: els.adminPassword.value,
    role: els.adminRole.value === "admin" ? "admin" : "client",
    verified: els.adminVerified.checked,
  };
  const error = validateRegistration(form);
  if (error) {
    flashStatus(els.adminStatus, error, true);
    return;
  }
  if (accountByEmail(form.email)) {
    flashStatus(els.adminStatus, "Konto z tym adresem już istnieje.", true);
    return;
  }
  const password = await hashPassword(form.password);
  const account = {
    id: randomToken(),
    email: form.email,
    firstName: form.firstName,
    lastName: form.lastName,
    nickname: form.nickname,
    passwordSalt: password.salt,
    passwordHash: password.hash,
    verified: form.verified,
    verifiedAt: form.verified ? new Date().toISOString() : "",
    verificationToken: form.verified ? "" : randomToken(),
    role: form.role,
    createdAt: new Date().toISOString(),
    preferences: {
      theme: "dark",
      accent: "#f1861d",
      compact: false,
      favoriteTeam: "",
    },
  };
  accounts.push(account);
  ensurePlayer(displayNameForAccount(account));
  state.activePlayer = state.user?.player || displayNameForAccount(account);
  saveAccounts();
  saveState();
  els.adminAddForm.reset();
  els.adminVerified.checked = true;
  flashStatus(els.adminStatus, "Dodano użytkownika.");
  renderAll();
}

let _statusTimer = null;
function flashStatus(el, message, isError = false) {
  if (_statusTimer) clearTimeout(_statusTimer);
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--green)";
  _statusTimer = setTimeout(() => { el.textContent = ""; }, 4000);
}

function saveAccountSettings() {
  const account = state.user?.accountId ? accountById(state.user.accountId) : null;
  if (!account) return;
  const oldPlayer = displayNameForAccount(account);
  account.nickname = els.settingsNickname.value.trim();
  account.preferences ||= {};
  account.preferences.favoriteTeam = els.settingsTeam.value.trim();
  account.preferences.accent = els.settingsAccent.value || "#f1861d";
  account.preferences.compact = els.settingsCompact.checked;
  const newPlayer = displayNameForAccount(account);
  migratePlayerName(oldPlayer, newPlayer);
  state.user.player = newPlayer;
  saveAccounts();
  saveState();
  flashStatus(els.settingsStatus, "Zapisano.");
  renderAll();
}

function toggleTheme() {
  const account = state.user?.accountId ? accountById(state.user.accountId) : null;
  if (!account) return;
  account.preferences ||= {};
  account.preferences.theme = account.preferences.theme === "dark" ? "light" : "dark";
  saveAccounts();
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderFilters();
  renderMatches();
  renderGroups();
  renderPlayers();
  renderPredictions();
  renderRanking();
  renderAccountPanel();
  renderAdminPanel();
  renderAuth();
  showView(viewFromHash(), false, false);
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
  els.showLogin.addEventListener("click", () => setAuthMode("login"));
  els.showRegister.addEventListener("click", () => setAuthMode("register"));
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loginWithCredentials();
  });
  els.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await registerAccount();
  });
  els.logoutButton.addEventListener("click", logout);
  els.themeToggle.addEventListener("click", toggleTheme);
  if (els.headerThemeToggle) els.headerThemeToggle.addEventListener("click", toggleTheme);
  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAccountSettings();
  });
  els.adminAddForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addAccountFromAdmin();
  });
  els.adminUsersBody.addEventListener("change", (event) => {
    const target = event.target;
    const account = accountById(target.dataset.accountId);
    if (target.dataset.action === "role") updateAccountRole(account, target.value);
    if (target.dataset.action === "status") updateAccountStatus(account, target.value);
  });
  els.adminUsersBody.addEventListener("click", (event) => {
    const target = event.target;
    if (target.dataset.action !== "delete") return;
    deleteAccount(accountById(target.dataset.accountId));
  });
  els.viewLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const view = (link.getAttribute("href") || "").replace("#", "");
      if (!APP_VIEWS.has(view)) return;
      event.preventDefault();
      showView(view, true, true);
    });
  });
  window.addEventListener("hashchange", () => showView(viewFromHash(), false, true));
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
  accounts = loadAccounts();
  ensureAdminBootstrap();
  if (state.user?.email && !state.user.accountId) {
    state.user = null;
    saveState();
  }
  bindEvents();
  verifyAccountFromUrl();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app-section"><h1>Błąd danych</h1><p>${error.message}</p></main>`;
});
