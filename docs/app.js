const APPS = [
  {
    id: "dynamic-island",
    name: "Dynamic Island",
    repo: "raiyaxkrash/dynamic-island",
    category: "Интерфейс · 60 FPS",
    accent: "#E2E8F0",
    short: "Медиа, звук в 1 клик, полка файлов и помодоро",
    description:
      "Нативный Dynamic Island для Windows 10/11 на Rust + Tauri 2 (1.26 МБ): управление музыкой и громкостью, полка файлов Drag & Drop, буфер обмена и таймер помодоро.",
    features: ["1.26 МБ без Electron", "Полка файлов", "Буфер обмена", "Помодоро"],
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><line x1="12.5" y1="12" x2="16.5" y2="12"/></svg>`,
  },
  {
    id: "zapret2-rust",
    name: "Zapret2 GUI",
    repo: "raiyaxkrash/zapret2-rust",
    category: "Сеть · Rust",
    accent: "#4ADE80",
    short: "YouTube, Discord и Telegram одной кнопкой",
    description:
      "Графическая оболочка для zapret2 с автоматическим подбором рабочей стратегии, сторожем соединения, встроенной диагностикой и прокси-туннелем для Telegram.",
    features: ["Автоподбор стратегии", "Сторож и диагностика", "Прокси для Telegram", "1 клик"],
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 8.1-7 9.5-4-1.4-7-5-7-9.5V6l7-3z"/><path d="M9.5 12.2l1.8 1.8 3.6-3.8"/></svg>`,
  },
  {
    id: "swifttab",
    name: "SwiftTab",
    repo: "raiyaxkrash/swifttab",
    category: "Окна · Alt+Tab",
    accent: "#60A5FA",
    short: "Живые превью окон и мгновенный поиск",
    description:
      "Современный легковесный Alt+Tab переключатель окон на Rust + Tauri 2 + Win32. Живые миниатюры окон, нативные иконки и закреплённый поиск по Alt+Space.",
    features: ["Alt + Tab / Alt + Space", "Живые миниатюры", "Быстрое закрытие окон", "Системный трей"],
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="10" rx="2"/><path d="M8 16v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3"/></svg>`,
  },
  {
    id: "snapshot",
    name: "SnapShot",
    repo: "raiyaxkrash/snapshot",
    category: "Захват экрана · OCR",
    accent: "#F59E0B",
    short: "Скриншоты 1:1 DPI, Beautify и оффлайн OCR",
    description:
      "Мгновенный скриншотер по PrintScreen: редактор со стрелками и размытием паролей, оформление Beautify в стиле CleanShot X и оффлайн OCR (RU + EN) на WinRT.",
    features: ["PrintScreen 1:1 DPI", "Размытие паролей", "Beautify в 1 клик", "Оффлайн OCR RU/EN"],
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M20 8V6a2 2 0 0 0-2-2h-2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
];

const releaseCache = new Map();

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
  const grid = document.getElementById("mockupGrid");
  grid.innerHTML = APPS.map((app) => {
    const rel = releaseCache.get(app.id);
    const ver = rel?.tag || "v0.1.0";
    return `
      <div class="mini-card">
        <div class="mini-top">
          <span class="mini-name">${app.name}</span>
          <span class="mini-dot" style="background:${app.accent}"></span>
        </div>
        <div class="mini-sub">${app.short}</div>
        <div class="mini-foot">
          <span class="mono">${ver}</span>
          <span class="mini-btn">Запуск</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderBento() {
  const grid = document.getElementById("bentoGrid");
  grid.innerHTML = APPS.map((app) => {
    const rel = releaseCache.get(app.id);
    const badgeText = rel?.tag || "Скоро релиз";
    const badgeClass = rel?.tag ? "ver-badge live" : "ver-badge";
    const dlHref = rel?.downloadUrl || `https://github.com/${app.repo}`;
    const dlLabel = rel?.hasAsset ? "Скачать .exe" : "Открыть репозиторий";
    const sizeText = rel?.size ? formatBytes(rel.size) : "";

    return `
      <article class="app-bento">
        <div class="bento-top">
          <div class="bento-id">
            <div class="bento-icon" style="color:${app.accent}">${app.icon}</div>
            <div>
              <div class="bento-name">${app.name}</div>
              <div class="bento-cat">${app.category}</div>
            </div>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>

        <p class="bento-desc">${app.description}</p>

        <div class="bento-features">
          ${app.features.map((f) => `<span class="feat-chip">${f}</span>`).join("")}
        </div>

        <div class="bento-actions">
          <a class="bento-dl" href="${dlHref}" target="_blank" rel="noreferrer">${dlLabel}</a>
          <a class="bento-gh" href="https://github.com/${app.repo}" target="_blank" rel="noreferrer">GitHub ↗</a>
          ${sizeText ? `<span class="bento-size mono">${sizeText}</span>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function hydrate() {
  renderMockup();
  renderBento();

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
  renderBento();
}

hydrate();
