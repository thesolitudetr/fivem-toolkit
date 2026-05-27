# Dexta Toolkit - FiveM Resource Toolkit

Dexta Toolkit is a premium, high-performance Windows desktop application designed for FiveM resource developers and server owners. It provides powerful utilities to recursively scan, analyze, validate, structurally merge, and clean-export FiveM asset packs.

## Core Features
1. **Dashboard**: Unified workspace console displaying taranan file metrics, alerts, and son events activity.
2. **Stream Analyzer**: Complete özyinelemeli size grading scanner with adjustable thresholds (large .ytd, .yft, .awc warning limits) and detailed HTML/Markdown reports.
3. **Vehicle Merger**: Aggregates standalone vehicle folders into a single resource. Safely checks model spawn code clashes and file duplication, aggregates XML meta files structurally, and writes output into versioned staging folders.
4. **Pack Browser**: Inspects generated packs, listing vehicles, with safe extraction and add-on triggers.
5. **Meta Fixer**: Deep manifest validation, missing file checker, malformed XML parsing alerts, and safe manifest upgrades.
6. **Dependency Scanner**: Statik manifest inspector validating optional and mandatory dependencies against server files.
7. **Build Export**: Cleans git metadata, temporary logs, and node cache to package optimized assets (or ZIP archives).

## Development Setup

### Prerequisites
- Node.js (v18+ or v20+)
- pnpm (v9+ or v10+)
- Rust & Cargo (stable toolchain)

### Local Dev Launch
1. Install node dependencies:
   ```bash
   pnpm install
   ```
2. Start the local Tauri development server:
   ```bash
   pnpm tauri dev
   ```

### Running Tests
- To execute Rust business logic tests on scanner, merger, and fixing routines:
  ```bash
  cd src-tauri
  cargo test
  ```

## Production Compilation

To bundle Dexta Toolkit into a production Windows installer (`.msi` / `.exe`):
```bash
pnpm tauri build
```
The output installers will be compiled under `src-tauri/target/release/bundle/msi/` or `exe/`.

*Note: For official distribution, ensure to configure a code-signing certificate in your build pipeline environment.*
