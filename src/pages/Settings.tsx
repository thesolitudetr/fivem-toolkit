import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  FolderOpen, 
  Globe, 
  Sliders, 
  AlertTriangle,
  Info,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { 
    settings, 
    saveDbSettings, 
    clearHistory,
    checkForUpdates,
    updateAvailable,
    latestVersion,
    isCheckingUpdate
  } = useStore();
  const t = translations[settings.language] || translations.en;

  const [lang, setLang] = useState(settings.language);
  const [largeYtd, setLargeYtd] = useState(settings.thresholds.large_ytd / 1024 / 1024);
  const [largeYft, setLargeYft] = useState(settings.thresholds.large_yft / 1024 / 1024);
  const [largeAwc, setLargeAwc] = useState(settings.thresholds.large_awc / 1024 / 1024);
  const [overallRes, setOverallRes] = useState(settings.thresholds.overall_resource / 1024 / 1024);

  const [successMsg, setSuccessMsg] = useState('');
  const [dbPath, setDbPath] = useState('');

  const handleSave = async () => {
    setSuccessMsg('');
    const newSettings = {
      language: lang,
      default_output_dir: settings.default_output_dir,
      thresholds: {
        large_ytd: largeYtd * 1024 * 1024,
        large_yft: largeYft * 1024 * 1024,
        large_awc: largeAwc * 1024 * 1024,
        overall_resource: overallRes * 1024 * 1024,
      }
    };
    await saveDbSettings(newSettings);
    setSuccessMsg(t.settingsSuccess);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleClearLogs = async () => {
    if (confirm(t.clearHistoryConfirm)) {
      await clearHistory();
      alert(t.logsClearedAlert);
    }
  };

  const handleOpenPath = async () => {
    try {
      const path = await invoke<string>('open_app_data_path');
      setDbPath(path);
    } catch (e: any) {
      alert(settings.language === 'tr' ? `Dizin yolu bulunurken hata oluştu: ${e.message}` : `Error locating path: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.settingsTitle}</h2>
        <p className="text-sm text-slate-400">{t.settingsDesc}</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Info size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Configurations inputs */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* General and Language */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Globe size={16} className="text-violet-400" />
              <span>{t.langConfigTitle}</span>
            </h3>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.languageLabel}</label>
              <div className="flex gap-2">
                {['en', 'tr'].map((l) => (
                  <button 
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${lang === l ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {l === 'en' ? 'English' : 'Türkçe'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis limits */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-cyan-400" />
              <span>{t.thresholdConfigTitle}</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.largeYtdLabel}</label>
                <input 
                  type="number" 
                  value={largeYtd}
                  onChange={(e) => setLargeYtd(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.largeYftLabel}</label>
                <input 
                  type="number" 
                  value={largeYft}
                  onChange={(e) => setLargeYft(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.largeAwcLabel}</label>
                <input 
                  type="number" 
                  value={largeAwc}
                  onChange={(e) => setLargeAwc(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.overallResLabel}</label>
                <input 
                  type="number" 
                  value={overallRes}
                  onChange={(e) => setOverallRes(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 cursor-pointer shadow-lg shadow-violet-500/10 flex items-center justify-center gap-1.5"
          >
            <span>{t.saveSettingsBtn}</span>
          </button>
        </div>

        {/* Right Col: Admin & Update Actions */}
        <div className="flex flex-col gap-4">
          {/* Update Checker Panel */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <RefreshCw size={14} className={`text-amber-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{t.updateConfigTitle}</span>
            </h3>

            <div className="flex flex-col gap-3">
              {isCheckingUpdate ? (
                <div className="text-xs text-slate-400 italic flex items-center gap-2">
                  <RefreshCw size={12} className="animate-spin text-slate-500" />
                  <span>{t.updateChecking}</span>
                </div>
              ) : updateAvailable ? (
                <div className="flex flex-col gap-2">
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="animate-pulse" />
                    <span>{t.updateAvailableMsg.replace('{version}', latestVersion || '')}</span>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await openUrl('https://github.com/thesolitudetr/fivem-toolkit');
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/15"
                  >
                    {t.downloadUpdateBtn}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-slate-400 text-xs flex items-center gap-2">
                    <Info size={14} className="text-emerald-400 shrink-0" />
                    <span>{t.updateUpToDateMsg}</span>
                  </div>
                  <button 
                    onClick={() => checkForUpdates()}
                    className="w-full py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white text-xs text-slate-400 font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>{t.checkUpdatesBtn}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sysAdminTitle}</h3>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleOpenPath}
                className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white text-xs text-slate-400 font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <FolderOpen size={14} />
                <span>{t.openAppDataBtn}</span>
              </button>

              <button 
                onClick={handleClearLogs}
                className="w-full py-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 hover:bg-rose-900/10 hover:text-rose-400 text-xs text-rose-300 font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{t.clearHistoryBtn}</span>
              </button>
            </div>

            {dbPath && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono break-all leading-normal text-slate-400">
                {dbPath}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
