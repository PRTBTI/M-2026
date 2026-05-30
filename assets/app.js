const DATA_URL = "data/worldcup-2026.json";
const STORAGE_KEY = "kipi-m2026-state-v1";
const ACCOUNT_STORAGE_KEY = "kipi-m2026-accounts-v1";
const APP_VIEWS = new Set(["dashboard", "matches", "groups", "account", "predictions", "ranking", "data-tools"]);
const ADMIN_ONLY_VIEWS = new Set(["data-tools"]);
const ONLINE_CONFIG = window.KIPI_ONLINE_CONFIG || {};

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
  phaseTabs: $("#phase-tabs"),
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
let activeStage = "";
let backend = {
  mode: "local",
  client: null,
  session: null,
  ready: false,
  error: "",
};

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

function wantsOnlineMode() {
  return ONLINE_CONFIG.mode === "supabase" && ONLINE_CONFIG.supabaseUrl && ONLINE_CONFIG.supabaseAnonKey;
}

function onlineEnabled() {
  return backend.mode === "supabase" && Boolean(backend.client);
}

function onlineAdminFunction() {
  return ONLINE_CONFIG.adminUsersFunction || "admin-users";
}

function mapProfile(row) {
  return {
    id: row.id,
    email: row.email || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    nickname: row.nickname || "",
    role: row.role === "admin" ? "admin" : "client",
    verified: Boolean(row.verified),
    verifiedAt: row.updated_at || row.created_at || "",
    createdAt: row.created_at || "",
    preferences: {
      theme: row.theme === "light" ? "light" : "dark",
      accent: row.accent || "#f1861d",
      compact: Boolean(row.compact),
      favoriteTeam: row.favorite_team || "",
    },
  };
}

function profilePayload(account) {
  return {
    first_name: account.firstName || "",
    last_name: account.lastName || "",
    nickname: account.nickname || "",
    favorite_team: account.preferences?.favoriteTeam || "",
    accent: account.preferences?.accent || "#f1861d",
    compact: Boolean(account.preferences?.compact),
    theme: account.preferences?.theme === "light" ? "light" : "dark",
  };
}

function profileForSession() {
  return backend.session?.user?.id ? accountById(backend.session.user.id) : null;
}

async function setupOnlineBackend() {
  if (!wantsOnlineMode()) return;
  try {
    const moduleUrl = ONLINE_CONFIG.supabaseModuleUrl || "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
    const { createClient } = await import(moduleUrl);
    backend.client = createClient(ONLINE_CONFIG.supabaseUrl, ONLINE_CONFIG.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      await backend.client.auth.exchangeCodeForSession(code);
      url.searchParams.delete("code");
      history.replaceState({}, "", url);
    }

    const { data: sessionData, error } = await backend.client.auth.getSession();
    if (error) throw error;
    backend.session = sessionData.session;
    backend.mode = "supabase";
    backend.ready = true;
    if (backend.session) {
      await loadOnlineSnapshot();
    } else {
      state = createInitialState(data);
      accounts = [];
      state.user = null;
    }
  } catch (error) {
    backend.error = error.message || String(error);
    backend.mode = "local";
    backend.client = null;
    console.warn("Tryb online nie został uruchomiony:", backend.error);
  }
}

async function loadOnlineSnapshot() {
  if (!onlineEnabled()) return;
  const [{ data: profiles, error: profilesError }, { data: resultRows, error: resultsError }, { data: predictionRows, error: predictionsError }] =
    await Promise.all([
      backend.client.from("profiles").select("*").order("created_at", { ascending: true }),
      backend.client.from("results").select("*"),
      backend.client.from("predictions").select("*"),
    ]);

  if (profilesError) throw profilesError;
  if (resultsError) throw resultsError;
  if (predictionsError) throw predictionsError;

  accounts = (profiles || []).map(mapProfile);
  const onlineState = createInitialState(data);
  const players = cleanPlayers(accounts.map(displayNameForAccount));
  onlineState.players = players.length ? players : onlineState.players;
  onlineState.results = {};
  (resultRows || []).forEach((row) => {
    onlineState.results[String(row.match_id)] = { home: row.home, away: row.away };
  });
  onlineState.predictions = {};
  (predictionRows || []).forEach((row) => {
    const account = accountById(row.user_id);
    if (!account) return;
    const player = displayNameForAccount(account);
    onlineState.predictions[player] ||= {};
    onlineState.predictions[player][String(row.match_id)] = { home: row.home, away: row.away };
  });

  const profile = profileForSession();
  if (profile) {
    const player = displayNameForAccount(profile);
    onlineState.user = {
      accountId: profile.id,
      email: profile.email,
      player,
      loggedInAt: new Date().toISOString(),
    };
    onlineState.activePlayer = player;
  }

  state = onlineState;
  saveState();
  saveAccounts();
}

async function reloadOnlineAndRender() {
  if (!onlineEnabled()) return;
  await loadOnlineSnapshot();
  renderAll();
}

async function persistOnlineResult(matchId, pair) {
  if (!onlineEnabled()) return;
  if (!pair) {
    const { error } = await backend.client.from("results").delete().eq("match_id", Number(matchId));
    if (error) throw error;
    return;
  }
  const { error } = await backend.client.from("results").upsert({
    match_id: Number(matchId),
    home: pair.home,
    away: pair.away,
    updated_by: backend.session?.user?.id || null,
  });
  if (error) throw error;
}

async function persistOnlinePrediction(player, matchId, pair) {
  if (!onlineEnabled()) return;
  const account = accounts.find((item) => displayNameForAccount(item) === player);
  if (!account) return;
  const query = backend.client.from("predictions").delete().eq("user_id", account.id).eq("match_id", Number(matchId));
  if (!pair) {
    const { error } = await query;
    if (error) throw error;
    return;
  }
  const { error } = await backend.client.from("predictions").upsert({
    user_id: account.id,
    match_id: Number(matchId),
    home: pair.home,
    away: pair.away,
  });
  if (error) throw error;
}

async function persistOnlineProfile(account) {
  if (!onlineEnabled() || !account?.id) return;
  const { error } = await backend.client.from("profiles").update(profilePayload(account)).eq("id", account.id);
  if (error) throw error;
}

async function invokeAdminUsers(action, payload = {}) {
  if (!onlineEnabled()) throw new Error("Tryb online nie jest aktywny.");
  const { data: response, error } = await backend.client.functions.invoke(onlineAdminFunction(), {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (response?.error) throw new Error(response.error);
  return response;
}

async function replaceOnlineTournamentState(nextState) {
  if (!onlineEnabled()) return;
  const resultRows = Object.entries(nextState.results || {})
    .filter(([, pair]) => isComplete(pair))
    .map(([matchId, pair]) => ({
      match_id: Number(matchId),
      home: pair.home,
      away: pair.away,
      updated_by: backend.session?.user?.id || null,
    }));
  const predictionRows = [];
  Object.entries(nextState.predictions || {}).forEach(([player, predictions]) => {
    const account = accounts.find((item) => displayNameForAccount(item) === player);
    if (!account) return;
    Object.entries(predictions || {}).forEach(([matchId, pair]) => {
      if (!isComplete(pair)) return;
      predictionRows.push({ user_id: account.id, match_id: Number(matchId), home: pair.home, away: pair.away });
    });
  });

  let result = await backend.client.from("results").delete().neq("match_id", -1);
  if (result.error) throw result.error;
  result = await backend.client.from("predictions").delete().neq("match_id", -1);
  if (result.error) throw result.error;
  if (resultRows.length) {
    result = await backend.client.from("results").upsert(resultRows);
    if (result.error) throw result.error;
  }
  if (predictionRows.length) {
    result = await backend.client.from("predictions").upsert(predictionRows);
    if (result.error) throw result.error;
  }
}

function canUseView(view) {
  return !ADMIN_ONLY_VIEWS.has(view) || isAdmin();
}

function viewFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (!APP_VIEWS.has(hash)) return "dashboard";
  return canUseView(hash) ? hash : "account";
}

function showView(view = viewFromHash(), updateUrl = false, shouldScroll = true) {
  const requestedView = APP_VIEWS.has(view) ? view : "dashboard";
  const nextView = canUseView(requestedView) ? requestedView : "account";
  els.viewPanes.forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.view === nextView);
  });
  els.viewLinks.forEach((link) => {
    const linkView = (link.getAttribute("href") || "").replace("#", "");
    link.classList.toggle("is-active", linkView === nextView);
  });
  if (window.location.hash !== `#${nextView}`) {
    const method = updateUrl ? "pushState" : "replaceState";
    history[method](null, "", `#${nextView}`);
  }
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
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

function currentAccount() {
  return state?.user?.accountId ? accountById(state.user.accountId) : null;
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

function ensurePlayerExists(name) {
  if (!state.players.includes(name)) {
    state.players.push(name);
  }
}

function ensurePlayer(name) {
  ensurePlayerExists(name);
  state.activePlayer = name;
}

function enforceAccountAccess() {
  const account = currentAccount();
  if (!account) return;
  const player = displayNameForAccount(account);
  let changed = false;
  if (!state.players.includes(player)) {
    state.players.push(player);
    changed = true;
  }
  if (!isAdmin(account) && state.activePlayer !== player) {
    state.activePlayer = player;
    state.user.player = player;
    changed = true;
  }
  if (changed) saveState();
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

  if (onlineEnabled()) {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error: signUpError } = await backend.client.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          nickname: form.nickname,
        },
      },
    });
    if (signUpError) {
      els.registerStatus.textContent = signUpError.message;
      return;
    }
    els.registerPassword.value = "";
    els.verificationBox.classList.add("is-hidden");
    els.registerStatus.textContent = "Wysłano wiadomość potwierdzającą. Sprawdź skrzynkę e-mail i kliknij link aktywacyjny.";
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
  if (onlineEnabled()) {
    const { error: loginError } = await backend.client.auth.signInWithPassword({
      email,
      password: els.loginPassword.value,
    });
    if (loginError) {
      els.loginStatus.textContent = loginError.message;
      return;
    }
    const { data: sessionData } = await backend.client.auth.getSession();
    backend.session = sessionData.session;
    await reloadOnlineAndRender();
    els.loginPassword.value = "";
    els.loginStatus.textContent = "";
    return;
  }

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
  if (onlineEnabled()) return false;
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

async function logout() {
  if (onlineEnabled()) {
    await backend.client.auth.signOut();
    backend.session = null;
  }
  state.user = null;
  saveState();
  renderAuth();
}

function renderAuth() {
  const isLoggedIn = Boolean(state.user?.email);
  const account = isLoggedIn ? currentAccount() : null;
  const canAdmin = isAdmin(account);
  document.body.classList.toggle("is-authenticated", isLoggedIn);
  document.body.classList.toggle("login-pending", !isLoggedIn);
  document.body.classList.toggle("is-admin-user", isLoggedIn && canAdmin);
  document.body.classList.toggle("is-client-user", isLoggedIn && !canAdmin);
  els.userSession.hidden = !isLoggedIn;
  if (isLoggedIn) {
    const label = account ? displayNameForAccount(account) : state.user.player;
    els.sessionEmail.textContent = `${label} · ${canAdmin ? "administrator" : "klient"}`;
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

function canEditResults() {
  return isAdmin();
}

function canEditPrediction(player) {
  const account = currentAccount();
  if (!account) return false;
  return isAdmin(account) || player === displayNameForAccount(account);
}

function setResult(matchId, pair) {
  if (!canEditResults()) return;
  if (!pair) delete state.results[String(matchId)];
  else state.results[String(matchId)] = pair;
  saveState();
  persistOnlineResult(matchId, pair).catch((error) => console.warn("Nie zapisano wyniku online:", error.message));
  renderAll();
}

function setPrediction(player, matchId, pair) {
  if (!canEditPrediction(player)) return;
  state.predictions[player] ||= {};
  if (!pair) delete state.predictions[player][String(matchId)];
  else state.predictions[player][String(matchId)] = pair;
  saveState();
  persistOnlinePrediction(player, matchId, pair).catch((error) => console.warn("Nie zapisano typu online:", error.message));
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

function setStageFilter(stage) {
  activeStage = stage;
  renderPhaseTabs();
  const showGroup = !activeStage || activeStage === "Faza grupowa";
  els.groupFilter.classList.toggle("is-hidden", !showGroup);
  if (!showGroup) els.groupFilter.value = "";
  renderMatches();
}

function renderPhaseTabs() {
  const pills = els.phaseTabs.querySelectorAll(".phase-pill");
  pills.forEach((pill) => {
    const active = pill.dataset.stage === activeStage;
    pill.classList.toggle("is-active", active);
    pill.setAttribute("aria-selected", active);
  });
}

function filteredMatches() {
  const query = els.search.value.trim().toLowerCase();
  const group = els.groupFilter.value;
  return data.matches.filter((match) => {
    const haystack = `${match.homeTeam} ${match.awayTeam} ${match.venue} ${match.stage}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!activeStage || match.stage === activeStage) && (!group || match.group === group);
  });
}

function createScoreInputs(kind, match, pair, player = "") {
  const wrap = document.createElement("div");
  wrap.className = "score-inputs";
  const editable = kind === "result" ? canEditResults() : canEditPrediction(player);
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
  home.disabled = !editable;
  away.disabled = !editable;
  if (!editable) {
    const message = kind === "result" ? "Wynik może wpisać administrator." : "Możesz edytować tylko własne typy.";
    home.title = message;
    away.title = message;
  }
  sep.textContent = ":";
  const onChange = () => {
    if (!editable) return;
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
  const pills = [{ stage: "", label: "Wszystkie" }, ...stages.map((s) => ({ stage: s, label: s }))];
  els.phaseTabs.innerHTML = pills
    .map(
      ({ stage, label }) =>
        `<button class="phase-pill${activeStage === stage ? " is-active" : ""}" data-stage="${stage}" type="button" role="tab" aria-selected="${activeStage === stage}">${label}</button>`,
    )
    .join("");

  const groups = Object.keys(data.groups);
  const currentGroup = els.groupFilter.value;
  els.groupFilter.innerHTML = `<option value="">Wszystkie grupy</option>${groups
    .map((group) => `<option value="${group}">Grupa ${group}</option>`)
    .join("")}`;
  els.groupFilter.value = groups.includes(currentGroup) ? currentGroup : "";
  const showGroup = !activeStage || activeStage === "Faza grupowa";
  els.groupFilter.classList.toggle("is-hidden", !showGroup);
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
  const account = currentAccount();
  const canAdmin = isAdmin(account);
  const active = state.activePlayer;
  const players = account && !canAdmin ? [displayNameForAccount(account)] : state.players;
  const options = players.map((player) => {
    const option = document.createElement("option");
    option.value = player;
    option.textContent = player;
    return option;
  });
  els.activePlayer.replaceChildren(...options);
  els.activePlayer.value = players.includes(active) ? active : players[0];
  els.activePlayer.disabled = !canAdmin;
  els.newPlayer.disabled = !canAdmin;
  els.addPlayer.disabled = !canAdmin;
  els.newPlayer.classList.toggle("is-hidden", !canAdmin);
  els.addPlayer.classList.toggle("is-hidden", !canAdmin);
}

function renderPredictions() {
  enforceAccountAccess();
  const player = state.activePlayer;
  const account = currentAccount();
  const canAdmin = isAdmin(account);
  const typed = Object.keys(state.predictions[player] || {}).length;
  const ranked = ranking().find((row) => row.player === player);
  els.predictionSummary.innerHTML = `
    <span>Aktywny typer</span>
    <strong>${escapeHtml(player)}</strong>
    <div>${ranked?.total ?? 0} pkt · ${typed} typów · ${ranked?.exact ?? 0} dokładnych</div>
    <small>${canAdmin ? "Tryb administratora: możesz przełączać typerów." : "Tryb klienta: zapisujesz typy tylko na swoim koncie."}</small>
  `;
  els.predictionList.replaceChildren(...data.matches.map(predictionCard));
}

function renderRanking() {
  els.rankingBody.innerHTML = ranking()
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.player)}</td>
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

async function updateAccountRole(account, role) {
  if (!account) return;
  if (accountRole(account) === "admin" && role !== "admin" && adminAccounts().length <= 1) {
    flashStatus(els.adminStatus, "Nie można odebrać roli ostatniemu administratorowi.", true);
    renderAdminPanel();
    return;
  }
  if (onlineEnabled()) {
    try {
      await invokeAdminUsers("update", { userId: account.id, role: role === "admin" ? "admin" : "client" });
      await reloadOnlineAndRender();
      flashStatus(els.adminStatus, "Zmieniono rolę użytkownika.");
    } catch (error) {
      flashStatus(els.adminStatus, error.message, true);
      renderAdminPanel();
    }
    return;
  }
  account.role = role === "admin" ? "admin" : "client";
  saveAccounts();
  flashStatus(els.adminStatus, "Zmieniono rolę użytkownika.");
  renderAll();
}

async function updateAccountStatus(account, status) {
  if (!account) return;
  if (onlineEnabled()) {
    try {
      await invokeAdminUsers("update", { userId: account.id, verified: status === "verified" });
      await reloadOnlineAndRender();
      flashStatus(els.adminStatus, "Zmieniono status konta.");
    } catch (error) {
      flashStatus(els.adminStatus, error.message, true);
      renderAdminPanel();
    }
    return;
  }
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

async function deleteAccount(account) {
  const currentId = state.user?.accountId;
  if (!account || account.id === currentId) return;
  if (accountRole(account) === "admin" && adminAccounts().length <= 1) {
    flashStatus(els.adminStatus, "Nie można usunąć ostatniego administratora.", true);
    return;
  }
  const ok = window.confirm(`Usunąć użytkownika ${displayNameForAccount(account)}?`);
  if (!ok) return;
  if (onlineEnabled()) {
    try {
      await invokeAdminUsers("delete", { userId: account.id });
      await reloadOnlineAndRender();
      flashStatus(els.adminStatus, "Usunięto użytkownika.");
    } catch (error) {
      flashStatus(els.adminStatus, error.message, true);
    }
    return;
  }
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
  if (onlineEnabled()) {
    try {
      await invokeAdminUsers("create", { user: form });
      await reloadOnlineAndRender();
      els.adminAddForm.reset();
      els.adminVerified.checked = true;
      flashStatus(els.adminStatus, "Dodano użytkownika.");
    } catch (error) {
      flashStatus(els.adminStatus, error.message, true);
    }
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
  persistOnlineProfile(account).catch((error) => flashStatus(els.settingsStatus, error.message, true));
  flashStatus(els.settingsStatus, "Zapisano.");
  renderAll();
}

function toggleTheme() {
  const account = state.user?.accountId ? accountById(state.user.accountId) : null;
  if (!account) return;
  account.preferences ||= {};
  account.preferences.theme = account.preferences.theme === "dark" ? "light" : "dark";
  saveAccounts();
  persistOnlineProfile(account).catch((error) => console.warn("Nie zapisano motywu online:", error.message));
  renderAll();
}

function renderAll() {
  enforceAccountAccess();
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
  if (!isAdmin()) return;
  const name = els.newPlayer.value.trim();
  if (!name || state.players.includes(name)) return;
  state.players.push(name);
  state.activePlayer = name;
  els.newPlayer.value = "";
  saveState();
  renderAll();
}

function exportState() {
  if (!isAdmin()) {
    els.dataStatus.textContent = "Eksport danych jest dostępny tylko dla administratora.";
    return;
  }
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
  if (!isAdmin()) {
    els.dataStatus.textContent = "Import danych jest dostępny tylko dla administratora.";
    return;
  }
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
    replaceOnlineTournamentState(state).catch((error) => flashStatus(els.dataStatus, error.message, true));
    els.importBox.value = "";
    els.dataStatus.textContent = "Zaimportowano dane.";
    renderAll();
  } catch (error) {
    els.dataStatus.textContent = `Błąd importu: ${error.message}`;
  }
}

function resetState() {
  if (!isAdmin()) {
    els.dataStatus.textContent = "Czyszczenie danych jest dostępne tylko dla administratora.";
    return;
  }
  const ok = window.confirm("Wyczyścić lokalne wyniki, typy i typerów?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState(data);
  saveState();
  replaceOnlineTournamentState(state).catch((error) => flashStatus(els.dataStatus, error.message, true));
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
  els.groupFilter.addEventListener("change", renderMatches);

  let _phaseHoverTimer = null;
  els.phaseTabs.addEventListener("mouseover", (e) => {
    const pill = e.target.closest(".phase-pill");
    if (!pill || pill.dataset.stage === activeStage) { clearTimeout(_phaseHoverTimer); return; }
    clearTimeout(_phaseHoverTimer);
    _phaseHoverTimer = setTimeout(() => setStageFilter(pill.dataset.stage), 150);
  });
  els.phaseTabs.addEventListener("mouseleave", () => clearTimeout(_phaseHoverTimer));
  els.phaseTabs.addEventListener("click", (e) => {
    const pill = e.target.closest(".phase-pill");
    if (!pill) return;
    clearTimeout(_phaseHoverTimer);
    setStageFilter(pill.dataset.stage);
  });
  els.activePlayer.addEventListener("change", () => {
    if (!isAdmin()) {
      enforceAccountAccess();
      renderAll();
      return;
    }
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
  await setupOnlineBackend();
  if (!onlineEnabled()) {
    ensureAdminBootstrap();
    if (state.user?.email && !state.user.accountId) {
      state.user = null;
      saveState();
    }
  }
  bindEvents();
  verifyAccountFromUrl();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="app-section"><h1>Błąd danych</h1><p>${error.message}</p></main>`;
});
