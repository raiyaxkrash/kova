use crate::catalog::{AppSpec, APPS};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use windows::core::PCWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
};
use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
use windows::Win32::UI::Shell::ShellExecuteW;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KovaConfig {
    pub installed_versions: HashMap<String, String>,
    pub custom_paths: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStateDto {
    pub id: String,
    pub name: String,
    pub repo: String,
    pub category: String,
    pub tagline: String,
    pub description: String,
    pub shortcut: String,
    pub accent: String,
    pub features: Vec<String>,
    pub installed: bool,
    pub managed: bool,
    pub running: bool,
    pub autostart: bool,
    pub installed_version: Option<String>,
    pub exe_path: Option<String>,
}

pub fn kova_root_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\Users\Public"));
    base.join("Kova")
}

pub fn managed_app_dir(id: &str) -> PathBuf {
    kova_root_dir().join("apps").join(id)
}

pub fn managed_exe_path(spec: &AppSpec) -> PathBuf {
    managed_app_dir(spec.id).join(spec.managed_exe)
}

fn config_path() -> PathBuf {
    kova_root_dir().join("config.json")
}

pub fn load_config() -> KovaConfig {
    let path = config_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_config(cfg: &KovaConfig) -> Result<(), String> {
    let root = kova_root_dir();
    std::fs::create_dir_all(&root).map_err(|e| format!("Не удалось создать папку Kova: {e}"))?;
    let json =
        serde_json::to_string_pretty(cfg).map_err(|e| format!("Ошибка сериализации: {e}"))?;
    std::fs::write(config_path(), json).map_err(|e| format!("Ошибка сохранения config.json: {e}"))
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

pub fn list_running_processes() -> HashSet<String> {
    let mut set = HashSet::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return set;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_ascii_lowercase();
                set.insert(name);
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    set
}

pub fn stop_processes(exe_names: &[&str]) -> usize {
    let targets: HashSet<String> = exe_names.iter().map(|s| s.to_ascii_lowercase()).collect();
    let mut killed = 0usize;
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return 0;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_ascii_lowercase();
                if targets.contains(&name) {
                    if let Ok(proc_handle) = OpenProcess(PROCESS_TERMINATE, false, entry.th32ProcessID)
                    {
                        if TerminateProcess(proc_handle, 0).is_ok() {
                            killed += 1;
                        }
                        let _ = CloseHandle(proc_handle);
                    }
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    killed
}

pub fn detect_install(spec: &AppSpec, cfg: &KovaConfig) -> (Option<PathBuf>, bool) {
    // 1. Custom user path
    if let Some(custom) = cfg.custom_paths.get(spec.id) {
        let p = PathBuf::from(custom);
        if p.is_file() {
            return (Some(p), false);
        }
    }

    // 2. Kova-managed portable exe
    let managed = managed_exe_path(spec);
    if managed.is_file() {
        return (Some(managed), true);
    }

    // 3. Standard NSIS / Windows install directories
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&local));
        roots.push(PathBuf::from(&local).join("Programs"));
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(pf));
    }

    for root in &roots {
        for dir_hint in spec.install_dir_hints {
            let dir = root.join(dir_hint);
            if !dir.is_dir() {
                continue;
            }
            for exe in spec.exe_names {
                let candidate = dir.join(exe);
                if candidate.is_file() {
                    return (Some(candidate), false);
                }
            }
        }
    }

    // 4. Local workspace release build hint
    let dev = PathBuf::from(spec.dev_path_hint);
    if dev.is_file() {
        return (Some(dev), false);
    }

    (None, false)
}

const RUN_SUBKEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

pub fn is_autostart_enabled(value_name: &str) -> bool {
    unsafe {
        let subkey = to_wide(RUN_SUBKEY);
        let name = to_wide(value_name);
        let mut hkey = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            Some(0),
            KEY_READ,
            &mut hkey,
        )
        .is_err()
        {
            return false;
        }
        let mut size = 0u32;
        let exists = RegQueryValueExW(
            hkey,
            PCWSTR(name.as_ptr()),
            None,
            None,
            None,
            Some(&mut size),
        )
        .is_ok();
        let _ = RegCloseKey(hkey);
        exists && size > 2
    }
}

pub fn set_autostart(value_name: &str, exe_path: &Path, enabled: bool) -> Result<(), String> {
    unsafe {
        let subkey = to_wide(RUN_SUBKEY);
        let name = to_wide(value_name);
        let mut hkey = HKEY::default();
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            Some(0),
            KEY_WRITE,
            &mut hkey,
        )
        .ok()
        .map_err(|e| format!("Не удалось открыть реестр автозапуска: {e}"))?;

        let result = if enabled {
            let cmd = format!("\"{}\"", exe_path.display());
            let wide = to_wide(&cmd);
            let bytes =
                std::slice::from_raw_parts(wide.as_ptr() as *const u8, wide.len() * 2);
            RegSetValueExW(hkey, PCWSTR(name.as_ptr()), Some(0), REG_SZ, Some(bytes))
                .ok()
                .map_err(|e| format!("Не удалось записать автозапуск: {e}"))
        } else {
            let _ = RegDeleteValueW(hkey, PCWSTR(name.as_ptr()));
            Ok(())
        };

        let _ = RegCloseKey(hkey);
        result
    }
}

pub fn shell_open(target: &str) -> Result<(), String> {
    unsafe {
        let verb = to_wide("open");
        let file = to_wide(target);
        let res = ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(file.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        );
        if (res.0 as isize) <= 32 {
            return Err(format!("Не удалось открыть: {target}"));
        }
        Ok(())
    }
}

pub fn launch_exe(path: &Path, as_admin: bool) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let verb_str = if as_admin { "runas" } else { "open" };
    unsafe {
        let verb = to_wide(verb_str);
        let file = to_wide(&path.to_string_lossy());
        let work_dir = to_wide(&dir.to_string_lossy());
        let res = ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(file.as_ptr()),
            PCWSTR::null(),
            PCWSTR(work_dir.as_ptr()),
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        );
        let code = res.0 as isize;
        if code <= 32 {
            if code == 5 {
                return Err("Запуск отменён пользователем (UAC)".to_string());
            }
            return Err(format!("Не удалось запустить {} (код {code})", path.display()));
        }
        Ok(())
    }
}

pub fn build_all_states() -> Vec<AppStateDto> {
    let cfg = load_config();
    let running_set = list_running_processes();

    APPS.iter()
        .map(|spec| {
            let (path, managed) = detect_install(spec, &cfg);
            let installed = path.is_some();
            let running = spec
                .exe_names
                .iter()
                .any(|e| running_set.contains(&e.to_ascii_lowercase()));
            let autostart = is_autostart_enabled(spec.autostart_key);
            let installed_version = cfg.installed_versions.get(spec.id).cloned();

            AppStateDto {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                repo: spec.repo.to_string(),
                category: spec.category.to_string(),
                tagline: spec.tagline.to_string(),
                description: spec.description.to_string(),
                shortcut: spec.shortcut.to_string(),
                accent: spec.accent.to_string(),
                features: spec.features.iter().map(|s| (*s).to_string()).collect(),
                installed,
                managed,
                running,
                autostart,
                installed_version,
                exe_path: path.map(|p| p.to_string_lossy().to_string()),
            }
        })
        .collect()
}
