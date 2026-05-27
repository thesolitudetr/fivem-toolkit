import React, { useState } from 'react';
import { useStore, MetaIssue } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  FileCode, 
  FolderOpen, 
  AlertTriangle, 
  CheckCircle2, 
  Wrench,
  X,
  RefreshCw,
  Zap
} from 'lucide-react';

export const MetaFixer: React.FC = () => {
  const { settings, loadDb } = useStore();
  const t = translations[settings.language] || translations.en;

  const [resourcePath, setResourcePath] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [issues, setIssues] = useState<MetaIssue[]>([]);
  const [scanPerformed, setScanPerformed] = useState(false);
  const [fixedPath, setFixedPath] = useState('');
  const [outputDir, setOutputDir] = useState('');

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.fixerTitle
      });

      if (selected && typeof selected === 'string') {
        setResourcePath(selected);
        await runValidation(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing folder');
    }
  };

  const runValidation = async (path: string) => {
    setIsValidating(true);
    setErrorMsg('');
    setFixedPath('');
    setIssues([]);
    try {
      const val = await invoke<any>('validate_resource', { resourcePath: path });
      setIssues(val.issues);
      setScanPerformed(true);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Validation failed.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.stagingOutputFolder
      });

      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleApplyFixes = async () => {
    if (!resourcePath || !outputDir) {
      setErrorMsg(t.selectBothFolders);
      return;
    }

    setIsFixing(true);
    setErrorMsg('');
    try {
      const path = await invoke<string>('fix_resource', {
        resourcePath,
        outputDir,
        inPlace: false
      });
      setFixedPath(path);
      setIssues([]); // clear issues list
      await loadDb(); // refresh history
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to apply corrections.');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.fixerTitle}</h2>
        <p className="text-sm text-slate-400">{t.fixerDesc}</p>
      </div>

      {/* Path Selector */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-3 items-center">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={t.selectFixerPlaceholder}
            value={resourcePath}
            onChange={(e) => setResourcePath(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
          />
        </div>
        <button 
          onClick={handleSelectFolder}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
          title={t.browseFolder}
        >
          <FolderOpen size={16} />
        </button>
        <button 
          onClick={() => resourcePath && runValidation(resourcePath)}
          disabled={isValidating || !resourcePath}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50"
        >
          {isValidating ? t.validatingState : t.validateBtn}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Validation Results */}
      {scanPerformed && (
        <div className="grid grid-cols-3 gap-6">
          {/* Diagnostic List */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.issuesFoundTitle}</h3>
              
              {issues.length === 0 ? (
                <div className="flex items-center gap-2.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-xs font-semibold">
                  <CheckCircle2 size={16} />
                  <span>{t.noIssuesFound}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {issues.map((issue) => (
                    <div 
                      key={issue.id}
                      className={`p-4 rounded-xl border text-xs flex items-start gap-3.5 ${
                        issue.severity === 'critical' 
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-200' 
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                      }`}
                    >
                      <AlertTriangle size={16} className="mt-0.5" />
                      <div className="flex-1">
                        <p className="font-extrabold text-white">{issue.description}</p>
                        <p className="opacity-80 mt-1.5 leading-relaxed">
                          <span className="font-bold uppercase tracking-wide text-[10px] bg-slate-900 border border-white/5 px-2 py-0.5 rounded mr-1.5">{t.proposedFixLabel}</span>
                          {issue.proposed_fix}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action configurations */}
          {issues.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.applyManifestRepair}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t.repairDesc}
                </p>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.stagingOutputFolder}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={outputDir}
                      onChange={(e) => setOutputDir(e.target.value)}
                      placeholder={t.selectOutputTarget}
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
                  onClick={handleApplyFixes}
                  disabled={isFixing || !outputDir}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Wrench size={14} />
                  <span>{t.applyFixBtn}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fixed output alert */}
      {fixedPath && (
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{t.fixedSuccessMsg}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{fixedPath}</p>
            </div>
          </div>
          <button 
            onClick={() => setFixedPath('')}
            className="p-1 rounded hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
