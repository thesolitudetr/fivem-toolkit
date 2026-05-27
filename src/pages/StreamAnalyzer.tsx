import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { 
  FolderOpen, 
  ArrowUpDown, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  FileCode,
  Sliders,
  Download
} from 'lucide-react';

export const StreamAnalyzer: React.FC = () => {
  const { 
    selectedPath, 
    setSelectedPath, 
    scannedResource, 
    setScannedResource, 
    streamReport, 
    setStreamReport, 
    settings, 
    saveDbSettings,
    loadDb
  } = useStore();
  const t = translations[settings.language] || translations.en;

  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'category'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showConfig, setShowConfig] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'md' | 'html'>('html');

  // Load custom values for sliders
  const [largeYtd, setLargeYtd] = useState(settings.thresholds.large_ytd / 1024 / 1024);
  const [largeYft, setLargeYft] = useState(settings.thresholds.large_yft / 1024 / 1024);
  const [largeAwc, setLargeAwc] = useState(settings.thresholds.large_awc / 1024 / 1024);
  const [overallRes, setOverallRes] = useState(settings.thresholds.overall_resource / 1024 / 1024);

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.analyzerTitle
      });

      if (selected && typeof selected === 'string') {
        setSelectedPath(selected);
        await runAnalysis(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const runAnalysis = async (path: string) => {
    setIsScanning(true);
    setErrorMsg('');
    try {
      const res = await invoke<any>('scan_resource', { path });
      setScannedResource(res);

      const report = await invoke<any>('analyze_stream', { resourcePath: path });
      setStreamReport(report);
      await loadDb();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to scan and analyze folder.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveThresholds = async () => {
    const newSettings = {
      ...settings,
      thresholds: {
        large_ytd: largeYtd * 1024 * 1024,
        large_yft: largeYft * 1024 * 1024,
        large_awc: largeAwc * 1024 * 1024,
        overall_resource: overallRes * 1024 * 1024,
      }
    };
    await saveDbSettings(newSettings);
    setShowConfig(false);
    if (selectedPath) {
      await runAnalysis(selectedPath);
    }
  };

  const handleExport = async () => {
    if (!streamReport) return;
    try {
      const ext = exportFormat === 'json' ? 'json' : exportFormat === 'md' ? 'md' : 'html';
      const file_path = await save({
        filters: [{ name: 'Report', extensions: [ext] }],
        defaultPath: `${streamReport.resource_name}_analysis_report.${ext}`
      });

      if (file_path) {
        await invoke('export_analysis_report', {
          report: streamReport,
          exportPath: file_path,
          formatType: exportFormat
        });
        alert(t.reportExportSuccess.replace('{path}', file_path));
      }
    } catch (e: any) {
      alert(t.reportExportFailed.replace('{message}', e.message || 'Unknown error'));
    }
  };

  // Grouped Categories sizes
  const categoryKeys = streamReport ? Object.keys(streamReport.category_sizes) : [];

  // Sorted Files List
  const filesList = scannedResource ? [...scannedResource.files] : [];
  filesList.sort((a, b) => {
    let comp = 0;
    if (sortBy === 'name') {
      comp = a.name.localeCompare(b.name);
    } else if (sortBy === 'size') {
      comp = a.size - b.size;
    } else if (sortBy === 'category') {
      comp = a.category.localeCompare(b.category);
    }
    return sortOrder === 'desc' ? -comp : comp;
  });

  const toggleSort = (field: 'name' | 'size' | 'category') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.analyzerTitle}</h2>
          <p className="text-sm text-slate-400">{t.analyzerDesc}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white cursor-pointer hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-semibold"
          >
            <Sliders size={16} />
            <span>{t.thresholdSettings}</span>
          </button>
        </div>
      </div>

      {/* Path Selector */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-3 items-center">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={t.selectFolderPlaceholder}
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
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
          onClick={() => selectedPath && runAnalysis(selectedPath)}
          disabled={isScanning || !selectedPath}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isScanning ? t.scanningState : t.scanNowBtn}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Config Panel */}
      {showConfig && (
        <div className="glass-panel p-5 rounded-2xl border border-violet-500/10 bg-slate-950/20 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders size={16} className="text-violet-400" />
            <span>{t.configThresholds}</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.largeYtdLabel}</label>
              <input 
                type="number" 
                value={largeYtd}
                onChange={(e) => setLargeYtd(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.largeYftLabel}</label>
              <input 
                type="number" 
                value={largeYft}
                onChange={(e) => setLargeYft(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.largeAwcLabel}</label>
              <input 
                type="number" 
                value={largeAwc}
                onChange={(e) => setLargeAwc(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.overallResLabel}</label>
              <input 
                type="number" 
                value={overallRes}
                onChange={(e) => setOverallRes(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button 
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button 
              onClick={handleSaveThresholds}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/15"
            >
              {t.applyBtn}
            </button>
          </div>
        </div>
      )}

      {/* Main Results View */}
      {streamReport && (
        <div className="flex flex-col gap-6">
          {/* Top Widgets: Size Categorization and Alert strip */}
          <div className="grid grid-cols-3 gap-6">
            {/* Category Sizes */}
            <div className="col-span-2 glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sizeCategoryTitle}</h3>
              <div className="grid grid-cols-3 gap-3">
                {categoryKeys.map((cat) => {
                  const size = streamReport.category_sizes[cat] || 0;
                  const count = streamReport.category_counts[cat] || 0;
                  if (size === 0) return null;
                  return (
                    <div key={cat} className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cat}</p>
                        <p className="text-xs text-slate-400 font-semibold mt-1">{count} {t.files}</p>
                      </div>
                      <p className="text-sm font-extrabold text-white">{(size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Section */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.exportSummary}</h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {t.exportDesc}
                </p>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <div className="flex gap-2">
                  {['html', 'md', 'json'].map((fmt) => (
                    <button 
                      key={fmt}
                      onClick={() => setExportFormat(fmt as any)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer uppercase ${exportFormat === fmt ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={handleExport}
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  <span>{t.exportReportBtn}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Warnings Strip */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.alertTitle}</h3>
            {streamReport.warnings.length === 0 ? (
              <div className="flex items-center gap-2.5 text-emerald-400 font-semibold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-xs">
                <CheckCircle2 size={16} />
                <span>{t.noWarningsAlert}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {streamReport.warnings.map((w, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs ${
                      w.severity === 'critical' 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    }`}
                  >
                    <AlertCircle size={16} className="mt-0.5" />
                    <div>
                      <p className="font-extrabold text-white">
                        {w.relative_path || w.file_name} ({ (w.file_size / 1024 / 1024).toFixed(2) } MB)
                      </p>
                      <p className="opacity-90 leading-relaxed mt-0.5">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files Grid list */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/60 border-b border-white/5 text-slate-400 uppercase font-extrabold tracking-wider">
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">
                      {t.fileNameCol} <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('category')}>
                    <span className="flex items-center gap-1">
                      {t.categoryCol} <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('size')}>
                    <span className="flex items-center gap-1">
                      {t.fileSizeCol} <ArrowUpDown size={12} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filesList.map((file, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-all text-slate-300">
                    <td className="p-4 font-mono truncate max-w-xs">{file.relative_path}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-white/5 text-[10px] font-bold uppercase text-slate-400">
                        {file.category}
                      </span>
                    </td>
                    <td className="p-4 font-semibold">{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
