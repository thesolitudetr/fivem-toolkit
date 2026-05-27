# Compiling & Packaging - Windows 10/11

Dexta Toolkit compiles into a native Windows executable and an installer using Tauri's bundle features.

## 1. Local Dev Mode
To run the developer server and launch the desktop container locally:
```bash
pnpm install
pnpm tauri dev
```

## 2. Production Packaging
To build a production-optimized package:
1. Ensure your Rust PATH is set (our environment has it at `%USERPROFILE%/.cargo/bin`).
2. Run compile command:
   ```bash
   pnpm tauri build
   ```

### Output Directories
Once compilation completes successfully, the built installers are placed in:
- **MSI Installer**: `src-tauri/target/release/bundle/msi/Dexta Toolkit_0.1.0_x64_en-US.msi`
- **Standalone Executable**: `src-tauri/target/release/Dexta Toolkit.exe`

## 3. Code Signing Certificate Requirement
When distributing the application, Windows SmartScreen will display an "Unknown Publisher" warning unless the installer is signed with a valid **EV Code Signing Certificate**.

### Signing Steps:
1. Obtain an EV Certificate from a trusted CA (e.g., Sectigo, DigiCert).
2. Configure environment variables in your build runner:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY="your_private_key"
   ```
3. Use SignTool during the post-build action to sign the MSI.
