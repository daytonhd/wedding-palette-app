const palettes = [
  { id: "#1", label: "Palette #1", imagePath: "/images/1.png" },
  { id: "#2", label: "Palette #2", imagePath: "/images/2.png" },
  { id: "#3", label: "Palette #3", imagePath: "/images/3.png" },
  { id: "#4", label: "Palette #4", imagePath: "/images/4.png" },
  { id: "#5", label: "Palette #5", imagePath: "/images/5.png" },
  { id: "#6", label: "Palette #6", imagePath: "/images/6.png" },
];

const state = {
  respondentId: null,
  respondentName: "",
  winners: {
    matchupA: null,
    matchupB: null,
    matchupC: null,
    matchupD: null,
    matchupE: null,
  },
  currentMatchup: null,
};

const startScreen = document.getElementById("startScreen");
const matchupScreen = document.getElementById("matchupScreen");
const resultScreen = document.getElementById("resultScreen");

const nameInput = document.getElementById("nameInput");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const respondentNameDisplay = document.getElementById("respondentNameDisplay");
const roundDisplay = document.getElementById("roundDisplay");
const matchupTitle = document.getElementById("matchupTitle");

const leftChoiceButton = document.getElementById("leftChoiceButton");
const rightChoiceButton = document.getElementById("rightChoiceButton");
const leftPaletteImage = document.getElementById("leftPaletteImage");
const rightPaletteImage = document.getElementById("rightPaletteImage");
const leftPaletteLabel = document.getElementById("leftPaletteLabel");
const rightPaletteLabel = document.getElementById("rightPaletteLabel");

const winnerImage = document.getElementById("winnerImage");
const winnerLabel = document.getElementById("winnerLabel");

const statusOutput = document.getElementById("statusOutput");

function setStatus(value) {
  const outputValue =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  if (!statusOutput) {
    return;
  }

  statusOutput.textContent = outputValue;
}

function showScreen(screenName) {
  const screens = {
    start: startScreen,
    matchup: matchupScreen,
    result: resultScreen,
  };

  Object.values(screens).forEach((element) => {
    element.classList.add("hidden");
  });

  screens[screenName].classList.remove("hidden");
}

function getPaletteById(paletteId) {
  const palette = palettes.find((item) => item.id === paletteId);

  if (!palette) {
    throw new Error(`Palette not found: ${paletteId}`);
  }

  return palette;
}

function buildCurrentMatchup() {
  const matchupDefinitions = [
    {
      key: "matchupA",
      roundName: "Round 1",
      matchupKey: "matchup_a",
      leftPaletteId: "#1",
      rightPaletteId: "#2",
    },
    {
      key: "matchupB",
      roundName: "Round 1",
      matchupKey: "matchup_b",
      leftPaletteId: "#3",
      rightPaletteId: "#4",
    },
    {
      key: "matchupC",
      roundName: "Round 1",
      matchupKey: "matchup_c",
      leftPaletteId: "#5",
      rightPaletteId: "#6",
    },
  ];

  for (const matchup of matchupDefinitions) {
    const winner = state.winners[matchup.key];

    if (!winner) {
      return matchup;
    }
  }

  if (!state.winners.matchupD) {
    return {
      key: "matchupD",
      roundName: "Semi-Final",
      matchupKey: "matchup_d",
      leftPaletteId: state.winners.matchupA,
      rightPaletteId: state.winners.matchupB,
    };
  }

  if (!state.winners.matchupE) {
    return {
      key: "matchupE",
      roundName: "Final",
      matchupKey: "matchup_e",
      leftPaletteId: state.winners.matchupD,
      rightPaletteId: state.winners.matchupC,
    };
  }

  return null;
}

function renderMatchup() {
  const currentMatchup = buildCurrentMatchup();

  state.currentMatchup = currentMatchup;

  if (!currentMatchup) {
    renderFinalWinner();
    return;
  }

  const leftPalette = getPaletteById(currentMatchup.leftPaletteId);
  const rightPalette = getPaletteById(currentMatchup.rightPaletteId);

  respondentNameDisplay.textContent = state.respondentName;
  roundDisplay.textContent = currentMatchup.roundName;
  matchupTitle.textContent = `${leftPalette.label} vs ${rightPalette.label}`;

  leftPaletteImage.src = leftPalette.imagePath;
  leftPaletteImage.alt = leftPalette.label;
  leftPaletteLabel.textContent = leftPalette.label;

  rightPaletteImage.src = rightPalette.imagePath;
  rightPaletteImage.alt = rightPalette.label;
  rightPaletteLabel.textContent = rightPalette.label;

  showScreen("matchup");
}

async function createRespondent() {
  const name = nameInput.value.trim();

  if (!name) {
    setStatus("Name is required.");
    return;
  }

  const payload = { name };

  const response = await fetch("/api/respondents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data);
    return;
  }

  state.respondentId = data.respondentId;
  state.respondentName = data.name;
  state.winners = {
    matchupA: null,
    matchupB: null,
    matchupC: null,
    matchupD: null,
    matchupE: null,
  };

  setStatus({
    message: "Respondent created",
    respondent: data,
  });

  renderMatchup();
}

async function saveMatchupSelection(selectedPaletteId) {
  const respondentId = state.respondentId;
  const currentMatchup = state.currentMatchup;

  if (!respondentId) {
    setStatus("Respondent not created.");
    return;
  }

  if (!currentMatchup) {
    setStatus("No active matchup.");
    return;
  }

  const payload = {
    roundName: currentMatchup.roundName,
    matchupKey: currentMatchup.matchupKey,
    leftPaletteId: currentMatchup.leftPaletteId,
    rightPaletteId: currentMatchup.rightPaletteId,
    selectedPaletteId,
  };

  const response = await fetch(`/api/respondents/${respondentId}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data);
    return;
  }

  state.winners[currentMatchup.key] = selectedPaletteId;

  setStatus({
    message: "Response saved",
    savedResponse: data,
    winners: state.winners,
  });

  const nextMatchup = buildCurrentMatchup();

  if (!nextMatchup) {
    await finalizeWinner(state.winners.matchupE);
    return;
  }

  renderMatchup();
}

async function finalizeWinner(finalWinnerPaletteId) {
  const respondentId = state.respondentId;

  if (!respondentId) {
    setStatus("Respondent not created.");
    return;
  }

  const payload = {
    finalWinnerPaletteId,
  };

  const response = await fetch(`/api/respondents/${respondentId}/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data);
    return;
  }

  setStatus({
    message: "Winner finalized",
    respondent: data,
    winners: state.winners,
  });

  renderFinalWinner();
}

function renderFinalWinner() {
  const finalWinnerPaletteId = state.winners.matchupE;
  const finalWinnerPalette = getPaletteById(finalWinnerPaletteId);

  winnerImage.src = finalWinnerPalette.imagePath;
  winnerImage.alt = finalWinnerPalette.label;
  winnerLabel.textContent = finalWinnerPalette.label;

  showScreen("result");
}

function resetApp() {
  state.respondentId = null;
  state.respondentName = "";
  state.currentMatchup = null;
  state.winners = {
    matchupA: null,
    matchupB: null,
    matchupC: null,
    matchupD: null,
    matchupE: null,
  };

  nameInput.value = "";
  setStatus("");
  showScreen("start");
}

function handleLeftChoice() {
  const currentMatchup = state.currentMatchup;
  const selectedPaletteId = currentMatchup.leftPaletteId;

  saveMatchupSelection(selectedPaletteId);
}

function handleRightChoice() {
  const currentMatchup = state.currentMatchup;
  const selectedPaletteId = currentMatchup.rightPaletteId;

  saveMatchupSelection(selectedPaletteId);
}

startButton.addEventListener("click", createRespondent);
leftChoiceButton.addEventListener("click", handleLeftChoice);
rightChoiceButton.addEventListener("click", handleRightChoice);
restartButton.addEventListener("click", resetApp);

resetApp();
