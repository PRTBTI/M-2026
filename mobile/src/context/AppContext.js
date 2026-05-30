import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import DATA from '../data/worldcup-2026.json';

const STORAGE_KEY = 'kipi-m2026-state-v1';
const ACCOUNT_KEY = 'kipi-m2026-accounts-v1';

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function randomToken() {
  const arr = new Uint8Array(18);
  for (let i = 0; i < 18; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

async function hashPassword(password, salt = randomToken()) {
  const hash = await sha256(`${salt}:${password}`);
  return { salt, hash };
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanPlayers(players = []) {
  return [...new Set(players.map(n => String(n || '').trim()).filter(Boolean))].filter(
    n => n.toLowerCase() !== 'nazwa',
  );
}

function createInitialState() {
  const players = cleanPlayers(DATA.defaultPlayers);
  const fallback = players.length ? players : ['Anna', 'Lewy', 'Peter'];
  return {
    players: fallback,
    activePlayer: fallback[0],
    user: null,
    results: {},
    predictions: {},
    updatedAt: new Date().toISOString(),
  };
}

function isComplete(pair) {
  return pair != null && Number.isInteger(pair.home) && Number.isInteger(pair.away);
}

function matchOutcome(pair) {
  if (!pair) return null;
  if (pair.home > pair.away) return 'H';
  if (pair.home < pair.away) return 'A';
  return 'D';
}

function calcScore(prediction, actual) {
  if (!isComplete(prediction) || !isComplete(actual)) return { total: 0, exact: false, sign: false };
  const r = DATA.scoring;
  const exact = prediction.home === actual.home && prediction.away === actual.away;
  const sign = matchOutcome(prediction) === matchOutcome(actual);
  const gd = prediction.home - prediction.away === actual.home - actual.away;
  const many = prediction.home + prediction.away >= 8 && actual.home + actual.away >= 8;
  let total = 0;
  if (sign) total += r.outcome || 0;
  if (gd) total += r.goalDifference || 0;
  if (exact) total += r.exactGoals || 0;
  if (many) total += r.manyGoals || 0;
  return { total, exact, sign };
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState(() => createInitialState());
  const [accountsList, setAccountsList] = useState([]);

  // Refs for always-current values inside async callbacks
  const gsRef = useRef(gameState);
  const acRef = useRef(accountsList);
  gsRef.current = gameState;
  acRef.current = accountsList;

  // ── Persistence helpers ────────────────────────────────────────────────────
  async function saveGs(next) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    gsRef.current = stamped;
    setGameState(stamped);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  }

  async function saveAc(next) {
    acRef.current = next;
    setAccountsList(next);
    await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        const [rawGs, rawAc] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ACCOUNT_KEY),
        ]);

        let gs = createInitialState();
        if (rawGs) {
          try {
            const saved = JSON.parse(rawGs);
            if (saved && typeof saved === 'object') {
              const players = cleanPlayers(saved.players);
              gs = {
                ...createInitialState(),
                ...saved,
                players: players.length ? players : cleanPlayers(DATA.defaultPlayers),
                user: saved.user && typeof saved.user === 'object' ? saved.user : null,
                results: saved.results || {},
                predictions: saved.predictions || {},
              };
              if (!gs.players.includes(gs.activePlayer)) gs.activePlayer = gs.players[0];
            }
          } catch (_) {}
        }

        // Clear session if accountId was stripped (old format)
        if (gs.user?.email && !gs.user?.accountId) gs.user = null;

        let ac = [];
        if (rawAc) {
          try {
            const parsed = JSON.parse(rawAc);
            ac = Array.isArray(parsed) ? parsed : [];
          } catch (_) {}
        }

        gsRef.current = gs;
        acRef.current = ac;
        setGameState(gs);
        setAccountsList(ac);
        bootstrapAdmin(gs, ac);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  function bootstrapAdmin(gs, ac) {
    let changed = false;
    const updated = ac.map(a => {
      let next = a;
      if (!next.role) { next = { ...next, role: 'client' }; changed = true; }
      if (!next.preferences) {
        next = { ...next, preferences: { theme: 'dark', accent: '#f1861d', compact: false, favoriteTeam: '' } };
        changed = true;
      }
      return next;
    });
    const hasAdmin = updated.some(a => a.role === 'admin');
    if (!hasAdmin && updated.length > 0) {
      const current = gs.user?.accountId ? updated.find(a => a.id === gs.user.accountId) : null;
      const candidate = current || updated.find(a => a.verified) || updated[0];
      if (candidate) {
        const idx = updated.indexOf(candidate);
        updated[idx] = { ...candidate, role: 'admin' };
        changed = true;
      }
    }
    if (changed) {
      acRef.current = updated;
      setAccountsList(updated);
      AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(updated));
    }
  }

  // ── Account helpers ────────────────────────────────────────────────────────
  function getAccountById(id) {
    return acRef.current.find(a => a.id === id) ?? null;
  }

  function getAccountByEmail(email) {
    return acRef.current.find(a => a.email === normalizeEmail(email)) ?? null;
  }

  function currentAccount() {
    const id = gsRef.current?.user?.accountId;
    return id ? getAccountById(id) : null;
  }

  function getRole(account) {
    return account?.role === 'admin' ? 'admin' : 'client';
  }

  function isAdmin(account) {
    const acc = account !== undefined ? account : currentAccount();
    return getRole(acc) === 'admin';
  }

  function displayName(account) {
    if (!account) return '';
    const nick = String(account.nickname || '').trim();
    if (nick) return nick;
    return `${account.firstName || ''} ${account.lastName || ''}`.trim() || 'Użytkownik';
  }

  function getCurrentTheme() {
    const acc = currentAccount();
    return acc?.preferences?.theme === 'light' ? 'light' : 'dark';
  }

  function getAccentColor() {
    const acc = currentAccount();
    return acc?.preferences?.accent || '#f1861d';
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  async function login(email, password) {
    const account = getAccountByEmail(email);
    if (!account) return { error: 'Nie znaleziono konta dla tego adresu.' };
    if (!account.verified) return { error: 'Potwierdź adres e-mail przed logowaniem.', needsVerify: true };

    const check = await hashPassword(password, account.passwordSalt);
    if (check.hash !== account.passwordHash) return { error: 'Nieprawidłowy e-mail lub hasło.' };

    const player = displayName(account);
    const gs = { ...gsRef.current };
    if (!gs.players.includes(player)) gs.players = [...gs.players, player];
    gs.activePlayer = player;
    gs.user = {
      accountId: account.id,
      email: account.email,
      player,
      loggedInAt: new Date().toISOString(),
    };
    await saveGs(gs);
    return { success: true };
  }

  async function register(form) {
    if (!form.firstName || !form.lastName) return { error: 'Podaj imię i nazwisko.' };
    if (!isEmailValid(form.email)) return { error: 'Podaj poprawny adres e-mail.' };
    if ((form.password || '').length < 8) return { error: 'Hasło musi mieć co najmniej 8 znaków.' };

    const existing = getAccountByEmail(form.email);
    if (existing?.verified) return { error: 'Konto z tym adresem już istnieje. Zaloguj się.' };

    const { salt, hash } = await hashPassword(form.password, existing?.passwordSalt);
    const verificationToken = randomToken();
    const updated = [...acRef.current];

    if (existing) {
      const idx = updated.findIndex(a => a.id === existing.id);
      updated[idx] = {
        ...existing,
        firstName: form.firstName,
        lastName: form.lastName,
        nickname: form.nickname || '',
        passwordSalt: salt,
        passwordHash: hash,
        verified: false,
        verificationToken,
        pendingSince: new Date().toISOString(),
      };
    } else {
      const hasAdmin = updated.some(a => getRole(a) === 'admin');
      updated.push({
        id: randomToken(),
        email: normalizeEmail(form.email),
        firstName: form.firstName,
        lastName: form.lastName,
        nickname: form.nickname || '',
        passwordSalt: salt,
        passwordHash: hash,
        verified: false,
        verificationToken,
        pendingSince: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        role: hasAdmin ? 'client' : 'admin',
        preferences: { theme: 'dark', accent: '#f1861d', compact: false, favoriteTeam: '' },
      });
    }

    await saveAc(updated);
    return { success: true, verificationToken };
  }

  async function verifyAccount(token) {
    const account = acRef.current.find(a => a.verificationToken === token);
    if (!account) return { error: 'Nieprawidłowy token weryfikacyjny.' };

    const updated = acRef.current.map(a =>
      a.id === account.id
        ? { ...a, verified: true, verifiedAt: new Date().toISOString(), verificationToken: '' }
        : a,
    );
    await saveAc(updated);

    const verified = updated.find(a => a.id === account.id);
    const player = displayName(verified);
    const gs = { ...gsRef.current };
    if (!gs.players.includes(player)) gs.players = [...gs.players, player];
    gs.activePlayer = player;
    gs.user = { accountId: verified.id, email: verified.email, player, loggedInAt: new Date().toISOString() };
    await saveGs(gs);
    return { success: true };
  }

  async function logout() {
    await saveGs({ ...gsRef.current, user: null });
  }

  // ── Results ────────────────────────────────────────────────────────────────
  function getResult(matchId) {
    const r = gsRef.current.results[String(matchId)];
    return isComplete(r) ? r : null;
  }

  async function setResult(matchId, pair) {
    if (!isAdmin()) return;
    const results = { ...gsRef.current.results };
    if (!pair) delete results[String(matchId)];
    else results[String(matchId)] = pair;
    await saveGs({ ...gsRef.current, results });
  }

  // ── Predictions ────────────────────────────────────────────────────────────
  function getPrediction(player, matchId) {
    const p = gsRef.current.predictions[player]?.[String(matchId)];
    return isComplete(p) ? p : null;
  }

  async function setPrediction(player, matchId, pair) {
    const acc = currentAccount();
    const canEdit = isAdmin(acc) || player === displayName(acc);
    if (!canEdit) return;
    const predictions = { ...gsRef.current.predictions };
    predictions[player] = { ...(predictions[player] || {}) };
    if (!pair) delete predictions[player][String(matchId)];
    else predictions[player][String(matchId)] = pair;
    await saveGs({ ...gsRef.current, predictions });
  }

  function scorePrediction(prediction, actual) {
    return calcScore(prediction, actual);
  }

  // ── Ranking ────────────────────────────────────────────────────────────────
  function getRanking() {
    return gsRef.current.players
      .map(player => {
        let total = 0, exact = 0, signs = 0, typed = 0;
        DATA.matches.forEach(match => {
          const actual = getResult(match.id);
          const pred = getPrediction(player, match.id);
          if (pred) typed++;
          const s = calcScore(pred, actual);
          total += s.total;
          if (s.exact) exact++;
          if (s.sign) signs++;
        });
        return { player, total, exact, signs, typed };
      })
      .sort((a, b) => b.total - a.total || b.exact - a.exact || b.signs - a.signs || a.player.localeCompare(b.player));
  }

  // ── Group standings ────────────────────────────────────────────────────────
  function getGroupStandings(groupCode) {
    const teams = DATA.groups[groupCode] || [];
    const table = new Map(
      teams.map(t => [t.name, { team: t.name, slot: t.slot, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]),
    );
    DATA.matches.filter(m => m.stage === 'Faza grupowa' && m.group === groupCode).forEach(match => {
      const res = getResult(match.id);
      if (!res || !table.has(match.homeTeam) || !table.has(match.awayTeam)) return;
      const home = table.get(match.homeTeam);
      const away = table.get(match.awayTeam);
      home.played++; away.played++;
      home.gf += res.home; home.ga += res.away;
      away.gf += res.away; away.ga += res.home;
      if (res.home > res.away) { home.wins++; away.losses++; home.pts += 3; }
      else if (res.home < res.away) { away.wins++; home.losses++; away.pts += 3; }
      else { home.draws++; away.draws++; home.pts++; away.pts++; }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });
    return [...table.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
  }

  // ── Player management ──────────────────────────────────────────────────────
  async function setActivePlayer(name) {
    if (!isAdmin()) return;
    await saveGs({ ...gsRef.current, activePlayer: name });
  }

  async function addPlayerAdmin(name) {
    if (!isAdmin() || !name) return { error: 'Brak uprawnień lub pustej nazwy.' };
    if (gsRef.current.players.includes(name)) return { error: 'Typer już istnieje.' };
    const gs = { ...gsRef.current };
    gs.players = [...gs.players, name];
    gs.activePlayer = name;
    await saveGs(gs);
    return { success: true };
  }

  // ── Admin: accounts ────────────────────────────────────────────────────────
  async function addAccountFromAdmin(form) {
    if (!isAdmin()) return { error: 'Brak uprawnień.' };
    if (!form.firstName || !form.lastName) return { error: 'Podaj imię i nazwisko.' };
    if (!isEmailValid(form.email)) return { error: 'Podaj poprawny adres e-mail.' };
    if ((form.password || '').length < 8) return { error: 'Hasło musi mieć co najmniej 8 znaków.' };
    if (getAccountByEmail(form.email)) return { error: 'Konto z tym adresem już istnieje.' };

    const { salt, hash } = await hashPassword(form.password);
    const verified = form.verified !== false;
    const account = {
      id: randomToken(),
      email: normalizeEmail(form.email),
      firstName: form.firstName,
      lastName: form.lastName,
      nickname: form.nickname || '',
      passwordSalt: salt,
      passwordHash: hash,
      verified,
      verifiedAt: verified ? new Date().toISOString() : '',
      verificationToken: verified ? '' : randomToken(),
      role: form.role === 'admin' ? 'admin' : 'client',
      createdAt: new Date().toISOString(),
      preferences: { theme: 'dark', accent: '#f1861d', compact: false, favoriteTeam: '' },
    };
    const updated = [...acRef.current, account];
    await saveAc(updated);

    const player = displayName(account);
    const gs = { ...gsRef.current };
    if (!gs.players.includes(player)) {
      gs.players = [...gs.players, player];
      await saveGs(gs);
    }
    return { success: true };
  }

  async function updateAccountRole(accountId, role) {
    const ac = acRef.current;
    const account = ac.find(a => a.id === accountId);
    if (!account) return { error: 'Nie znaleziono konta.' };
    const adminCount = ac.filter(a => a.role === 'admin').length;
    if (account.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      return { error: 'Nie można odebrać roli ostatniemu administratorowi.' };
    }
    await saveAc(ac.map(a => a.id === accountId ? { ...a, role: role === 'admin' ? 'admin' : 'client' } : a));
    return { success: true };
  }

  async function updateAccountStatus(accountId, verified) {
    await saveAc(acRef.current.map(a => {
      if (a.id !== accountId) return a;
      return {
        ...a,
        verified,
        verifiedAt: verified ? (a.verifiedAt || new Date().toISOString()) : '',
        verificationToken: verified ? '' : (a.verificationToken || randomToken()),
      };
    }));
    return { success: true };
  }

  async function deleteAccount(accountId) {
    const currentId = gsRef.current.user?.accountId;
    if (accountId === currentId) return { error: 'Nie możesz usunąć własnego konta.' };
    const ac = acRef.current;
    const account = ac.find(a => a.id === accountId);
    if (!account) return { error: 'Nie znaleziono konta.' };
    if (account.role === 'admin' && ac.filter(a => a.role === 'admin').length <= 1) {
      return { error: 'Nie można usunąć ostatniego administratora.' };
    }
    const player = displayName(account);
    await saveAc(ac.filter(a => a.id !== accountId));
    const gs = { ...gsRef.current };
    gs.players = gs.players.filter(p => p !== player);
    const preds = { ...gs.predictions };
    delete preds[player];
    gs.predictions = preds;
    if (gs.activePlayer === player) gs.activePlayer = gs.players[0] || '';
    await saveGs(gs);
    return { success: true };
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  async function saveSettings({ nickname, favoriteTeam, accent, compact }) {
    const account = currentAccount();
    if (!account) return;
    const oldPlayer = displayName(account);
    const updatedAccount = {
      ...account,
      nickname: nickname || '',
      preferences: { ...(account.preferences || {}), favoriteTeam: favoriteTeam || '', accent: accent || '#f1861d', compact: Boolean(compact) },
    };
    const newPlayer = displayName(updatedAccount);
    await saveAc(acRef.current.map(a => (a.id === account.id ? updatedAccount : a)));

    const gs = { ...gsRef.current };
    let players = [...gs.players];
    let predictions = { ...gs.predictions };
    if (oldPlayer !== newPlayer) {
      const idx = players.indexOf(oldPlayer);
      if (idx >= 0 && !players.includes(newPlayer)) players[idx] = newPlayer;
      else if (!players.includes(newPlayer)) players.push(newPlayer);
      if (predictions[oldPlayer] && !predictions[newPlayer]) {
        predictions[newPlayer] = predictions[oldPlayer];
        delete predictions[oldPlayer];
      }
    }
    gs.players = players;
    gs.predictions = predictions;
    gs.activePlayer = newPlayer;
    gs.user = { ...gs.user, player: newPlayer };
    await saveGs(gs);
  }

  async function toggleTheme() {
    const account = currentAccount();
    if (!account) return;
    const current = account.preferences?.theme || 'dark';
    await saveAc(acRef.current.map(a =>
      a.id === account.id ? { ...a, preferences: { ...a.preferences, theme: current === 'dark' ? 'light' : 'dark' } } : a,
    ));
  }

  // ── Import / Export ────────────────────────────────────────────────────────
  function exportData() {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state: gsRef.current }, null, 2);
  }

  async function importData(jsonStr) {
    try {
      const payload = JSON.parse(jsonStr);
      const imported = payload.state || payload;
      if (!imported.players || !Array.isArray(imported.players)) throw new Error('Brak listy typerów.');
      const next = {
        ...createInitialState(),
        ...imported,
        players: cleanPlayers(imported.players),
        user: imported.user || null,
        results: imported.results || {},
        predictions: imported.predictions || {},
      };
      if (!next.players.includes(next.activePlayer)) next.activePlayer = next.players[0];
      await saveGs(next);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function resetData() {
    await saveGs(createInitialState());
  }

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    loading,
    data: DATA,
    gameState,
    accounts: accountsList,
    // auth
    login, register, verifyAccount, logout,
    // account helpers
    currentAccount, isAdmin, displayName, getAccountById, getAccountByEmail,
    getCurrentTheme, getAccentColor,
    // data
    getResult, setResult, getPrediction, setPrediction, scorePrediction,
    getRanking, getGroupStandings,
    // state
    setActivePlayer, addPlayerAdmin,
    // admin
    addAccountFromAdmin, updateAccountRole, updateAccountStatus, deleteAccount,
    // settings
    saveSettings, toggleTheme,
    // import/export
    exportData, importData, resetData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
