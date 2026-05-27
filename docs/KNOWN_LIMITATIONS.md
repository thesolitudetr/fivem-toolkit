# Known Limitations - Dexta Toolkit

This document records the strict parsing boundaries and logical constraints built into this version of Dexta Toolkit.

## 1. Static Manifest Parsing (Lua)
- **Direct Variable Mapping Limitations**: Dexta Toolkit parses `fxmanifest.lua` and legacy `__resource.lua` files statically using safe Regular Expression maps. It **does not** run a full Lua interpreter locally, as doing so introduces arbitrary remote code execution (RCE) safety hazards.
- **Dynamic Lua Code**: Manifest files that use complex Lua string concatenations or runtime variables to list files or directories may not be parsed perfectly. Static paths are highly recommended and are correctly scanned.

## 2. XML Metadata Merge Limits
- **Unknown XML Formats**: Dexta Toolkit supports structural merges of standard GTA V metadata arrays including `vehicles.meta` (`InitDatas` item lists), `handling.meta` (`HandlingData` lists), and `carvariations.meta` (`variationData` items).
- **Custom XML Dialects**: If an addon package uses custom, non-standard elements outside of these schema nodes, Dexta Toolkit will copy the first file directly and output a warning advising a manual inspection, rather than risking generating malformed files.

## 3. Dependency Scanner Scope
- **Static Dependencies Only**: The dependency validator inspects declared manifests and checks local server resource paths. It cannot validate runtime script configurations, database tables, or runtime SQL syntax compatibility.

## 4. Texture Resolutions
- **External Size-based analysis**: File warnings are evaluated purely based on raw compressed file size thresholds (default 16MB) in the filesystem. The scanner does not inspect mipmaps, sub-texture resolution arrays, or compression headers directly inside `.ytd` dictionaries.
