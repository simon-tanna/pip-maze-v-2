const PLAYERS_KEY = 'doom-maze-players';
const ACTIVE_KEY  = 'doom-maze-active-player';

function _load() {
  try { return JSON.parse(localStorage.getItem(PLAYERS_KEY) || '{}'); }
  catch { return {}; }
}

function _save(data) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(data));
}

export function getAllPlayers() {
  return Object.entries(_load()).map(([name, v]) => ({ name, ...v }));
}

export function getPlayer(name) {
  return _load()[name] || null;
}

export function addPlayer(name) {
  const data = _load();
  if (data[name]) return;
  data[name] = { coin_balance: 10 };
  _save(data);
}

export function getActivePlayerName() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function setActivePlayerName(name) {
  localStorage.setItem(ACTIVE_KEY, name);
}

export function updatePlayerCoins(name, delta) {
  const data = _load();
  if (!data[name]) return;
  data[name].coin_balance = Math.max(0, (data[name].coin_balance || 0) + delta);
  _save(data);
}

// Always use this instead of calling updatePlayerCoins directly — keeps registry in sync.
export function setPlayerCoins(game, name, delta) {
  updatePlayerCoins(name, delta);
  const player = getPlayer(name);
  if (player) game.registry.set('activePlayer', { name, coin_balance: player.coin_balance });
}
