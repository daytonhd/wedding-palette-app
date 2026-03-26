const API_URL = "/api/admin/results";
const CLEAR_URL = "/api/admin/clear";

const summarySection = document.getElementById("summarySection");
const paletteCounts = document.getElementById("paletteCounts");
const respondentsContainer = document.getElementById("respondentsContainer");
const refreshBtn = document.getElementById("refreshBtn");
const clearBtn = document.getElementById("clearBtn");
const messageBox = document.getElementById("messageBox");

refreshBtn.addEventListener("click", loadAdminResults);

if (clearBtn) {
  clearBtn.addEventListener("click", clearResults);
}

loadAdminResults();

async function loadAdminResults() {
  clearMessage();
  showLoadingState();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const rawData = await response.json();
    const data = normalizeAdminResults(rawData);

    renderSummary(data);
    renderPaletteCounts(data.paletteCounts);
    renderRespondents(data.respondents);
  } catch (error) {
    console.error("Failed to load admin results:", error);
    showMessage(`Could not load admin results. ${error.message}`);
    showEmptyState("Unable to load results.");
  }
}

function normalizeAdminResults(rawData) {
  const respondentsArray = Array.isArray(rawData.respondents)
    ? rawData.respondents
    : [];

  const responsesArray = Array.isArray(rawData.responses)
    ? rawData.responses
    : [];

  const responsesByRespondentId = {};

  for (const response of responsesArray) {
    const respondentId = response.respondent_id;

    if (!responsesByRespondentId[respondentId]) {
      responsesByRespondentId[respondentId] = [];
    }

    responsesByRespondentId[respondentId].push(response);
  }

  const respondents = respondentsArray.map((item, index) => {
    const respondentId = item.id || item.respondent_id || index + 1;

    const respondentName =
      item.name ||
      item.respondent_name ||
      item.respondent ||
      `Respondent ${index + 1}`;

    const finalWinner =
      item.final_winner_palette_id ??
      item.final_winner ??
      item.winner ??
      item.finalWinner ??
      null;

    const createdAt = item.created_at || item.createdAt || null;

    const rawChoices = responsesByRespondentId[respondentId] || [];
    const choices = normalizeChoices(rawChoices);

    return {
      id: respondentId,
      name: respondentName,
      finalWinner,
      createdAt,
      status: item.status || null,
      choices,
    };
  });

  const paletteCounts = buildPaletteCounts(respondents);

  return {
    respondents,
    paletteCounts,
    totalRespondents: respondents.length,
    completedRespondents: respondents.filter((r) => r.finalWinner !== null)
      .length,
  };
}

function normalizeChoices(rawChoices) {
  if (!Array.isArray(rawChoices)) {
    return [];
  }

  return rawChoices.map((choice, index) => {
    const round =
      choice.round_name ||
      choice.round ||
      choice.stage ||
      inferRoundName(index);

    const matchupLabel =
      choice.matchup_key ||
      choice.matchup_label ||
      choice.matchup ||
      choice.label ||
      `Matchup ${index + 1}`;

    const optionA =
      choice.left_palette_id ??
      choice.palette_a ??
      choice.option_a ??
      choice.left_palette ??
      choice.left ??
      choice.a ??
      null;

    const optionB =
      choice.right_palette_id ??
      choice.palette_b ??
      choice.option_b ??
      choice.right_palette ??
      choice.right ??
      choice.b ??
      null;

    const selected =
      choice.selected_palette_id ??
      choice.selected_palette ??
      choice.selected ??
      choice.winner ??
      choice.choice ??
      null;

    return {
      round,
      matchupLabel,
      optionA,
      optionB,
      selected,
    };
  });
}

function inferRoundName(index) {
  if (index <= 2) {
    return "Round 1";
  }

  if (index === 3) {
    return "Semi-final";
  }

  if (index === 4) {
    return "Final";
  }

  return `Round ${index + 1}`;
}

function buildPaletteCounts(respondents) {
  const counts = {};

  for (const respondent of respondents) {
    if (!respondent.finalWinner) {
      continue;
    }

    const key = normalizePaletteDisplayValue(respondent.finalWinner);
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

function renderSummary(data) {
  summarySection.innerHTML = `
    <div class="card">
      <div class="stat-label">Total Respondents</div>
      <div class="stat-value">${data.totalRespondents}</div>
    </div>

    <div class="card">
      <div class="stat-label">Completed Brackets</div>
      <div class="stat-value">${data.completedRespondents}</div>
    </div>

    <div class="card">
      <div class="stat-label">Most Chosen Final Winner</div>
      <div class="stat-value">${getTopPaletteLabel(data.paletteCounts)}</div>
    </div>
  `;
}

function renderPaletteCounts(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    paletteCounts.innerHTML = `
      <div class="empty-state" style="width: 100%;">
        No final winner data yet.
      </div>
    `;
    return;
  }

  paletteCounts.innerHTML = entries
    .map(([palette, count]) => {
      return `
        <div class="palette-box">
          <div class="palette-name">${escapeHtml(palette)}</div>
          <div class="palette-value">${count}</div>
        </div>
      `;
    })
    .join("");
}

function renderRespondents(respondents) {
  if (!respondents.length) {
    respondentsContainer.innerHTML = `
      <div class="empty-state">
        No respondents found yet.
      </div>
    `;
    return;
  }

  respondentsContainer.innerHTML = respondents
    .map((respondent) => {
      return `
        <div class="respondent-card">
          <div class="respondent-top">
            <div>
              <h3 class="respondent-name">${escapeHtml(respondent.name)}</h3>
              <div class="respondent-meta">
                ID: ${escapeHtml(String(respondent.id))}
                ${respondent.createdAt ? ` • Submitted: ${escapeHtml(formatDate(respondent.createdAt))}` : ""}
                ${respondent.status ? ` • Status: ${escapeHtml(respondent.status)}` : ""}
              </div>
            </div>

            <div class="winner-pill">
              Final Winner: ${respondent.finalWinner ? escapeHtml(normalizePaletteDisplayValue(respondent.finalWinner)) : "Not finished"}
            </div>
          </div>

          ${renderChoicesTable(respondent.choices)}
        </div>
      `;
    })
    .join("");
}

function renderChoicesTable(choices) {
  if (!choices.length) {
    return `<div class="muted">No matchup choices saved for this respondent.</div>`;
  }

  const rows = choices
    .map((choice) => {
      return `
        <tr>
          <td>${escapeHtml(choice.round || "")}</td>
          <td>${escapeHtml(choice.matchupLabel || "")}</td>
          <td>${escapeHtml(normalizePaletteDisplayValue(choice.optionA))}</td>
          <td>${escapeHtml(normalizePaletteDisplayValue(choice.optionB))}</td>
          <td><strong>${escapeHtml(normalizePaletteDisplayValue(choice.selected))}</strong></td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="choices-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Matchup</th>
            <th>Option A</th>
            <th>Option B</th>
            <th>Selected</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function normalizePaletteDisplayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const text = String(value).trim();

  if (text.startsWith("#")) {
    return `Palette ${text}`;
  }

  if (/^\d+$/.test(text)) {
    return `Palette #${text}`;
  }

  return text;
}

function getTopPaletteLabel(counts) {
  const entries = Object.entries(counts);

  if (!entries.length) {
    return "—";
  }

  entries.sort((a, b) => b[1] - a[1]);

  return entries[0][0];
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

async function clearResults() {
  const confirmed = window.confirm(
    "Clear all respondents and all saved matchup results?",
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(CLEAR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed with status ${response.status}`,
      );
    }

    showMessage(data.message || "Results cleared.");
    loadAdminResults();
  } catch (error) {
    console.error("Failed to clear results:", error);
    showMessage(`Could not clear results. ${error.message}`);
  }
}

function showLoadingState() {
  summarySection.innerHTML = `
    <div class="card"><div class="stat-label">Loading</div><div class="stat-value">...</div></div>
    <div class="card"><div class="stat-label">Loading</div><div class="stat-value">...</div></div>
    <div class="card"><div class="stat-label">Loading</div><div class="stat-value">...</div></div>
  `;

  paletteCounts.innerHTML = `<div class="muted">Loading winner totals...</div>`;
  respondentsContainer.innerHTML = `<div class="muted">Loading respondents...</div>`;
}

function showEmptyState(text) {
  summarySection.innerHTML = "";
  paletteCounts.innerHTML = "";
  respondentsContainer.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function showMessage(text) {
  messageBox.style.display = "block";
  messageBox.textContent = text;
}

function clearMessage() {
  messageBox.style.display = "none";
  messageBox.textContent = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
