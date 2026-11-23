# Kova

Единый нативный лаунчер и менеджер обновлений для Windows-утилит на **Rust + Tauri 2 + Win32**.

🌐 **Витрина:** [raiyaxkrash.github.io/kova](https://raiyaxkrash.github.io/kova/)

## Включённые проекты

| Приложение | Репозиторий | Описание |
|---|---|---|
| **Dynamic Island** | [`raiyaxkrash/dynamic-island`](https://github.com/raiyaxkrash/dynamic-island) | Нативный Dynamic Island для Windows 10/11 на 60 FPS: медиа, громкость, полка файлов, буфер и помодоро |
| **Zapret2 GUI** | [`raiyaxkrash/zapret2-rust`](https://github.com/raiyaxkrash/zapret2-rust) | YouTube, Discord и Telegram одной кнопкой с автоподбором стратегии и прокси для Telegram |
| **SwiftTab** | [`raiyaxkrash/swifttab`](https://github.com/raiyaxkrash/swifttab) | Современный `Alt+Tab` переключатель окон с живыми превью и поиском по `Alt+Space` |
| **SnapShot** | [`raiyaxkrash/snapshot`](https://github.com/raiyaxkrash/snapshot) | Скриншотер 1:1 DPI, редактор с блюром паролей, Beautify и оффлайн OCR (RU/EN) |

## Возможности Kova

- **Установка и обновления в 1 клик** напрямую из GitHub Releases с прогресс-баром загрузки.
- **Живой статус процессов** через нативный Win32 `CreateToolhelp32Snapshot` — запуск и остановка каждой утилиты или всех сразу.
- **Автозапуск Windows** (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) для каждого приложения из одного экрана.
- **Привязка локальных `.exe`** — удобно, если приложение уже установлено или собрано локально.
- **Системный трей** и минимальный вес без Electron.

## Сборка из исходников

```bash
npm install
npm run dev
npm run build
```
