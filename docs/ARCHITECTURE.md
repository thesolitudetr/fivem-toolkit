# System Architecture - Dexta Toolkit

This document explains the technical boundaries and synchronization schemas inside Dexta Toolkit.

## High-Level Layout
Dexta Toolkit uses **Tauri v2** to bind a fast, secure React frontend with a high-performance Rust core.

```
┌───────────────────────────────────────────────────────────────┐
│                       React Frontend (Vite)                   │
│  - Zustand Store (State synchronization)                       │
│  - Custom titlebar (Drag regions, window events control)       │
│  - Modular pages: Analyzer, Merger, Validator, Settings, etc. │
└───────────────┬───────────────────────────────▲───────────────┘
                │ IPC Commands                  │ Typed Responses
┌───────────────▼───────────────────────────────┴───────────────┐
│                       Tauri Rust Backend                      │
│  - scanner.rs            (Resource mapping & classifying)     │
│  - stream_analyzer.rs    (Warnings grading & alerts)          │
│  - vehicle_merger.rs     (XML aggregation & conflict checks)  │
│  - meta_fixer.rs         (Manifest parsing Heuristics)       │
│  - exporter.rs           (ZIP & production clean outputs)     │
│  - storage.rs            (Local settings & history manager)   │
└───────────────────────────────────────────────────────────────┘
```

## Security & Local Boundaries
1. **Zero External Access**: Dexta Toolkit has no third-party endpoints, tracking scripts, or analytics. Files are crawled entirely in local native threads.
2. **Safe Staging Principle**: Operations that mutate file lists (like Merger or Fixer) do NOT touch original source directories. They write into unique UUID-named staging subfolders (`_staging_xxxx`). Only upon structural validation of the files (e.g. valid XML structures) are the outputs swapped into destination directories.
3. **Atomic Backups**: Overwrites create backup timestamp folders (`_backup_timestamp`) before swapping folders, preventing data loss.

## Frontend State & Navigating
- **Zustand (`src/store.ts`)**: Serves as the central state container. On application launch, it queries `load_settings` from Rust to get the recent projects count, warn lists, and preferences.
- **Custom Titlebar (`src/components/Titlebar.tsx`)**: Standard window controls are custom-coded using Tauri's window hooks (`getCurrentWindow()`). The titlebar element is mapped with `data-tauri-drag-region` to enable native OS window movement.
- **Bilingual Interface (`src/translations.ts`)**: Full English and Turkish locale translation maps. Triggered by user settings and stored locally in local AppData.
