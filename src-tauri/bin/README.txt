# YTD Texture Optimizer Sidecar Setup Instructions

To enable the **Texture Optimizer** feature in FiveM Toolkit, you must place the required executable binaries and libraries in this directory (`src-tauri/bin/`).

Tauri bundles these files during packaging and runtime.

## Required Binaries

1. **`CodeWalker.Core.dll`**
   - **What it is**: The core C# library from the CodeWalker project used to read, parse, and write Grand Theft Auto V `.ytd` (Texture Dictionary) resource archives.
   - **How to obtain**: Join the official CodeWalker Discord server (https://discord.gg/BxfKHkk) or download the latest release from GTA5-Mods.com. Extract the ZIP and copy `CodeWalker.Core.dll` to this folder.

2. **`texconv.exe`**
   - **What it is**: Microsoft's DirectX Texture Converter CLI tool used to resize and compress DDS texture files.
   - **How to obtain**: Download it directly from Microsoft's DirectXTex GitHub releases (https://github.com/microsoft/DirectXTex/releases).

3. **`ytd-optimizer.exe`**
   - **What it is**: The custom compiled command-line helper we wrote (`src-tauri/src/ytd_optimizer.cs`) that orchestrates the texture extraction, downscaling, and repacking.
   - **How to compile**: Open a PowerShell window and run the `compile_optimizer.ps1` script located in this folder (or run the compilation command below).

---

## Automatic Setup Script

A helper compilation script `compile_optimizer.ps1` has been created in this directory. 
After you drop `CodeWalker.Core.dll` in this folder, you can right-click and run `compile_optimizer.ps1` to automatically build `ytd-optimizer.exe`.

### Manual Compilation Command:
If you prefer running it manually, run this command from the project root directory:
```powershell
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /out:src-tauri\bin\ytd-optimizer.exe /r:src-tauri\bin\CodeWalker.Core.dll src-tauri\src\ytd_optimizer.cs
```
