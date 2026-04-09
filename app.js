const STORAGE_KEYS = {
  reports: "crowdapp_reports",
  questions: "crowdapp_questions",
};

const FALLBACK_FACILITIES = [
  { name: "East Field House", percent: 35 },
  { name: "West Field House", percent: 62 },
  { name: "Cardio Room", percent: 74 },
  { name: "Main Weight Room", percent: 81 },
  { name: "Basketball Courts", percent: 48 },
  { name: "Volleyball Court", percent: 40 },
];

const CLOSING_SCHEDULES = {
  "Main Weight Room": { weekday: "10:30 PM", weekend: "8:00 PM" },
  "Cardio Room": { weekday: "10:00 PM", weekend: "8:00 PM" },
  "Basketball Courts": { weekday: "10:00 PM", weekend: "7:00 PM" },
  "Volleyball Court": { weekday: "9:30 PM", weekend: "7:00 PM" },
  "East Field House": { weekday: "9:00 PM", weekend: "6:00 PM" },
  "West Field House": { weekday: "9:00 PM", weekend: "6:00 PM" },
};

const elements = {
  statusText: document.getElementById("statusText"),
  refreshButton: document.getElementById("refreshButton"),
  facilityGrid: document.getElementById("facilityGrid"),
  lastUpdated: document.getElementById("lastUpdated"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  statsRow: document.getElementById("statsRow"),

  reportForm: document.getElementById("reportForm"),
  reportFacility: document.getElementById("reportFacility"),
  lineLength: document.getElementById("lineLength"),
  reportNotes: document.getElementById("reportNotes"),
  reportList: document.getElementById("reportList"),

  questionForm: document.getElementById("questionForm"),
  questionText: document.getElementById("questionText"),
  questionList: document.getElementById("questionList"),
  questionItemTemplate: document.getElementById("questionItemTemplate"),
};

let facilities = [];
let crowdReports = loadFromStorage(STORAGE_KEYS.reports, []);
let questions = loadFromStorage(STORAGE_KEYS.questions, []);

boot();

function boot() {
  bindEvents();
  hydrateCommunityContent();
  fetchAndRenderOccupancy();
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", fetchAndRenderOccupancy);
  elements.searchInput.addEventListener("input", renderFacilities);
  elements.sortSelect.addEventListener("change", renderFacilities);

  elements.reportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const facility = elements.reportFacility.value;
    const lineLength = elements.lineLength.value.trim();
    const notes = elements.reportNotes.value.trim();

    if (!facility || !lineLength) return;

    crowdReports.unshift({
      id: crypto.randomUUID(),
      facility,
      lineLength,
      notes,
      likes: 0,
      createdAt: new Date().toISOString(),
    });

    saveToStorage(STORAGE_KEYS.reports, crowdReports);
    renderReports();
    renderStats();
    elements.reportForm.reset();
  });

  elements.questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.questionText.value.trim();
    if (!text) return;

    questions.unshift({
      id: crypto.randomUUID(),
      text,
      likes: 0,
      createdAt: new Date().toISOString(),
      answers: [],
    });

    saveToStorage(STORAGE_KEYS.questions, questions);
    renderQuestions();
    renderStats();
    elements.questionForm.reset();
  });
}

async function fetchAndRenderOccupancy() {
  elements.statusText.textContent = "Loading occupancy data…";

  try {
    const parsed = await fetchUCSCFacilities();
    facilities = parsed.length ? parsed : FALLBACK_FACILITIES;

    elements.statusText.textContent = parsed.length
      ? "Live occupancy loaded from UCSC source."
      : "Live parse returned no facilities. Showing fallback sample data.";
  } catch {
    facilities = FALLBACK_FACILITIES;
    elements.statusText.textContent =
      "Could not read live occupancy (likely CORS/proxy restriction). Showing fallback sample data.";
  }

  renderFacilities();
  renderFacilityOptions();
  renderStats();
  elements.lastUpdated.textContent = `Updated ${new Date().toLocaleString()}`;
}

async function fetchUCSCFacilities() {
  const target = "https://campusrec.ucsc.edu/FacilityOccupancy";
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;

  const response = await fetch(proxy, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Occupancy fetch failed (${response.status})`);

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const parsedRows = [...doc.querySelectorAll("tr")]
    .map((row) => {
      const cells = [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim());
      if (cells.length < 2) return null;

      const facilityName = cells[0];
      const percentMatch = cells.join(" ").match(/(\d{1,3})\s*%/);
      if (!facilityName || !percentMatch) return null;

      return {
        name: facilityName,
        percent: Math.max(0, Math.min(100, Number(percentMatch[1]))),
      };
    })
    .filter(Boolean);

  return parsedRows;
}

function getFilteredFacilities() {
  const q = elements.searchInput.value.trim().toLowerCase();
  const sort = elements.sortSelect.value;

  const filtered = facilities.filter((facility) => facility.name.toLowerCase().includes(q));

  const sorters = {
    "crowd-asc": (a, b) => a.percent - b.percent,
    "crowd-desc": (a, b) => b.percent - a.percent,
    "name-asc": (a, b) => a.name.localeCompare(b.name),
  };

  return filtered.sort(sorters[sort]);
}

function renderFacilities() {
  const visibleFacilities = getFilteredFacilities();

  elements.facilityGrid.innerHTML = "";

  if (!visibleFacilities.length) {
    elements.facilityGrid.innerHTML = "<p class='muted'>No facilities match your search.</p>";
    return;
  }

  visibleFacilities.forEach((facility) => {
    const status = getStatusForPercent(facility.percent);
    const closingText = getClosingTimeLabel(facility.name);

    const card = document.createElement("article");
    card.className = "facility-card";

    card.innerHTML = `
      <div class="facility-top">
        <span class="facility-name">${escapeHtml(facility.name)}</span>
        <span class="pill ${status.className}">${status.label}</span>
      </div>

      <div class="circle" style="--value:${facility.percent}; --meter:${status.color};">
        <span class="circle-value">${facility.percent}%</span>
      </div>

      <div class="facility-meta">
        <span><strong>Crowd:</strong> ${status.description}</span>
        <span><strong>Closing:</strong> ${closingText}</span>
      </div>

      <div class="card-actions">
        <button class="button small" data-action="report" data-facility="${escapeHtml(facility.name)}">Report line</button>
        <button class="button small ghost" data-action="ask" data-facility="${escapeHtml(facility.name)}">Ask if open</button>
      </div>
    `;

    card.querySelector('[data-action="report"]').addEventListener("click", () => {
      elements.reportFacility.value = facility.name;
      elements.lineLength.focus();
    });

    card.querySelector('[data-action="ask"]').addEventListener("click", () => {
      elements.questionText.value = `Is ${facility.name} open right now?`;
      elements.questionText.focus();
    });

    elements.facilityGrid.appendChild(card);
  });
}

function renderFacilityOptions() {
  elements.reportFacility.innerHTML = facilities
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (facility) =>
        `<option value="${escapeHtml(facility.name)}">${escapeHtml(facility.name)}</option>`
    )
    .join("");
}

function renderStats() {
  const avgCrowd = facilities.length
    ? Math.round(facilities.reduce((sum, item) => sum + item.percent, 0) / facilities.length)
    : 0;

  const openFacilities = facilities.filter((item) => item.percent < 45).length;

  const statItems = [
    ["Avg crowd", `${avgCrowd}%`],
    ["Open spots", `${openFacilities}`],
    ["Line reports", `${crowdReports.length}`],
    ["Questions", `${questions.length}`],
  ];

  elements.statsRow.innerHTML = statItems
    .map(([label, value]) => `<div class="stat-pill"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function hydrateCommunityContent() {
  renderReports();
  renderQuestions();
  renderStats();
}

function renderReports() {
  elements.reportList.innerHTML = "";

  if (!crowdReports.length) {
    elements.reportList.innerHTML =
      "<li>No reports yet — share how long the line is at your current spot.</li>";
    return;
  }

  crowdReports.forEach((report) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${escapeHtml(report.facility)}</strong>
      <div>Line wait: ${escapeHtml(report.lineLength)}</div>
      ${report.notes ? `<div>Note: ${escapeHtml(report.notes)}</div>` : ""}
      <div class="muted small">${formatTimeAgo(report.createdAt)}</div>
      <div class="reaction-row">
        <button class="button small" data-like-report="${report.id}">👍 Helpful (${report.likes ?? 0})</button>
      </div>
    `;

    li.querySelector("[data-like-report]").addEventListener("click", () => {
      report.likes = (report.likes ?? 0) + 1;
      saveToStorage(STORAGE_KEYS.reports, crowdReports);
      renderReports();
    });

    elements.reportList.appendChild(li);
  });
}

function renderQuestions() {
  elements.questionList.innerHTML = "";

  if (!questions.length) {
    elements.questionList.innerHTML = "<li>No questions yet — ask what area is open.</li>";
    return;
  }

  questions.forEach((question) => {
    const fragment = elements.questionItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".question-item");

    fragment.querySelector(".question-header").textContent = `Asked ${formatTimeAgo(
      question.createdAt
    )}`;
    fragment.querySelector(".question-text").textContent = question.text;

    const likeButton = document.createElement("button");
    likeButton.className = "button small";
    likeButton.textContent = `👍 Helpful (${question.likes ?? 0})`;

    const reactionRow = document.createElement("div");
    reactionRow.className = "reaction-row";
    reactionRow.appendChild(likeButton);
    item.insertBefore(reactionRow, item.querySelector(".answer-form"));

    likeButton.addEventListener("click", () => {
      question.likes = (question.likes ?? 0) + 1;
      saveToStorage(STORAGE_KEYS.questions, questions);
      renderQuestions();
    });

    const answersList = fragment.querySelector(".answers");
    if (!question.answers.length) {
      const empty = document.createElement("li");
      empty.textContent = "No replies yet.";
      answersList.appendChild(empty);
    } else {
      question.answers.forEach((answer) => {
        const li = document.createElement("li");
        li.textContent = `${answer.text} • ${formatTimeAgo(answer.createdAt)}`;
        answersList.appendChild(li);
      });
    }

    fragment.querySelector(".answer-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = item.querySelector(".answer-input");
      const value = input.value.trim();
      if (!value) return;

      const target = questions.find((entry) => entry.id === question.id);
      if (!target) return;

      target.answers.unshift({
        id: crypto.randomUUID(),
        text: value,
        createdAt: new Date().toISOString(),
      });

      saveToStorage(STORAGE_KEYS.questions, questions);
      renderQuestions();
      renderStats();
    });

    elements.questionList.appendChild(fragment);
  });
}

function getStatusForPercent(percent) {
  if (percent < 45) {
    return {
      label: "Open",
      className: "open",
      description: "Plenty of space",
      color: "#34d399",
    };
  }

  if (percent < 75) {
    return {
      label: "Busy",
      className: "busy",
      description: "Moderate crowd",
      color: "#fbbf24",
    };
  }

  return {
    label: "Packed",
    className: "packed",
    description: "Expect waits",
    color: "#fb7185",
  };
}

function getClosingTimeLabel(facilityName) {
  const today = new Date().getDay();
  const isWeekend = today === 0 || today === 6;
  const matchedKey = Object.keys(CLOSING_SCHEDULES).find((name) =>
    facilityName.toLowerCase().includes(name.toLowerCase())
  );

  if (!matchedKey) return isWeekend ? "8:00 PM (est.)" : "10:00 PM (est.)";

  const schedule = CLOSING_SCHEDULES[matchedKey];
  return isWeekend ? schedule.weekend : schedule.weekday;
}

function formatTimeAgo(dateLike) {
  const diffMs = Math.max(0, Date.now() - new Date(dateLike).getTime());
  const minute = 60_000;
  const hour = minute * 60;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  return `${Math.floor(diffMs / hour)}h ago`;
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
