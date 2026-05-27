import React, { useState } from 'react';
import { useStore, DependencyScanReport } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Link2, 
  FolderOpen, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Cpu,
  Lock
} from 'lucide-react';

export const DependencyScanner: React.FC = () => {
  const { settings, isPro } = useStore();
  const t = translations[settings.language] || translations.en;

  const [resourcePath, setResourcePath] = useState('');
  const [serverRoot, setServerRoot] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [report, setReport] = useState<DependencyScanReport | null>(null);

  const handleSelectResource = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.selectResourceFolder
      });

      if (selected && typeof selected === 'string') {
        setResourcePath(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const handleSelectServerRoot = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.selectServerRoot
      });

      if (selected && typeof selected === 'string') {
        setServerRoot(selected);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRunScan = async () => {
    if (!resourcePath) {
      setErrorMsg(t.selectResourceFolder);
      return;
    }

    setIsScanning(true);
    setErrorMsg('');
    try {
      const rep = await invoke<DependencyScanReport>('scan_dependencies', {
        resourcePath,
        serverRoot: serverRoot || null
      });
      setReport(rep);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Dependency scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const missingDeps = report?.declared_dependencies.filter(d => d.is_missing_locally) || [];
  const foundDeps = report?.declared_dependencies.filter(d => !d.is_missing_locally) || [];

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.depTitle}</h2>
          <p className="text-sm text-slate-400">{t.depDesc}</p>
        </div>
        {!isPro && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold shadow-md shadow-violet-500/5">
            <Lock size={12} />
            <span>{t.proFeature}</span>
          </span>
        )}
      </div>

      {/* Path Selector */}
      <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.fivemResourcePath}</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t.selectResourceFolder}
              value={resourcePath}
              onChange={(e) => setResourcePath(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
            />
            <button 
              onClick={handleSelectResource}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.serverRootLabel}</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t.selectServerRoot}
              value={serverRoot}
              onChange={(e) => setServerRoot(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none"
            />
            <button 
              onClick={handleSelectServerRoot}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>

        <button 
          onClick={handleRunScan}
          disabled={isScanning || !resourcePath}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
        >
          <Cpu size={14} />
          <span>{isScanning ? t.scanningDeps : t.scanDependencies}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scan Report Results */}
      {report && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 flex flex-col gap-4">
            {/* Legacy Warning Strip */}
            {report.legacy_warnings.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> {t.manifestWarning}</p>
                <p className="opacity-90 leading-relaxed mt-1">{report.legacy_warnings[0]}</p>
              </div>
            )}

            {/* Dependency maps list */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.declaredDepsTitle}</h3>

              {report.declared_dependencies.length === 0 ? (
                <div className="flex items-center gap-2.5 text-slate-400 bg-slate-900/40 p-4 rounded-xl text-xs">
                  <CheckCircle2 size={16} />
                  <span>{t.noDepsFound}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {missingDeps.map((dep, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
                      <div className="flex items-center gap-2">
                        <Link2 size={14} />
                        <span className="font-bold text-white">{dep.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 uppercase tracking-wider">
                        {t.missingLocally}
                      </span>
                    </div>
                  ))}

                  {foundDeps.map((dep, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <Link2 size={14} />
                        <span className="font-bold text-white">{dep.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 uppercase tracking-wider">
                        {t.activeFound}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
