import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  FolderOpen, 
  Car, 
  AlertTriangle, 
  Plus, 
  ExternalLink,
  Trash2,
  Compass,
  CheckCircle2,
  Loader2,
  Sliders
} from 'lucide-react';

export const PackBrowser: React.FC = () => {
  const { settings, loadDb } = useStore();
  const t = translations[settings.language] || translations.en;

  const [packPath, setPackPath] = useState('');
  const [manifestData, setManifestData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [textures, setTextures] = useState<string[]>([]);
  const [isLoadingTextures, setIsLoadingTextures] = useState(false);

  const handleOpenPack = async () => {
    try {
      setErrorMsg('');
      setManifestData(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.packBrowser
      });

      if (selected && typeof selected === 'string') {
        setPackPath(selected);
        const res = await invoke<any>('scan_resource', { path: selected });
        
        const manifestFile = res.files.find((f: any) => f.name === 'dexta_manifest.json');
        if (manifestFile) {
          try {
            const fileContent = await invoke<string>('read_text_file', { path: manifestFile.path });
            const data = JSON.parse(fileContent);
            setManifestData(data);
          } catch (e) {
            console.error('Error reading dexta_manifest.json, falling back to inferred:', e);
            const inferred = inferPack(res);
            setManifestData(inferred);
            setErrorMsg(t.noManifestWarning);
          }
        } else {
          const inferred = inferPack(res);
          setManifestData(inferred);
          setErrorMsg(t.noManifestWarning);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to open pack folder.');
    }
  };

  const inferPack = (res: any) => {
    // Collect stream files and XML references
    const yfts = res.files.filter((f: any) => f.category === 'yft').map((f: any) => f.name.replace('.yft', ''));
    return {
      timestamp: new Date().toISOString(),
      output_name: res.name,
      source_resources: yfts,
      copied_stream_files: res.files.filter((f: any) => f.relative_path.toLowerCase().startsWith('stream/')).map((f: any) => f.name),
      merged_meta_files: res.files.filter((f: any) => f.relative_path.toLowerCase().startsWith('data/')).map((f: any) => f.name),
      warnings: [settings.language === 'tr'
        ? 'Çıkarımsal analiz: Orijinal kaynak bağlantıları belirsiz.'
        : 'Inferred analysis: Original resource linkages are uncertain.'],
    };
  };

  const handleExtractVehicle = async (veh: string) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.selectExtractionDest
      });

      if (selected && typeof selected === 'string') {
        setIsExtracting(true);
        await invoke('extract_vehicle', {
          packPath,
          vehicleName: veh,
          outputDir: selected
        });
        setSuccessMsg(t.extractionSuccess);
        await loadDb();
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(t.extractionFailed.replace('{message}', e.message || e.toString()));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSelectVehicle = async (veh: string) => {
    setSelectedVehicle(veh);
    setTextures([]);
    if (!manifestData || !manifestData.copied_stream_files) return;

    const ytdName = `${veh.toLowerCase()}.ytd`;
    const ytdFile = manifestData.copied_stream_files.find(
      (f: string) => f.toLowerCase() === ytdName || (f.toLowerCase().startsWith(veh.toLowerCase()) && f.toLowerCase().endsWith('.ytd'))
    );

    if (ytdFile) {
      setIsLoadingTextures(true);
      try {
        const fullPath = `${packPath}/stream/${ytdFile}`;
        const texList = await invoke<string[]>('get_ytd_textures', { ytdPath: fullPath });
        setTextures(texList);
      } catch (e) {
        console.error('Failed to load YTD textures:', e);
      } finally {
        setIsLoadingTextures(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.packBrowser}</h2>
          <p className="text-sm text-slate-400">{t.packBrowserDesc}</p>
        </div>
      </div>

      {/* Path Selector */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-3 items-center">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={t.selectPackPlaceholder}
            value={packPath}
            onChange={(e) => setPackPath(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
          />
        </div>
        <button 
          onClick={handleOpenPack}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
          title={t.browseFolder}
        >
          <FolderOpen size={16} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {isExtracting && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>{t.extractingState}</span>
        </div>
      )}

      {manifestData ? (
        <div className="grid grid-cols-3 gap-6">
          {/* List of Vehicles */}
          <div className="col-span-2 glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Car size={16} className="text-indigo-400" />
              <span>{t.containedAddonVehicles}</span>
            </h3>

            <div className="flex flex-col gap-2">
              {manifestData.source_resources.map((veh: string, idx: number) => (
                <div 
                  key={idx}
                  onClick={() => handleSelectVehicle(veh)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedVehicle === veh 
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                      : 'bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Car size={16} />
                    <span className="font-bold text-white text-xs">{veh}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleExtractVehicle(veh); }}
                      disabled={isExtracting}
                      className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white border border-white/5 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <ExternalLink size={10} />
                      <span>{t.extractStandalone}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details & Actions widget */}
          <div className="flex flex-col gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.packDetails}</h3>
              
              <div className="flex flex-col gap-3 text-xs leading-normal">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-500">{t.packNameLabel}</span>
                  <span className="font-bold text-white">{manifestData.output_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-500">{t.streamFilesLabel}</span>
                  <span className="font-bold text-white">{manifestData.copied_stream_files?.length || 0} {t.files}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-500">{t.metaMappingsLabel}</span>
                  <span className="font-bold text-white">{manifestData.merged_meta_files?.length || 0} {t.entries}</span>
                </div>
              </div>

              {/* Add to Pack action */}
              <button 
                disabled={true}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Plus size={14} />
                <span>{t.addVehicleToPack}</span>
              </button>
            </div>

            {selectedVehicle && (
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={16} className="text-violet-400" />
                  <span>{t.ytdTexturesTitle} ({selectedVehicle})</span>
                </h3>
                
                <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                  {isLoadingTextures ? (
                    <span className="text-[10px] text-slate-500 italic animate-pulse">{t.scanningState}</span>
                  ) : textures.length > 0 ? (
                    textures.map((tex, i) => (
                      <div key={i} className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-900/60 font-mono text-[9px] text-slate-400 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-cyan-500" />
                        <span>{tex}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">{t.noTexturesInYtd}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 border border-dashed border-slate-800/80 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-center opacity-50">
          <Compass size={36} className="text-slate-500" />
          <div>
            <p className="text-sm font-bold text-slate-300">{t.browseInspectPacks}</p>
            <p className="text-xs text-slate-500 mt-1">{t.openPackDesc}</p>
          </div>
        </div>
      )}
    </div>
  );
};
