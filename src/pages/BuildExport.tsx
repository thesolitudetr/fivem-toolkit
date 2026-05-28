import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Download, 
  FolderOpen, 
  AlertTriangle, 
  CheckCircle2, 
  FileArchive,
  ArrowRight
} from 'lucide-react';

export const BuildExport: React.FC = () => {
  const { settings, loadDb } = useStore();
  const t = translations[settings.language] || translations.en;

  const [srcDir, setSrcDir] = useState('');
  const [destDir, setDestDir] = useState('');
  const [exportAsZip, setExportAsZip] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [exportResult, setExportResult] = useState<any>(null);

  const handleSelectSrc = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.sourceResourceFolder
      });

      if (selected && typeof selected === 'string') {
        setSrcDir(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const handleSelectDest = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.destinationFolder
      });

      if (selected && typeof selected === 'string') {
        setDestDir(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const handleRunExport = async () => {
    if (!srcDir || !destDir) {
      setErrorMsg(t.selectBothFolders);
      return;
    }

    setIsExporting(true);
    setErrorMsg('');
    setExportResult(null);

    try {
      const res = await invoke<any>('export_build', {
        srcDir,
        destDir,
        asZip: exportAsZip
      });
      setExportResult(res);
      await loadDb(); // refresh history logs
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Build export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.buildExport}</h2>
          <p className="text-sm text-slate-400">{t.buildExportDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Configurations panel */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.exportSettings}</h3>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.sourceResourceFolder}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={t.selectSourceFolder}
                  value={srcDir}
                  onChange={(e) => setSrcDir(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                />
                <button 
                  onClick={handleSelectSrc}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.destinationFolder}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={t.selectDestination}
                  value={destDir}
                  onChange={(e) => setDestDir(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                />
                <button 
                  onClick={handleSelectDest}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            {/* Toggle ZIP compilation */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-white/5 mt-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <FileArchive size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">{t.compileZipTitle}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t.compileZipDesc}</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={exportAsZip}
                onChange={(e) => setExportAsZip(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-700 bg-slate-950 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <button 
              onClick={handleRunExport}
              disabled={isExporting || !srcDir || !destDir}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 mt-3"
            >
              <Download size={14} />
              <span>{isExporting ? t.exportingState : t.buildExportBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Export Result Details */}
      {exportResult && (
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{t.exportSuccessMsg}</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-medium">
                <span>{exportResult.total_files} {t.files}</span>
                <span>•</span>
                <span>{(exportResult.total_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <p className="text-[10px] font-mono text-emerald-400 mt-1.5">{exportResult.output_path}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
