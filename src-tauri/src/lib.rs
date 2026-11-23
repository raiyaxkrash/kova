mod apps;
mod catalog;
mod github;

use apps::{
    build_all_states, detect_install, kova_root_dir, launch_exe, load_config, managed_app_dir,
    managed_exe_path, save_config, set_autostart, shell_open, stop_processes, AppStateDto,
};
use catalog::{find_spec, APPS, KOVA_REPO, KOVA_VERSION};
use futures_util::future::{join, join_all};
use github::{download_with_progress, fetch_latest_release, normalize_version, ReleaseInfo};
use serde::Serialize;
use std::path::PathBuf;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, Window};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleasesPayload {
    kova_version: String,
    kova_release: ReleaseInfo,
    apps: Vec<ReleaseInfo>,
}

#[tauri::command]
fn get_apps_state() -> Vec<AppStateDto> {
    build_all_states()
}

#[tauri::command]
async fn fetch_releases() -> ReleasesPayload {
    let kova_fut = fetch_latest_release("kova", KOVA_REPO);
    let app_futs = APPS
        .iter()
        .map(|spec| fetch_latest_release(spec.id, spec.repo));

    let (kova_release, apps) = join(kova_fut, join_all(app_futs)).await;
    ReleasesPayload {
        kova_version: KOVA_VERSION.to_string(),
        kova_release,
        apps,
    }
}

#[tauri::command]
async fn install_or_update_app(
    window: Window,
    id: String,
    download_url: String,
    is_portable: bool,
    version: Option<String>,
) -> Result<String, String> {
    let spec = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;

    if is_portable {
        stop_processes(spec.exe_names);
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;

        let dest = managed_exe_path(spec);
        download_with_progress(&id, &download_url, &dest, &window).await?;

        let mut cfg = load_config();
        if let Some(ver) = version {
            cfg.installed_versions
                .insert(id.clone(), normalize_version(&ver));
        }
        cfg.custom_paths.remove(&id);
        save_config(&cfg)?;

        Ok(format!("{} установлен в {}", spec.name, dest.display()))
    } else {
        let filename = download_url
            .rsplit('/')
            .next()
            .filter(|s| s.ends_with(".exe"))
            .unwrap_or("installer.exe");
        let dest = std::env::temp_dir().join("kova-downloads").join(filename);
        download_with_progress(&id, &download_url, &dest, &window).await?;

        let mut cfg = load_config();
        if let Some(ver) = version {
            cfg.installed_versions
                .insert(id.clone(), normalize_version(&ver));
            let _ = save_config(&cfg);
        }

        shell_open(&dest.to_string_lossy())?;
        Ok(format!("Запущен установщик {}", spec.name))
    }
}

#[tauri::command]
fn launch_app(id: String, as_admin: Option<bool>) -> Result<(), String> {
    let spec = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;
    let cfg = load_config();
    let (path, _) = detect_install(spec, &cfg);
    let exe = path.ok_or_else(|| format!("{} не установлен", spec.name))?;
    launch_exe(&exe, as_admin.unwrap_or(false))
}

#[tauri::command]
fn stop_app(id: String) -> Result<usize, String> {
    let spec = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;
    Ok(stop_processes(spec.exe_names))
}

#[tauri::command]
fn uninstall_app(id: String) -> Result<String, String> {
    let spec = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;
    stop_processes(spec.exe_names);
    let _ = set_autostart(spec.autostart_key, PathBuf::new().as_path(), false);

    let mut cfg = load_config();
    cfg.installed_versions.remove(&id);
    cfg.custom_paths.remove(&id);
    let _ = save_config(&cfg);

    let dir = managed_app_dir(spec.id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)
            .map_err(|e| format!("Не удалось удалить папку {}: {e}", dir.display()))?;
        return Ok(format!("{} удалён", spec.name));
    }

    Ok(format!("Привязка {} сброшена", spec.name))
}

#[tauri::command]
fn toggle_autostart(id: String, enabled: bool) -> Result<bool, String> {
    let spec = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;
    let cfg = load_config();
    let (path, _) = detect_install(spec, &cfg);
    let exe = path.ok_or_else(|| format!("Сначала установите {}", spec.name))?;
    set_autostart(spec.autostart_key, &exe, enabled)?;
    Ok(enabled)
}

#[tauri::command]
fn set_custom_path(id: String, path: String) -> Result<(), String> {
    let _ = find_spec(&id).ok_or_else(|| format!("Неизвестное приложение: {id}"))?;
    let p = PathBuf::from(path.trim().trim_matches('"'));
    if !p.is_file() {
        return Err("Файл не найден по указанному пути".to_string());
    }
    let mut cfg = load_config();
    cfg.custom_paths
        .insert(id, p.to_string_lossy().to_string());
    save_config(&cfg)
}

#[tauri::command]
fn open_external(target: String) -> Result<(), String> {
    shell_open(&target)
}

#[tauri::command]
fn get_kova_dir() -> String {
    let dir = kova_root_dir();
    let _ = std::fs::create_dir_all(&dir);
    dir.to_string_lossy().to_string()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_apps_state,
            fetch_releases,
            install_or_update_app,
            launch_app,
            stop_app,
            uninstall_app,
            toggle_autostart,
            set_custom_path,
            open_external,
            get_kova_dir,
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Открыть Kova", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("kova-tray")
                .tooltip("Kova — лаунчер утилит")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _ = tray_builder.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kova");
}
