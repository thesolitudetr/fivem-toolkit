import React, { useState } from 'react';
import { useStore, FiveMResource, MergePreview } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Car, 
  FolderOpen, 
  Plus, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Settings,
  HelpCircle,
  FileText
} from 'lucide-react';

export const VehicleMerger: React.FC = () => {
  const { settings, loadDb } = useStore();
  const t = translations[settings.language] || translations.en;

  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [scannedAddons, setScannedAddons] = useState<FiveMResource[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [outputName, setOutputName] = useState('merged_vehicles');
  const [outputDir, setOutputDir] = useState('');
  const [mergeReport, setMergeReport] = useState<any>(null);

  const handleSelectAddons = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: true,
        title: t.addFoldersBtn
      });

      if (selected && Array.isArray(selected)) {
        setIsScanning(true);
        const paths = [...selectedPaths];
        const addons = [...scannedAddons];

        for (const path of selected) {
          if (!paths.includes(path)) {
            paths.push(path);
            const res = await invoke<FiveMResource>('scan_resource', { path });
            addons.push(res);
          }
        }

        setSelectedPaths(paths);
        setScannedAddons(addons);

        // Run merge preview
        const preview = await invoke<MergePreview>('preview_merge', { resourcePaths: paths });
        setMergePreview(preview);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error choosing addon folders');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemoveAddon = async (idx: number) => {
    const paths = [...selectedPaths];
    const addons = [...scannedAddons];
    paths.splice(idx, 1);
    addons.splice(idx, 1);

    setSelectedPaths(paths);
    setScannedAddons(addons);

    if (paths.length > 0) {
      try {
        const preview = await invoke<MergePreview>('preview_merge', { resourcePaths: paths });
        setMergePreview(preview);
      } catch (e: any) {
        setErrorMsg(e.message || 'Failed to update merge preview');
      }
    } else {
      setMergePreview(null);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.outputDirLabel
      });

      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleExecuteMerge = async () => {
    if (selectedPaths.length === 0 || !outputName || !outputDir) {
      setErrorMsg(t.specifyAllFields);
      return;
    }

    setIsMerging(true);
    setErrorMsg('');
    setMergeReport(null);

    try {
      const report = await invoke<any>('execute_merge', {
        resourcePaths: selectedPaths,
        outputName,
        outputDir
      });
      setMergeReport(report);
      await loadDb(); // refresh history
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error executing vehicle merge.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.vehicleMerger}</h2>
        <p className="text-sm text-slate-400">{t.mergerDesc}</p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Inputs Staging Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Col: Addons selector list */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.selectedFoldersTitle}</h3>
              <button 
                onClick={handleSelectAddons}
                disabled={isScanning}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-500/10 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus size={14} />
                <span>{t.addFoldersBtn}</span>
              </button>
            </div>

            {selectedPaths.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center gap-2 opacity-50">
                <Car size={28} className="text-slate-500" />
                <p className="text-xs font-medium text-slate-500">{t.noFoldersSelected}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {scannedAddons.map((addon, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Car size={14} />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-200">{addon.name}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{addon.path}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveAddon(idx)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white cursor-pointer transition-colors"
                      title={t.removeTooltip}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merge Preview details */}
          {mergePreview && (
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.conflictTitle}</h3>
              
              {mergePreview.stream_conflicts.length === 0 && mergePreview.model_conflicts.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-xs font-semibold">
                  <CheckCircle2 size={16} />
                  <span>{t.noConflicts}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {mergePreview.stream_conflicts.length > 0 && (
                    <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      <p className="font-bold flex items-center gap-1">
                        <AlertTriangle size={14} /> {t.duplicateFilesWarn}
                      </p>
                      <ul className="list-disc list-inside mt-1 opacity-90 flex flex-col gap-1">
                        {mergePreview.stream_conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mergePreview.model_conflicts.length > 0 && (
                    <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                      <p className="font-bold flex items-center gap-1">
                        <AlertTriangle size={14} /> {t.duplicateModelsWarn}
                      </p>
                      <ul className="list-disc list-inside mt-1 opacity-90 flex flex-col gap-1">
                        {mergePreview.model_conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Output configuration and Actions */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.outputConfigurations}</h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.outputPackNameLabel}</label>
              <input 
                type="text" 
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="merged_resource_name"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.outputDirLabel}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="C:/FiveM/server-data/resources"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                />
                <button 
                  onClick={handleSelectOutputDir}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            <button 
              onClick={handleExecuteMerge}
              disabled={isMerging || selectedPaths.length === 0 || !outputName || !outputDir}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {isMerging ? t.mergingState : t.runMergeBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Merge Success Report Modal */}
      {mergeReport && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-filter backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-indigo-500/20 p-6 flex flex-col gap-4 bg-slate-950 relative">
            <button 
              onClick={() => setMergeReport(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-md font-bold text-white">{t.mergeSuccessTitle}</h3>
                <p className="text-[10px] text-slate-400">{mergeReport.timestamp}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 my-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">{t.resourceNameLabel}</span>
                <span className="font-bold text-slate-200">{mergeReport.output_name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">{t.sourceAddonsLabel}</span>
                <span className="font-bold text-slate-200">{mergeReport.source_resources.length} {t.packages}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">{t.streamFilesCopied}</span>
                <span className="font-bold text-slate-200">{mergeReport.copied_stream_files.length} {t.items}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">{t.mergedMetaFiles}</span>
                <span className="font-bold text-slate-200">{mergeReport.merged_meta_files.join(', ')}</span>
              </div>
            </div>

            {mergeReport.warnings.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                <p className="font-bold mb-1 flex items-center gap-1"><AlertTriangle size={12} /> {t.warningsLabel}</p>
                <ul className="list-disc list-inside mt-0.5 opacity-90 flex flex-col gap-0.5">
                  {mergeReport.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              onClick={() => setMergeReport(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-white/5 text-xs text-white font-bold cursor-pointer hover:bg-slate-850"
            >
              {t.closeSummary}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
