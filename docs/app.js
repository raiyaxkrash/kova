const APPS = [
  {
    id: "dynamic-island",
    name: "Dynamic Island",
    repo: "raiyaxkrash/dynamic-island",
    category: "Интерфейс",
    shortcut: "Верх экрана",
    short: "Медиа, звук в 1 клик, полка файлов и помодоро",
    description:
      "Нативный Dynamic Island для Windows 10/11 на Rust и Tauri 2 (1.26 МБ): управление музыкой и громкостью, полка файлов Drag & Drop, буфер обмена и таймер помодоро.",
    features: ["1.26 МБ без Electron", "Полка файлов", "Буфер обмена", "60 FPS"],
    running: true,
    autostart: true,
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><line x1="12.5" y1="12" x2="16.5" y2="12"/></svg>`,
  },
  {
    id: "zapret2-rust",
    name: "Zapret2 GUI",
    repo: "raiyaxkrash/zapret2-rust",
    category: "Сеть",
    shortcut: "1 клик",
    short: "YouTube, Discord и Telegram с автоподбором стратегии",
    description:
      "Графическая оболочка для zapret2 с автоматическим подбором рабочей стратегии, сторожем соединения, встроенной диагностикой и прокси-туннелем для Telegram.",
    features: ["Автоподбор стратегии", "Сторож и диагностика", "Прокси Telegram"],
    running: true,
    autostart: true,
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 8.1-7 9.5-4-1.4-7-5-7-9.5V6l7-3z"/><path d="M9.5 12.2l1.8 1.8 3.6-3.8"/></svg>`,
  },
  {
    id: "snapshot",
    name: "SnapShot",
    repo: "raiyaxkrash/snapshot",
    category: "Захват экрана",
    shortcut: "PrintScreen",
    short: "Скриншоты 1:1 DPI, Beautify и оффлайн OCR",
    description:
      "Мгновенный скриншотер по PrintScreen: редактор со стрелками и размытием паролей, оформление Beautify в стиле CleanShot X и оффлайн OCR (RU + EN) на WinRT.",
    features: ["1:1 DPI + блюр паролей", "Beautify в 1 клик", "Оффлайн OCR RU/EN"],
    running: false,
    autostart: false,
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M20 8V6a2 2 0 0 0-2-2h-2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
];

const releaseCache = new Map();
let mockTab = "apps";

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.round(bytes / 1024)} КБ`;
}

function pickAsset(assets = []) {
  return (
    assets.find((a) => /setup\.exe$/i.test(a.name)) ||
    assets.find((a) => /portable\.exe$/i.test(a.name)) ||
    assets.find((a) => /\.exe$/i.test(a.name)) ||
    null
  );
}

async function fetchRelease(repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const asset = pickAsset(data.assets);
    return {
      tag: data.tag_name,
      url: data.html_url,
      downloadUrl: asset?.browser_download_url || data.html_url,
      size: asset?.size || 0,
      hasAsset: Boolean(asset),
    };
  } catch {
    return null;
  }
}

function renderMockup() {
  const stage = document.getElementById("mockupStage");
  const activeCount = APPS.filter((a) => a.running).length;
  document.getElementById("mockActiveCount").textContent = `${activeCount} / ${APPS.length}`;

  if (mockTab === "apps") {
    stage.innerHTML = `<div class="mock-grid">${APPS.map((app) => {
      const rel = releaseCache.get(app.id);
      const ver = rel?.tag || "v0.1.0";
      return `
        <div class="mock-card">
          <div class="mock-top">
            <span class="mock-name">${app.name}</span>
            <span class="mock-dot ${app.running ? "on" : ""}" title="${app.running ? "Работает" : "Остановлено"}"></span>
          </div>
          <div class="mock-sub">${app.short}</div>
          <div class="mock-foot">
            <span class="mock-ver mono">${ver}</span>
            <button class="mock-btn ${app.running ? "" : "primary"}" data-mock-toggle="${app.id}" type="button">
              ${app.running ? "Стоп" : "Запуск"}
            </button>
          </div>
        </div>
      `;
    }).join("")}</div>`;
  } else {
    stage.innerHTML = `<div class="mock-list">${APPS.map(
      (app) => `
      <div class="mock-list-row">
        <span>${app.name}</span>
        <button class="mock-toggle ${app.autostart ? "on" : ""}" data-mock-auto="${app.id}" type="button" aria-label="Автозапуск ${app.name}"></button>
      </div>
    `
    ).join("")}</div>`;
  }
}

function renderCatalog() {
  const grid = document.getElementById("bentoGrid");
  grid.innerHTML = APPS.map((app) => {
    const rel = releaseCache.get(app.id);
    const verText = rel?.tag || "Скоро релиз";
    const verClass = rel?.tag ? "mono card-ver-live" : "mono";
    const dlHref = rel?.downloadUrl || `https://github.com/${app.repo}`;
    const dlLabel = rel?.hasAsset ? "Скачать .exe" : "Открыть репозиторий";
    const sizeText = rel?.size ? formatBytes(rel.size) : "";

    return `
      <article class="app-card">
        <div class="card-top">
          <div class="card-id">
            <div class="card-icon">${app.icon}</div>
            <div>
              <div class="card-name">${app.name}</div>
              <div class="card-cat">${app.category}</div>
            </div>
          </div>
          <div class="card-right">
            <kbd class="keycap">${app.shortcut}</kbd>
          </div>
        </div>

        <p class="card-desc">${app.description}</p>

        <div class="card-features">${app.features.join(" · ")}</div>

        <div class="card-actions">
          <a class="card-dl" href="${dlHref}" target="_blank" rel="noreferrer">${dlLabel}</a>
          <a class="card-gh" href="https://github.com/${app.repo}" target="_blank" rel="noreferrer">GitHub ↗</a>
          <div class="card-meta-right">
            <span class="${verClass}">${verText}</span>
            ${sizeText ? `<span>·</span><span class="mono">${sizeText}</span>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function bindPreviewInteractions() {
  document.querySelectorAll("[data-mock-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mockTab = btn.dataset.mockTab;
      document.querySelectorAll("[data-mock-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderMockup();
    });
  });

  document.getElementById("mockupStage").addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-mock-toggle]");
    if (toggleBtn) {
      const app = APPS.find((a) => a.id === toggleBtn.dataset.mockToggle);
      if (app) {
        app.running = !app.running;
        renderMockup();
      }
      return;
    }
    const autoBtn = e.target.closest("[data-mock-auto]");
    if (autoBtn) {
      const app = APPS.find((a) => a.id === autoBtn.dataset.mockAuto);
      if (app) {
        app.autostart = !app.autostart;
        renderMockup();
      }
    }
  });
}

async function hydrate() {
  bindPreviewInteractions();
  renderMockup();
  renderCatalog();

  const [kovaRel, ...appRels] = await Promise.all([
    fetchRelease("raiyaxkrash/kova"),
    ...APPS.map((a) => fetchRelease(a.repo)),
  ]);

  if (kovaRel) {
    document.getElementById("heroKovaVersion").textContent = kovaRel.tag;
    document.getElementById("mockVer").textContent = kovaRel.tag;
    const dlBtn = document.getElementById("heroDownloadBtn");
    const dlLbl = document.getElementById("heroDownloadLabel");
    dlBtn.href = kovaRel.downloadUrl;
    dlLbl.textContent = kovaRel.size
      ? `Скачать Kova ${kovaRel.tag} (${formatBytes(kovaRel.size)})`
      : `Скачать Kova ${kovaRel.tag}`;
  }

  APPS.forEach((app, idx) => {
    if (appRels[idx]) releaseCache.set(app.id, appRels[idx]);
  });

  renderMockup();
  renderCatalog();
}

hydrate();
