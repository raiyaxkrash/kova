const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;

const appWindow = getCurrentWindow();

const state = {
  apps: [],
  releases: new Map(),
  progress: new Map(),
  busy: new Set(),
  kovaVersion: "0.1.0",
  kovaRelease: null,
  activeDrawerId: null,
};

const APP_ICONS = {
  "dynamic-island": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><line x1="12.5" y1="12" x2="16.5" y2="12"/></svg>`,
  "zapret2-rust": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 8.1-7 9.5-4-1.4-7-5-7-9.5V6l7-3z"/><path d="M9.5 12.2l1.8 1.8 3.6-3.8"/></svg>`,
  "swifttab": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="10" rx="2"/><path d="M8 16v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3"/></svg>`,
  "snapshot": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M20 8V6a2 2 0 0 0-2-2h-2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><circle cx="12" cy="12" r="3"/></svg>`,
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.round(bytes / 1024)} КБ`;
}

function compareSemver(a, b) {
  if (!a || !b) return 0;
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function hasUpdate(app, rel) {
  if (!app.installed || !rel || !rel.available || !rel.version || !app.installedVersion) {
    return false;
  }
  return compareSemver(rel.version, app.installedVersion) > 0;
}

function toast(msg, isError = false) {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = `toast${isError ? " error" : ""}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function renderApps() {
  const grid = document.getElementById("appsGrid");
  let runningCount = 0;
  let installedCount = 0;
  let updatesCount = 0;

  grid.innerHTML = state.apps
    .map((app) => {
      const rel = state.releases.get(app.id);
      const prog = state.progress.get(app.id);
      const isBusy = state.busy.has(app.id);
      const updateAvail = hasUpdate(app, rel);

      if (app.running) runningCount++;
      if (app.installed) installedCount++;
      if (updateAvail) updatesCount++;

      let statusClass = "missing";
      let statusLabel = "Не установлено";
      if (app.running) {
        statusClass = "running";
        statusLabel = "Работает";
      } else if (updateAvail) {
        statusClass = "update";
        statusLabel = "Обновление";
      } else if (app.installed) {
        statusClass = "installed";
        statusLabel = "Установлено";
      }

      let verChip = `<span class="meta-chip">Проверка...</span>`;
      if (rel) {
        if (updateAvail) {
          verChip = `<span class="meta-chip accent">v${escapeHtml(app.installedVersion)} → v${escapeHtml(rel.version)}</span>`;
        } else if (rel.available && rel.version) {
          verChip = `<span class="meta-chip">v${escapeHtml(rel.version)}</span>`;
        } else if (app.installedVersion) {
          verChip = `<span class="meta-chip">v${escapeHtml(app.installedVersion)}</span>`;
        } else {
          verChip = `<span class="meta-chip">Скоро релиз</span>`;
        }
      }

      const sizeChip =
        rel && rel.assetSize
          ? `<span class="meta-chip">${formatBytes(rel.assetSize)}</span>`
          : "";

      let primaryBtn = "";
      if (isBusy) {
        primaryBtn = `<button class="btn-secondary btn-primary-grow" disabled>Загрузка...</button>`;
      } else if (app.running) {
        primaryBtn = `<button class="btn-secondary btn-primary-grow" data-action="stop" data-id="${app.id}">Остановить</button>`;
      } else if (updateAvail && rel?.downloadUrl) {
        primaryBtn = `<button class="btn-accent btn-primary-grow" data-action="install" data-id="${app.id}">Обновить до v${escapeHtml(rel.version)}</button>`;
      } else if (app.installed) {
        primaryBtn = `<button class="btn-accent btn-primary-grow" data-action="launch" data-id="${app.id}">Запустить</button>`;
      } else if (rel?.available && rel?.downloadUrl) {
        primaryBtn = `<button class="btn-accent btn-primary-grow" data-action="install" data-id="${app.id}">Установить</button>`;
      } else {
        primaryBtn = `<button class="btn-secondary btn-primary-grow" data-action="github" data-id="${app.id}">Открыть GitHub ↗</button>`;
      }

      const progressHtml = prog
        ? `<div class="progress-wrap">
            <div class="progress-head">
              <span>${escapeHtml(prog.stage)}</span>
              <span class="mono">${prog.percent}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${prog.percent}%"></div>
            </div>
          </div>`
        : "";

      return `
        <article class="app-card" data-id="${app.id}">
          <div class="card-top">
            <div class="card-identity" data-action="details" data-id="${app.id}">
              <div class="app-icon-box" style="color:${app.accent}">${APP_ICONS[app.id] || ""}</div>
              <div class="card-title-group">
                <div class="card-title">${escapeHtml(app.name)}</div>
                <div class="card-category">${escapeHtml(app.category)}</div>
              </div>
            </div>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>

          <p class="card-tagline">${escapeHtml(app.tagline)}</p>

          <div class="card-meta">
            ${verChip}
            <span class="meta-chip">${escapeHtml(app.shortcut)}</span>
            ${sizeChip}
          </div>

          ${progressHtml}

          <div class="card-actions">
            ${primaryBtn}
            <button class="btn-ghost small" data-action="details" data-id="${app.id}" title="Подробнее и настройки">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  document.getElementById("runningSummary").textContent = `${runningCount} / ${state.apps.length}`;
  document.getElementById("installedSummary").textContent = `${installedCount} / ${state.apps.length}`;

  const updatesBadge = document.getElementById("updatesBadge");
  const updateAllBtn = document.getElementById("updateAllBtn");
  if (updatesCount > 0) {
    updatesBadge.hidden = false;
    updatesBadge.textContent = String(updatesCount);
    updateAllBtn.hidden = false;
    updateAllBtn.textContent = `Обновить все (${updatesCount})`;
  } else {
    updatesBadge.hidden = true;
    updateAllBtn.hidden = true;
  }

  renderAutostart();
  if (state.activeDrawerId) {
    populateDrawer(state.activeDrawerId);
  }
}

function renderAutostart() {
  const list = document.getElementById("autostartList");
  list.innerHTML = state.apps
    .map((app) => {
      const pathText = app.exePath || "Приложение ещё не установлено";
      return `
        <div class="autostart-row">
          <div class="autostart-info">
            <div class="app-icon-box" style="color:${app.accent}">${APP_ICONS[app.id] || ""}</div>
            <div>
              <div class="card-title">${escapeHtml(app.name)}</div>
              <div class="autostart-path">${escapeHtml(pathText)}</div>
            </div>
          </div>
          <label class="switch" title="${app.installed ? "Автозапуск с Windows" : "Сначала установите приложение"}">
            <input type="checkbox" data-autostart-id="${app.id}" ${app.autostart ? "checked" : ""} ${app.installed ? "" : "disabled"} />
            <span class="slider"></span>
          </label>
        </div>
      `;
    })
    .join("");
}

function populateDrawer(id) {
  const app = state.apps.find((a) => a.id === id);
  if (!app) return;
  const rel = state.releases.get(id);

  const iconEl = document.getElementById("drawerIcon");
  iconEl.style.color = app.accent;
  iconEl.innerHTML = APP_ICONS[id] || "";

  document.getElementById("drawerName").textContent = app.name;
  document.getElementById("drawerRepo").textContent = app.repo;
  document.getElementById("drawerDesc").textContent = app.description;

  document.getElementById("drawerFeatures").innerHTML = app.features
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join("");

  const notesWrap = document.getElementById("drawerNotesWrap");
  if (rel && rel.available && rel.notes) {
    notesWrap.hidden = false;
    document.getElementById("drawerReleaseTag").textContent = rel.tag || "";
    document.getElementById("drawerNotes").textContent = rel.notes.trim();
  } else {
    notesWrap.hidden = true;
  }

  document.getElementById("customPathInput").value = app.exePath || "";
  document.getElementById("drawerOpenFolderBtn").disabled = !app.exePath;
  document.getElementById("drawerUninstallBtn").hidden = !app.installed;
}

function openDrawer(id) {
  state.activeDrawerId = id;
  populateDrawer(id);
  document.getElementById("drawerBackdrop").hidden = false;
  document.getElementById("detailDrawer").classList.add("open");
}

function closeDrawer() {
  state.activeDrawerId = null;
  document.getElementById("drawerBackdrop").hidden = true;
  document.getElementById("detailDrawer").classList.remove("open");
}

async function refreshLocalState() {
  try {
    state.apps = await invoke("get_apps_state");
    renderApps();
  } catch (err) {
    toast(`Ошибка чтения состояния: ${err}`, true);
  }
}

async function refreshReleases(showToast = false) {
  const btn = document.getElementById("refreshBtn");
  btn.classList.add("spinning");
  try {
    const payload = await invoke("fetch_releases");
    state.kovaVersion = payload.kovaVersion;
    state.kovaRelease = payload.kovaRelease;
    for (const rel of payload.apps) {
      state.releases.set(rel.id, rel);
    }

    document.getElementById("kovaVersion").textContent = `v${state.kovaVersion}`;
    document.getElementById("aboutVersion").textContent = `v${state.kovaVersion}`;

    const noteEl = document.getElementById("kovaUpdateNote");
    if (payload.kovaRelease?.available && payload.kovaRelease.version) {
      if (compareSemver(payload.kovaRelease.version, state.kovaVersion) > 0) {
        noteEl.textContent = `Доступна новая версия Kova v${payload.kovaRelease.version} на GitHub`;
      } else {
        noteEl.textContent = "Установлена последняя версия Kova";
      }
    } else {
      noteEl.textContent = "Готов к публикациям на github.com/raiyaxkrash/kova";
    }

    renderApps();
    if (showToast) toast("Список релизов обновлён");
  } catch (err) {
    toast(`Не удалось проверить GitHub: ${err}`, true);
  } finally {
    btn.classList.remove("spinning");
  }
}

async function installApp(id) {
  const rel = state.releases.get(id);
  if (!rel || !rel.downloadUrl) {
    toast("У этого проекта ещё нет опубликованного релиза", true);
    return;
  }
  state.busy.add(id);
  renderApps();
  try {
    const msg = await invoke("install_or_update_app", {
      id,
      downloadUrl: rel.downloadUrl,
      isPortable: rel.isPortable,
      version: rel.version,
    });
    toast(msg);
  } catch (err) {
    toast(String(err), true);
  } finally {
    state.busy.delete(id);
    state.progress.delete(id);
    await refreshLocalState();
  }
}

async function handleAction(action, id) {
  const app = state.apps.find((a) => a.id === id);
  if (!app) return;

  if (action === "details") {
    openDrawer(id);
    return;
  }
  if (action === "github") {
    const rel = state.releases.get(id);
    await invoke("open_external", {
      target: rel?.releaseUrl || `https://github.com/${app.repo}`,
    });
    return;
  }
  if (action === "launch") {
    try {
      await invoke("launch_app", { id });
      toast(`${app.name} запущен`);
      setTimeout(refreshLocalState, 600);
    } catch (err) {
      toast(String(err), true);
    }
    return;
  }
  if (action === "stop") {
    try {
      await invoke("stop_app", { id });
      toast(`${app.name} остановлен`);
      setTimeout(refreshLocalState, 400);
    } catch (err) {
      toast(String(err), true);
    }
    return;
  }
  if (action === "install") {
    await installApp(id);
  }
}

function bindEvents() {
  document.getElementById("minBtn").addEventListener("click", () => appWindow.minimize());
  document.getElementById("closeBtn").addEventListener("click", () => appWindow.hide());
  document.getElementById("refreshBtn").addEventListener("click", () => {
    refreshLocalState();
    refreshReleases(true);
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    });
  });

  document.getElementById("appsGrid").addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    handleAction(target.dataset.action, target.dataset.id);
  });

  document.getElementById("autostartList").addEventListener("change", async (e) => {
    const input = e.target.closest("[data-autostart-id]");
    if (!input) return;
    const id = input.dataset.autostartId;
    try {
      await invoke("toggle_autostart", { id, enabled: input.checked });
      toast(input.checked ? "Автозапуск включён" : "Автозапуск отключён");
    } catch (err) {
      input.checked = !input.checked;
      toast(String(err), true);
    }
  });

  document.getElementById("launchAllBtn").addEventListener("click", async () => {
    const toLaunch = state.apps.filter((a) => a.installed && !a.running);
    if (toLaunch.length === 0) {
      toast("Все установленные утилиты уже запущены");
      return;
    }
    for (const app of toLaunch) {
      try {
        await invoke("launch_app", { id: app.id });
      } catch (err) {
        toast(`${app.name}: ${err}`, true);
      }
    }
    toast(`Запущено утилит: ${toLaunch.length}`);
    setTimeout(refreshLocalState, 700);
  });

  document.getElementById("updateAllBtn").addEventListener("click", async () => {
    const updatable = state.apps.filter((a) => hasUpdate(a, state.releases.get(a.id)));
    for (const app of updatable) {
      await installApp(app.id);
    }
  });

  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => invoke("open_external", { target: el.dataset.open }));
  });

  document.getElementById("openKovaDirBtn").addEventListener("click", async () => {
    const dir = await invoke("get_kova_dir");
    await invoke("open_external", { target: dir });
  });

  document.getElementById("drawerCloseBtn").addEventListener("click", closeDrawer);
  document.getElementById("drawerBackdrop").addEventListener("click", closeDrawer);

  document.getElementById("savePathBtn").addEventListener("click", async () => {
    if (!state.activeDrawerId) return;
    const path = document.getElementById("customPathInput").value;
    try {
      await invoke("set_custom_path", { id: state.activeDrawerId, path });
      toast("Путь сохранён");
      await refreshLocalState();
    } catch (err) {
      toast(String(err), true);
    }
  });

  document.getElementById("drawerOpenFolderBtn").addEventListener("click", async () => {
    const app = state.apps.find((a) => a.id === state.activeDrawerId);
    if (!app?.exePath) return;
    const folder = app.exePath.replace(/[\\/][^\\/]+$/, "");
    await invoke("open_external", { target: folder });
  });

  document.getElementById("drawerOpenGithubBtn").addEventListener("click", async () => {
    const app = state.apps.find((a) => a.id === state.activeDrawerId);
    if (!app) return;
    await invoke("open_external", { target: `https://github.com/${app.repo}` });
  });

  document.getElementById("drawerUninstallBtn").addEventListener("click", async () => {
    if (!state.activeDrawerId) return;
    try {
      const msg = await invoke("uninstall_app", { id: state.activeDrawerId });
      toast(msg);
      await refreshLocalState();
    } catch (err) {
      toast(String(err), true);
    }
  });
}

async function init() {
  bindEvents();

  await listen("download-progress", (event) => {
    const payload = event.payload;
    state.progress.set(payload.id, payload);
    renderApps();
  });

  try {
    const dir = await invoke("get_kova_dir");
    document.getElementById("kovaDirPath").textContent = dir;
  } catch (_) {}

  await refreshLocalState();
  refreshReleases(false);

  // Periodic live process status poll
  setInterval(refreshLocalState, 4000);
}

init();
