import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  FolderOpen, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Layers, 
  Sliders
} from 'lucide-react';

export const TextureOptimizer: React.FC = () => {
  const { settings, loadDb } = useStore();
  const t = translations[settings.language] || translations.en;

  const [folderPath, setFolderPath] = useState('');
  const [maxSize, setMaxSize] = useState<number>(1024);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [logs, setLogs] = useState<string>('');

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setLogs('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.textureOptimizer
      });

      if (selected && typeof selected === 'string') {
        setFolderPath(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const handleOptimize = async () => {
    if (!folderPath) {
      setErrorMsg(t.selectFolderToOptimize);
      return;
    }

    setIsOptimizing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setLogs('');

    try {
      const output = await invoke<string>('optimize_textures', {
        path: folderPath,
        maxSize
      });
      
      setLogs(output);
      setSuccessMsg(t.optSuccessMsg);
      await loadDb(); // reload db logs
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to optimize textures.');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.textureOptimizer}</h2>
        <p className="text-sm text-slate-400">{t.optimizerDesc}</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Side: Setup Card */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-violet-400" />
              <span>{settings.language === 'tr' ? 'Yapılandırma Ayarları' : 'Configuration Settings'}</span>
            </h3>

            {/* Folder Select */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {settings.language === 'tr' ? 'Hedef Klasör Yolu' : 'Target Folder Path'}
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={t.selectFolderToOptimize}
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
                  disabled={isOptimizing}
                />
                <button 
                  onClick={handleSelectFolder}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  disabled={isOptimizing}
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            {/* Max Size Select */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {t.targetResolution}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[512, 1024, 2048].map((size) => (
                  <button
                    key={size}
                    onClick={() => setMaxSize(size)}
                    className={`py-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      maxSize === size 
                        ? 'bg-violet-600/10 border-violet-500 text-violet-400 shadow-md shadow-violet-500/5' 
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    disabled={isOptimizing}
                  >
                    {size}px {size === 1024 ? `(${settings.language === 'tr' ? 'Önerilen' : 'Recommended'})` : ''}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1 leading-normal">
                <AlertTriangle size={12} className="text-amber-500/70" />
                <span>{t.resolutionWarning}</span>
              </p>
            </div>

            {/* Action Buttons */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <button 
              onClick={handleOptimize}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.99] text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:pointer-events-none"
              disabled={isOptimizing}
            >
              {isOptimizing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t.optimizingState}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{t.optimizeBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Output Logs Console */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4 h-[350px]">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              <span>{settings.language === 'tr' ? 'İşlem Günlüğü' : 'Process Console'}</span>
            </h3>

            <div className="flex-1 bg-slate-950/70 border border-slate-900 rounded-xl p-3 font-mono text-[10px] text-slate-400 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
              {isOptimizing ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 size={24} className="animate-spin text-violet-400" />
                  <span className="text-slate-500 animate-pulse">{t.optimizingState}</span>
                </div>
              ) : logs ? (
                logs
              ) : (
                <span className="text-slate-600 italic">
                  {settings.language === 'tr' 
                    ? 'İşlem çıktıları ve log kayıtları burada görüntülenecektir.' 
                    : 'Process logs and outputs will be displayed here.'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
