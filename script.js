const PLAYER_STORAGE_KEY = "volei_players_v2";
const SETS_STORAGE_KEY = "volei_sets_v1";
const ALLOWED_POSITIONS = new Set(["LB", "LV", "PT", "OP", "CT"]);

const setHome = document.getElementById("sets-home");
const setAway = document.getElementById("sets-away");
const statusMessage = document.getElementById("status-message");
const resetDataButton = document.getElementById("reset-data-btn");
const exportDataButton = document.getElementById("export-data-btn");
const importDataButton = document.getElementById("import-data-btn");
const importDataInput = document.getElementById("import-data-input");

function showStatus(message, type = "info") {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.remove("status-error", "status-success");

  if (type === "error") {
    statusMessage.classList.add("status-error");
  }

  if (type === "success") {
    statusMessage.classList.add("status-success");
  }
}

function clampNonNegativeInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function loadSetsFromStorage() {
  const fallback = { home: 0, away: 0 };

  try {
    const raw = localStorage.getItem(SETS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      home: clampNonNegativeInt(parsed?.home),
      away: clampNonNegativeInt(parsed?.away)
    };
  } catch {
    return fallback;
  }
}

function saveSetsToStorage(sets) {
  try {
    localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(sets));
  } catch {
    // No-op quando localStorage nao estiver disponivel.
  }
}

function renderSets(sets) {
  setHome.textContent = sets.home;
  setAway.textContent = sets.away;
}

const sets = loadSetsFromStorage();

document.querySelectorAll(".circle-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    const delta = Number(button.dataset.delta);

    sets[target] = Math.max(0, sets[target] + delta);
    renderSets(sets);
    saveSetsToStorage(sets);
  });
});

function getPlayerRowsById() {
  const rows = Array.from(document.querySelectorAll("table tbody tr[data-player-id]"));
  const groupedRows = {};

  rows.forEach((row) => {
    const playerId = row.dataset.playerId;
    const cells = row.querySelectorAll("td");

    if (!playerId || cells.length < 3) {
      return;
    }

    const entry = {
      row,
      numberCell: cells[0],
      nameCell: cells[1],
      positionCell: cells[2]
    };

    if (!groupedRows[playerId]) {
      groupedRows[playerId] = [];
    }

    groupedRows[playerId].push(entry);
  });

  return groupedRows;
}

const playerRowsById = getPlayerRowsById();
const playerIds = Object.keys(playerRowsById);
const rotationSlots = Array.from(document.querySelectorAll(".position[data-player-id]"));

function normalizeNumber(value) {
  return String(value ?? "").replace(/[^0-9]/g, "").slice(0, 3);
}

function normalizeName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePosition(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function sanitizePlayer(candidate, fallback) {
  const safeFallback = fallback || { number: "", name: "", position: "" };
  const number = normalizeNumber(candidate?.number);
  const name = normalizeName(candidate?.name);
  const position = normalizePosition(candidate?.position);

  return {
    number: number || safeFallback.number,
    name: name || safeFallback.name,
    position: ALLOWED_POSITIONS.has(position) ? position : safeFallback.position
  };
}

function getBasePlayersFromTable() {
  const defaults = {};

  playerIds.forEach((playerId) => {
    const firstEntry = playerRowsById[playerId][0];
    defaults[playerId] = sanitizePlayer(
      {
        number: firstEntry.numberCell.textContent,
        name: firstEntry.nameCell.textContent,
        position: firstEntry.positionCell.textContent
      },
      { number: "", name: "", position: "" }
    );
  });

  return defaults;
}

const defaultPlayers = getBasePlayersFromTable();

function clonePlayers(source) {
  const clone = {};

  playerIds.forEach((playerId) => {
    const player = source[playerId] || defaultPlayers[playerId];
    clone[playerId] = {
      number: player.number,
      name: player.name,
      position: player.position
    };
  });

  return clone;
}

function extractPlayersPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  if (Array.isArray(payload.players)) {
    const mapped = {};

    payload.players.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const playerId = String(item.id || "").trim();
      if (!playerId) {
        return;
      }

      mapped[playerId] = item;
    });

    return mapped;
  }

  if (payload.players && typeof payload.players === "object" && !Array.isArray(payload.players)) {
    return payload.players;
  }

  const payloadIsPlayerMap = playerIds.some((playerId) =>
    Object.prototype.hasOwnProperty.call(payload, playerId)
  );

  if (payloadIsPlayerMap) {
    return payload;
  }

  return {};
}

function loadPlayersFromStorage() {
  const fallbackPlayers = clonePlayers(defaultPlayers);

  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) {
      return fallbackPlayers;
    }

    const parsed = JSON.parse(raw);
    const storedPlayers = extractPlayersPayload(parsed);
    const mergedPlayers = clonePlayers(fallbackPlayers);

    playerIds.forEach((playerId) => {
      if (!Object.prototype.hasOwnProperty.call(storedPlayers, playerId)) {
        return;
      }

      mergedPlayers[playerId] = sanitizePlayer(storedPlayers[playerId], mergedPlayers[playerId]);
    });

    return mergedPlayers;
  } catch {
    return fallbackPlayers;
  }
}

function savePlayersToStorage(players) {
  const payload = {
    version: 1,
    players: playerIds.map((playerId) => ({
      id: playerId,
      number: players[playerId].number,
      name: players[playerId].name,
      position: players[playerId].position
    }))
  };

  try {
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // No-op quando localStorage nao estiver disponivel.
  }
}

function getCellFromField(entry, field) {
  if (field === "number") {
    return entry.numberCell;
  }

  if (field === "name") {
    return entry.nameCell;
  }

  return entry.positionCell;
}

function syncFieldAcrossRows(playerId, field, value, sourceCell = null) {
  const rows = playerRowsById[playerId] || [];

  rows.forEach((entry) => {
    const cell = getCellFromField(entry, field);
    if (sourceCell && cell === sourceCell) {
      return;
    }

    cell.textContent = value;
  });
}

function applyPlayersToTables(players) {
  playerIds.forEach((playerId) => {
    const player = players[playerId];
    syncFieldAcrossRows(playerId, "number", player.number);
    syncFieldAcrossRows(playerId, "name", player.name);
    syncFieldAcrossRows(playerId, "position", player.position);
  });
}

function renderRotation(players) {
  rotationSlots.forEach((slot) => {
    const playerId = slot.dataset.playerId;
    const player = players[playerId];
    slot.textContent = player && player.number ? player.number : "-";
  });
}

function makeCellEditable(cell, field) {
  cell.classList.add("editable-cell", `editable-${field}`);
  cell.dataset.field = field;
  cell.contentEditable = "true";
  cell.spellcheck = field === "name";
  cell.tabIndex = 0;

  if (field === "position") {
    cell.title = "Valores permitidos: LB, LV, PT, OP, CT";
  } else {
    cell.title = "Clique para editar";
  }
}

function markEditableCells() {
  playerIds.forEach((playerId) => {
    playerRowsById[playerId].forEach((entry) => {
      makeCellEditable(entry.numberCell, "number");
      makeCellEditable(entry.nameCell, "name");
      makeCellEditable(entry.positionCell, "position");
    });
  });
}

function getCellContext(target) {
  const cell = target.closest("td.editable-cell");
  if (!cell) {
    return null;
  }

  const row = cell.closest("tr[data-player-id]");
  if (!row) {
    return null;
  }

  const playerId = row.dataset.playerId;
  const field = cell.dataset.field;

  if (!playerId || !field || !playerRowsById[playerId]) {
    return null;
  }

  return { cell, playerId, field };
}

function normalizeFieldValue(field, value) {
  if (field === "number") {
    return normalizeNumber(value);
  }

  if (field === "name") {
    return normalizeName(value);
  }

  return normalizePosition(value);
}

let players = loadPlayersFromStorage();

markEditableCells();
applyPlayersToTables(players);
renderRotation(players);
renderSets(sets);

document.addEventListener("focusin", (event) => {
  const context = getCellContext(event.target);
  if (!context) {
    return;
  }

  context.cell.dataset.previousValue = players[context.playerId][context.field];
});

document.addEventListener("input", (event) => {
  const context = getCellContext(event.target);
  if (!context) {
    return;
  }

  const value = context.cell.textContent;
  players[context.playerId][context.field] = value;
  syncFieldAcrossRows(context.playerId, context.field, value, context.cell);

  if (context.field === "number") {
    renderRotation(players);
  }
});

document.addEventListener("focusout", (event) => {
  const context = getCellContext(event.target);
  if (!context) {
    return;
  }

  const currentValue = normalizeFieldValue(context.field, context.cell.textContent);
  const previousValue = normalizeFieldValue(context.field, context.cell.dataset.previousValue || "");
  const fallbackValue = players[context.playerId][context.field] || defaultPlayers[context.playerId][context.field];
  let finalValue = currentValue || previousValue || fallbackValue;

  if (context.field === "position" && !ALLOWED_POSITIONS.has(finalValue)) {
    finalValue = previousValue || defaultPlayers[context.playerId].position;
    showStatus("Posicao invalida. Use LB, LV, PT, OP ou CT.", "error");
  }

  players[context.playerId][context.field] = finalValue;
  syncFieldAcrossRows(context.playerId, context.field, finalValue, context.cell);

  if (context.field === "number") {
    renderRotation(players);
  }

  savePlayersToStorage(players);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  const context = getCellContext(event.target);
  if (!context) {
    return;
  }

  event.preventDefault();
  context.cell.blur();
});

exportDataButton.addEventListener("click", () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sets: {
      home: sets.home,
      away: sets.away
    },
    players: playerIds.map((playerId) => ({
      id: playerId,
      number: players[playerId].number,
      name: players[playerId].name,
      position: players[playerId].position
    })),
    rotation: rotationSlots.map((slot) => slot.dataset.playerId)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `volei-elenco-${stamp}.json`;
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 250);
  showStatus("Arquivo JSON exportado com sucesso.", "success");
});

importDataButton.addEventListener("click", () => {
  importDataInput.click();
});

importDataInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedPlayers = extractPlayersPayload(payload);
    const nextPlayers = clonePlayers(players);
    let hasPlayerUpdate = false;

    playerIds.forEach((playerId) => {
      if (!Object.prototype.hasOwnProperty.call(importedPlayers, playerId)) {
        return;
      }

      nextPlayers[playerId] = sanitizePlayer(importedPlayers[playerId], nextPlayers[playerId]);
      hasPlayerUpdate = true;
    });

    if (hasPlayerUpdate) {
      players = nextPlayers;
      applyPlayersToTables(players);
      renderRotation(players);
      savePlayersToStorage(players);
    }

    if (payload?.sets && typeof payload.sets === "object") {
      sets.home = clampNonNegativeInt(payload.sets.home);
      sets.away = clampNonNegativeInt(payload.sets.away);
      renderSets(sets);
      saveSetsToStorage(sets);
    }

    if (!hasPlayerUpdate && !payload?.sets) {
      throw new Error("Arquivo sem dados validos.");
    }

    showStatus("Importacao concluida com sucesso.", "success");
  } catch {
    showStatus("Falha ao importar JSON. Verifique o arquivo.", "error");
  } finally {
    importDataInput.value = "";
  }
});

resetDataButton.addEventListener("click", () => {
  const confirmed = window.confirm("Deseja resetar atletas e placar para os valores iniciais?");
  if (!confirmed) {
    return;
  }

  players = clonePlayers(defaultPlayers);
  sets.home = 0;
  sets.away = 0;

  applyPlayersToTables(players);
  renderRotation(players);
  renderSets(sets);

  try {
    localStorage.removeItem(PLAYER_STORAGE_KEY);
    localStorage.removeItem(SETS_STORAGE_KEY);
  } catch {
    // No-op quando localStorage nao estiver disponivel.
  }

  showStatus("Dados resetados para o padrao.", "success");
});
