use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{Emitter, Window};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub id: String,
    pub repo: String,
    pub available: bool,
    pub tag: Option<String>,
    pub version: Option<String>,
    pub published_at: Option<String>,
    pub release_url: String,
    pub notes: Option<String>,
    pub asset_name: Option<String>,
    pub download_url: Option<String>,
    pub asset_size: Option<u64>,
    pub is_portable: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub id: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: u8,
    pub stage: String,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    html_url: String,
    published_at: Option<String>,
    body: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("Kova-Launcher/{}", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

pub fn normalize_version(tag: &str) -> String {
    tag.trim().trim_start_matches(['v', 'V']).to_string()
}

pub async fn fetch_latest_release(id: &str, repo: &str) -> ReleaseInfo {
    let fallback_url = format!("https://github.com/{repo}/releases");
    let client = match build_client() {
        Ok(c) => c,
        Err(e) => {
            return ReleaseInfo {
                id: id.to_string(),
                repo: repo.to_string(),
                available: false,
                tag: None,
                version: None,
                published_at: None,
                release_url: fallback_url,
                notes: None,
                asset_name: None,
                download_url: None,
                asset_size: None,
                is_portable: false,
                error: Some(e),
            };
        }
    };

    let url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let resp = match client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return ReleaseInfo {
                id: id.to_string(),
                repo: repo.to_string(),
                available: false,
                tag: None,
                version: None,
                published_at: None,
                release_url: fallback_url,
                notes: None,
                asset_name: None,
                download_url: None,
                asset_size: None,
                is_portable: false,
                error: Some(format!("Нет ответа GitHub: {e}")),
            };
        }
    };

    if resp.status().as_u16() == 404 {
        return ReleaseInfo {
            id: id.to_string(),
            repo: repo.to_string(),
            available: false,
            tag: None,
            version: None,
            published_at: None,
            release_url: format!("https://github.com/{repo}"),
            notes: None,
            asset_name: None,
            download_url: None,
            asset_size: None,
            is_portable: false,
            error: Some("Релиз ещё не опубликован".to_string()),
        };
    }

    if !resp.status().is_success() {
        return ReleaseInfo {
            id: id.to_string(),
            repo: repo.to_string(),
            available: false,
            tag: None,
            version: None,
            published_at: None,
            release_url: fallback_url,
            notes: None,
            asset_name: None,
            download_url: None,
            asset_size: None,
            is_portable: false,
            error: Some(format!("GitHub API HTTP {}", resp.status())),
        };
    }

    let gh: GhRelease = match resp.json().await {
        Ok(data) => data,
        Err(e) => {
            return ReleaseInfo {
                id: id.to_string(),
                repo: repo.to_string(),
                available: false,
                tag: None,
                version: None,
                published_at: None,
                release_url: fallback_url,
                notes: None,
                asset_name: None,
                download_url: None,
                asset_size: None,
                is_portable: false,
                error: Some(format!("Ошибка разбора релиза: {e}")),
            };
        }
    };

    // Prefer portable .exe for silent 1-click Kova install; fallback to setup .exe; fallback to any .exe
    let portable = gh.assets.iter().find(|a| {
        let lower = a.name.to_ascii_lowercase();
        lower.ends_with(".exe") && lower.contains("portable")
    });
    let setup = gh.assets.iter().find(|a| {
        let lower = a.name.to_ascii_lowercase();
        lower.ends_with(".exe") && lower.contains("setup")
    });
    let any_exe = gh
        .assets
        .iter()
        .find(|a| a.name.to_ascii_lowercase().ends_with(".exe"));

    let (chosen, is_portable) = if let Some(a) = portable {
        (Some(a), true)
    } else if let Some(a) = setup {
        (Some(a), false)
    } else if let Some(a) = any_exe {
        (Some(a), true)
    } else {
        (None, false)
    };

    let version = normalize_version(&gh.tag_name);

    ReleaseInfo {
        id: id.to_string(),
        repo: repo.to_string(),
        available: true,
        tag: Some(gh.tag_name),
        version: Some(version),
        published_at: gh.published_at,
        release_url: gh.html_url,
        notes: gh.body,
        asset_name: chosen.map(|a| a.name.clone()),
        download_url: chosen.map(|a| a.browser_download_url.clone()),
        asset_size: chosen.map(|a| a.size),
        is_portable,
        error: None,
    }
}

pub async fn download_with_progress(
    id: &str,
    url: &str,
    dest: &Path,
    window: &Window,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("Kova-Launcher/{}", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let _ = window.emit(
        "download-progress",
        DownloadProgress {
            id: id.to_string(),
            downloaded: 0,
            total: 0,
            percent: 0,
            stage: "Подключение к GitHub...".to_string(),
        },
    );

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Ошибка загрузки: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Сервер вернул HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Не удалось создать папку: {e}"))?;
    }

    let temp_path = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Не удалось создать файл: {e}"))?;

    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 255;

    while let Some(chunk) = stream.next().await {
        let data = chunk.map_err(|e| format!("Обрыв загрузки: {e}"))?;
        file.write_all(&data)
            .await
            .map_err(|e| format!("Ошибка записи: {e}"))?;
        downloaded += data.len() as u64;

        let percent = downloaded
            .saturating_mul(100)
            .checked_div(total)
            .unwrap_or(0)
            .min(100) as u8;

        if percent != last_percent {
            last_percent = percent;
            let _ = window.emit(
                "download-progress",
                DownloadProgress {
                    id: id.to_string(),
                    downloaded,
                    total,
                    percent,
                    stage: "Скачивание...".to_string(),
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Ошибка сохранения: {e}"))?;
    drop(file);

    if dest.exists() {
        let _ = tokio::fs::remove_file(dest).await;
    }
    tokio::fs::rename(&temp_path, dest)
        .await
        .map_err(|e| format!("Не удалось завершить установку: {e}"))?;

    let _ = window.emit(
        "download-progress",
        DownloadProgress {
            id: id.to_string(),
            downloaded,
            total: total.max(downloaded),
            percent: 100,
            stage: "Готово".to_string(),
        },
    );

    Ok(())
}
