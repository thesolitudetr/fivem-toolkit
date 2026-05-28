import React from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { 
  LayoutDashboard, 
  Car, 
  Activity, 
  FolderOpen, 
  FileCode, 
  Link2, 
  Download, 
  Settings, 
  Heart,
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, settings } = useStore();
  const t = translations[settings.language] || translations.en;

  const menuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'merger', label: t.vehicleMerger, icon: Car },
    { id: 'analyzer', label: t.streamAnalyzer, icon: Activity },
    { id: 'browser', label: t.packBrowser, icon: FolderOpen },
    { id: 'fixer', label: t.metaFixer, icon: FileCode },
    { id: 'dependencies', label: t.dependencies, icon: Link2 },
    { id: 'export', label: t.buildExport, icon: Download },
    { id: 'optimizer', label: t.textureOptimizer, icon: Sparkles },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  return (
    <div className="w-[270px] min-w-[270px] max-w-[270px] shrink-0 bg-[#090d16] border-r border-white/5 flex flex-col justify-between h-full p-4 select-none">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg 
              className="w-5 h-5 text-white" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-wide leading-none">
              DEXTA
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-2 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t.version}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{t.builtWith}</span>
            <Heart size={8} className="text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
