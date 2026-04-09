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
];

const elements = {
  statusText: document.getElementById("statusText"),
  refreshButton: document.getElementById("refreshButton"),
  facilityGrid: document.getElementById("facilityGrid"),
  lastUpdated: document.getElementById("lastUpdated"),

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
      createdAt: new Date().toISOString(),
    });

    saveToStorage(STORAGE_KEYS.reports, crowdReports);
    renderReports();
    elements.reportForm.reset();
  });

  elements.questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.questionText.value.trim();
    if (!text) return;

    questions.unshift({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      answers: [],
    });

    saveToStorage(STORAGE_KEYS.questions, questions);
    renderQuestions();
    elements.questionForm.reset();
  });
}

async function fetchAndRenderOccupancy() {
  elements.statusText.textContent = "Loading occupancy data…";

  try {
    const parsed = await fetchUCSCFacilities();
    facilities = parsed.length ? parsed : FALLBACK_FACILITIES;

    if (parsed.length) {
      elements.statusText.textContent = "Live occupancy loaded from UCSC source.";
    } else {
      elements.statusText.textContent =
        "Live parse returned no facilities. Showing fallback sample data.";
    }
  } catch {
    facilities = FALLBACK_FACILITIES;
    elements.statusText.textContent =
      "Could not read live occupancy (likely browser CORS restriction). Showing fallback sample data.";
  }

  renderFacilities();
  renderFacilityOptions();
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

  const tableRows = [...doc.querySelectorAll("tr")];
  const parsedRows = tableRows
    .map((row) => {
      const cells = [...row.querySelectorAll("td")].map((cell) =>
        cell.textContent?.trim()
      );
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

function renderFacilities() {
  elements.facilityGrid.innerHTML = "";

  facilities.forEach((facility) => {
    const item = document.createElement("article");
    item.className = "facility-item";

    const badgeType =
      facility.percent < 45
        ? "badge-ok"
        : facility.percent < 75
        ? "badge-busy"
        : "badge-packed";

    const badgeText =
      facility.percent < 45 ? "Open" : facility.percent < 75 ? "Busy" : "Packed";

    item.innerHTML = `
      <div class="top">
        <span>${escapeHtml(facility.name)}</span>
        <span class="badge ${badgeType}">${badgeText}</span>
      </div>
      <div>${facility.percent}% occupied</div>
    `;

    elements.facilityGrid.appendChild(item);
  });
}

function renderFacilityOptions() {
  elements.reportFacility.innerHTML = facilities
    .map(
      (facility) =>
        `<option value="${escapeHtml(facility.name)}">${escapeHtml(facility.name)}</option>`
    )
    .join("");
}

function hydrateCommunityContent() {
  renderReports();
  renderQuestions();
}

function renderReports() {
  elements.reportList.innerHTML = "";

  if (!crowdReports.length) {
    elements.reportList.innerHTML =
      "<li>No reports yet — be the first person to share current line times.</li>";
    return;
  }

  crowdReports.forEach((report) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${escapeHtml(report.facility)}</strong>
      <div>Line: ${escapeHtml(report.lineLength)}</div>
      ${report.notes ? `<div>Note: ${escapeHtml(report.notes)}</div>` : ""}
      <div class="muted small">${formatTimeAgo(report.createdAt)}</div>
    `;
    elements.reportList.appendChild(li);
  });
}

function renderQuestions() {
  elements.questionList.innerHTML = "";

  if (!questions.length) {
    elements.questionList.innerHTML =
      "<li>No questions yet — ask if a court or room is open.</li>";
    return;
  }

  questions.forEach((question) => {
    const fragment = elements.questionItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".question-item");

    fragment.querySelector(
      ".question-header"
    ).textContent = `Asked ${formatTimeAgo(question.createdAt)}`;
    fragment.querySelector(".question-text").textContent = question.text;

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
    });

    elements.questionList.appendChild(fragment);
  });
}

function formatTimeAgo(dateLike) {
  const now = Date.now();
  const then = new Date(dateLike).getTime();
  const diffMs = Math.max(0, now - then);

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
