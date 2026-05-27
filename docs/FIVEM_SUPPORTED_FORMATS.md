# FiveM Supported Formats & Parsing Guidelines

Dexta Toolkit safely handles and inspects standard asset structures for Grand Theft Auto V streamed via FiveM resources.

## 1. Stream Assets (.yft, .ytd, .ydd, .awc)
Files placed inside the `stream/` folder are streamed directly to connected game clients:
- **`.yft` (Vehicle Model / Fragment)**: Houses fragment meshes and collision boundaries. Highly detailed models exceed 16MB and trigger server warnings.
- **`.ytd` (Texture Dictionary)**: Packaged textures. Oversized dictionaries exceed 16MB and cause texture loss/streaming lag.
- **`.ydd` (Drawables)**: Mesh geometry descriptors.
- **`.awc` (Audio Container)**: Audio assets. Oversized awc files cause performance bottlenecks.
- **`.ymap` / `.ytyp`**: Placement mapping and archetypes.

## 2. Meta Configurations
Metadata files reside in root or subdirectories, and are mapped in manifests:
- **`vehicles.meta`**: Spawn codes (`modelName`), handling IDs (`handlingId`), layouts, and resident texture associations.
- **`handling.meta`**: Physics parameters (mass, velocity, suspension) mapping to `handlingName`.
- **`carvariations.meta`**: Vehicle liveries, lights, and visual options.
- **`carcols.meta`**: Modkit colors, light hashes, siren sequences, and tuning kits.
- **`vehiclelayouts.meta`**: Camera angles, seat configurations, and custom layout matrices.

## 3. Manifest Rules
- **fxmanifest.lua**: Modern standard using `fx_version` declaration. Mapping data files via:
  ```lua
  data_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'
  ```
- **__resource.lua**: Legacy configuration, automatically flagged for upgrade by Meta Fixer.
