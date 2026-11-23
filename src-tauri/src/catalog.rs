use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub repo: &'static str,
    pub category: &'static str,
    pub tagline: &'static str,
    pub description: &'static str,
    pub shortcut: &'static str,
    pub accent: &'static str,
    pub features: &'static [&'static str],
    pub exe_names: &'static [&'static str],
    pub managed_exe: &'static str,
    pub install_dir_hints: &'static [&'static str],
    pub autostart_key: &'static str,
    pub dev_path_hint: &'static str,
}

pub const KOVA_REPO: &str = "raiyaxkrash/kova";
pub const KOVA_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const APPS: &[AppSpec] = &[
    AppSpec {
        id: "dynamic-island",
        name: "Dynamic Island",
        repo: "raiyaxkrash/dynamic-island",
        category: "Интерфейс",
        tagline: "Нативный остров для Windows 10/11 на 60 FPS",
        description: "Медиа-плеер, управление громкостью в 1 клик, полка файлов, история буфера обмена и таймер помодоро в компактной капсуле.",
        shortcut: "Верх экрана",
        accent: "#E2E8F0",
        features: &[
            "Медиа и громкость в 1 клик",
            "Полка файлов (Drag & Drop)",
            "Буфер обмена и Помодоро",
            "1.26 МБ · 60 FPS без Electron",
        ],
        exe_names: &["dynamic-island.exe", "Dynamic Island.exe"],
        managed_exe: "dynamic-island.exe",
        install_dir_hints: &["Dynamic Island", "dynamic-island"],
        autostart_key: "DynamicIsland",
        dev_path_hint: r"C:\Projects\dynamic-island\src-tauri\target\release\dynamic-island.exe",
    },
    AppSpec {
        id: "zapret2-rust",
        name: "Zapret2 GUI",
        repo: "raiyaxkrash/zapret2-rust",
        category: "Сеть",
        tagline: "YouTube, Discord и Telegram одной кнопкой",
        description: "Графическая оболочка для zapret2 с автоматическим подбором стратегии, сторожем соединения, диагностикой и прокси для Telegram.",
        shortcut: "1 клик",
        accent: "#4ADE80",
        features: &[
            "Автоподбор рабочей стратегии",
            "Встроенный сторож и диагностика",
            "Прокси-туннель для Telegram",
            "Нативный клиент на Rust",
        ],
        exe_names: &["zapret2-gui.exe", "Zapret2 GUI.exe", "zapret2-rust.exe"],
        managed_exe: "zapret2-gui.exe",
        install_dir_hints: &["Zapret2 GUI", "Zapret2", "zapret2-rust"],
        autostart_key: "Zapret2GUI",
        dev_path_hint: r"C:\Projects\zapret2-rust\src-tauri\target\release\zapret2-gui.exe",
    },
    AppSpec {
        id: "snapshot",
        name: "SnapShot",
        repo: "raiyaxkrash/snapshot",
        category: "Захват экрана",
        tagline: "Скриншотер 1:1 DPI, Beautify и оффлайн OCR",
        description: "Мгновенный захват по PrintScreen, редактор со стрелками и размытием паролей, оформление в стиле CleanShot X и оффлайн распознавание текста.",
        shortcut: "PrintScreen",
        accent: "#F59E0B",
        features: &[
            "Захват 1:1 DPI + редактор и блюр",
            "Beautify: градиент и тень в 1 клик",
            "Оффлайн OCR (RU + EN) по WinRT",
            "Автокопирование PNG в буфер",
        ],
        exe_names: &["snapshot.exe", "SnapShot.exe"],
        managed_exe: "snapshot.exe",
        install_dir_hints: &["SnapShot", "snapshot"],
        autostart_key: "SnapShot",
        dev_path_hint: r"C:\Projects\snapshot\src-tauri\target\release\snapshot.exe",
    },
];

pub fn find_spec(id: &str) -> Option<&'static AppSpec> {
    APPS.iter().find(|a| a.id == id)
}
