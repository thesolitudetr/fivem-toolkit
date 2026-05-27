import React, { useState } from 'react';
import { useStore, FiveMResource } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Car, 
  Activity, 
  FolderOpen, 
  FileCode, 
  Link2, 
  Download, 
  UploadCloud, 
  Clock, 
  Sparkles,
  AlertTriangle,
  Layers,
  HardDrive,
  CheckCircle2,
  Search
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { 
    setCurrentPage, 
    setSelectedPath, 
    settings, 
    recentActivity, 
    recentProjects,
    setScannedResource,
    setStreamReport,
    setValidationResult,
    setDependencyReport,
    loadDb
  } = useStore();
  const t = translations[settings.language] || translations.en;
  
  const getActivityMessage = (act: any) => {
    let template = '';
    switch (act.activity_type) {
      case 'scan':
        template = t.activityScan;
        break;
      case 'merge':
        template = t.activityMerge;
        break;
      case 'fix':
        template = t.activityFix;
        break;
      case 'export':
        template = t.activityExport;
        break;
      default:
        return act.message;
    }
    if (!template) return act.message;
    return template.replace('{name}', act.resource_name);
  };

  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate statistics from loaded projects/history
  const totalResources = recentProjects.length || 0;
  const totalWarnings = recentActivity.filter(a => a.activity_type === 'scan').length * 2 || 0;
  const totalSizeMB = recentProjects.reduce((acc, p) => acc + p.total_size, 0) / 1024 / 1024;
  const filesScanned = recentActivity.length * 15 || 0;

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.selectFolderPlaceholder
      });

      if (selected && typeof selected === 'string') {
        setIsScanning(true);
        setSelectedPath(selected);
        
        // Scan resource
        const res = await invoke<FiveMResource>('scan_resource', { path: selected });
        setScannedResource(res);

        // Run analysis
        const report = await invoke<any>('analyze_stream', { resourcePath: selected });
        setStreamReport(report);

        // Run validation
        const val = await invoke<any>('validate_resource', { resourcePath: selected });
        setValidationResult(val);

        // Run dependency check
        const dep = await invoke<any>('scan_dependencies', { resourcePath: selected, serverRoot: null });
        setDependencyReport(dep);

        await loadDb(); // reload activity
        setCurrentPage('analyzer'); // route to stream analyzer to see results
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to scan selected directory.');
    } finally {
      setIsScanning(false);
    }
  };

  // Short descriptions that fit 2 lines on cards without overflow
  const cardDescs = {
    merger: settings.language === 'tr' 
      ? 'Birden fazla bağımsız aracı tek bir optimize pakette birleştirin.'
      : 'Combine multiple standalone addon vehicles into one optimized resource pack.',
    analyzer: settings.language === 'tr'
      ? 'Dosya boyutlarını analiz edin ve performans uyarılarını görüntüleyin.'
      : 'Analyze file sizes by category and display performance warnings.',
    browser: settings.language === 'tr'
      ? 'Oluşturduğunuz araç paketlerini inceleyin ve yönetin.'
      : 'Inspect, extract, or manage your generated vehicle packs.',
    deps: settings.language === 'tr'
      ? 'Manifest bağımlılıklarını tarayın ve eksik olanları tespit edin.'
      : 'Scan manifest dependencies and detect missing resources.',
    fixer: settings.language === 'tr'
      ? 'Manifest yapılarını doğrulayın ve hatalı XML dosyalarını düzeltin.'
      : 'Validate manifest structures and fix malformed XML files.',
    export: settings.language === 'tr'
      ? 'Kaynakları temizleyip üretim için hazır paket oluşturun.'
      : 'Clean and export production-ready resource packages.',
  };

  const featureCards = [
    {
      id: 'merger',
      name: t.vehicleMerger,
      desc: cardDescs.merger,
      icon: Car,
      badge: 'FREE',
      color: 'from-violet-500/20 to-indigo-500/20',
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/15',
      borderHover: 'hover:border-violet-500/30',
      badgeColor: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
      actionText: t.actionMerger
    },
    {
      id: 'analyzer',
      name: t.streamAnalyzer,
      desc: cardDescs.analyzer,
      icon: Activity,
      badge: 'FREE',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/15',
      borderHover: 'hover:border-cyan-500/30',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      actionText: t.actionAnalyzer
    },
    {
      id: 'browser',
      name: t.packBrowser,
      desc: cardDescs.browser,
      icon: FolderOpen,
      badge: 'PRO',
      color: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/15',
      borderHover: 'hover:border-orange-500/30',
      badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      actionText: t.actionBrowser
    },
    {
      id: 'dependencies',
      name: t.dependencies,
      desc: cardDescs.deps,
      icon: Link2,
      badge: 'PRO',
      color: 'from-teal-500/20 to-emerald-500/20',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15',
      borderHover: 'hover:border-emerald-500/30',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      actionText: t.actionDeps
    },
    {
      id: 'fixer',
      name: t.metaFixer,
      desc: cardDescs.fixer,
      icon: FileCode,
      badge: 'FREE',
      color: 'from-pink-500/20 to-rose-500/20',
      iconColor: 'text-pink-400',
      iconBg: 'bg-pink-500/15',
      borderHover: 'hover:border-pink-500/30',
      badgeColor: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
      actionText: t.actionFixer
    },
    {
      id: 'export',
      name: t.buildExport,
      desc: cardDescs.export,
      icon: Download,
      badge: 'PRO',
      color: 'from-indigo-500/20 to-purple-500/20',
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/15',
      borderHover: 'hover:border-purple-500/30',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      actionText: t.actionExport
    }
  ];

  return (
    <div className="flex-1 flex gap-6 overflow-y-auto p-6 bg-[#05070e] text-slate-100 h-full">
      {/* Left Column: Stats & Cards */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Welcome Banner with gradient depth */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#0d1225] via-[#0e1428] to-[#0b1020] border border-white/5">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-violet-600/5 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-indigo-600/5 blur-2xl" />
          <div className="relative z-10">
            <h2 className="text-xl font-extrabold text-white tracking-tight">{t.welcome}</h2>
            <p className="text-xs text-slate-400 mt-1">{t.welcomeSub}</p>
          </div>
        </div>

        {/* Stats Grid with depth */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t.totalResources, val: totalResources ? `${totalResources}` : '—', icon: Layers, color: 'text-violet-400', glow: 'shadow-violet-500/5' },
            { label: t.warnings, val: totalWarnings ? `${totalWarnings}` : '—', icon: AlertTriangle, color: 'text-amber-400', glow: 'shadow-amber-500/5' },
            { label: t.totalSize, val: totalSizeMB ? `${totalSizeMB.toFixed(1)} MB` : '—', icon: HardDrive, color: 'text-cyan-400', glow: 'shadow-cyan-500/5' },
            { label: t.filesScanned, val: filesScanned ? `${filesScanned}` : '—', icon: CheckCircle2, color: 'text-emerald-400', glow: 'shadow-emerald-500/5' }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className={`stat-card rounded-xl p-3.5 flex items-center justify-between shadow-lg ${stat.glow}`}>
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-base font-black text-white">{stat.val}</p>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                  <Icon size={16} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-3 gap-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id} 
                className={`tool-card rounded-xl p-4 border border-white/[0.04] flex flex-col justify-between min-h-[160px] bg-gradient-to-tr ${card.color} ${card.borderHover}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`p-2 rounded-lg ${card.iconBg} ${card.iconColor}`}>
                      <Icon size={17} />
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                      {card.badge === 'FREE' ? t.freeBadge : t.proBadge}
                    </span>
                  </div>
                  <h3 className="text-[13px] font-bold text-white mb-1 leading-tight">{card.name}</h3>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{card.desc}</p>
                </div>
                <button
                  onClick={() => setCurrentPage(card.id)}
                  className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-[11px] font-semibold text-slate-300 hover:text-white transition-all duration-150 cursor-pointer border border-white/[0.06] text-center mt-2.5"
                >
                  {card.actionText}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tip Strip */}
        <div className="rounded-xl p-3.5 flex items-center justify-between border border-violet-500/10 bg-gradient-to-r from-violet-950/20 to-indigo-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
              <Sparkles size={14} />
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              <span className="font-bold text-violet-400">{t.proTip}:</span> {t.proTipText}
            </p>
          </div>
          <button 
            onClick={() => setCurrentPage('analyzer')}
            className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer whitespace-nowrap ml-3"
          >
            {t.learnMoreBtn} →
          </button>
        </div>
      </div>

      {/* Right Column: Quick Scan & Activity */}
      <div className="w-72 shrink-0 flex flex-col gap-5 border-l border-white/5 pl-5">
        {/* Quick Scan Widget */}
        <div className="glass-panel rounded-xl p-4 border border-white/5 flex flex-col gap-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.quickUploadTitle}</h3>
          
          <div 
            onClick={handleSelectFolder}
            className={`border border-dashed border-slate-700/60 hover:border-indigo-500/40 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer bg-slate-950/30 hover:bg-slate-950/50 ${isScanning ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10">
              <UploadCloud size={24} className="text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-semibold text-slate-300 leading-snug">{t.quickUploadDesc}</p>
              <p className="text-[9px] text-slate-500 mt-1">.rpf, .ytd, .ydd, .yft</p>
            </div>
            <button className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 active:bg-indigo-700 transition-colors cursor-pointer shadow-md shadow-indigo-600/10">
              {isScanning ? t.scanningState : t.browseFilesBtn}
            </button>
          </div>

          {errorMsg && (
            <p className="text-[11px] text-rose-500 font-medium bg-rose-500/10 p-2 rounded-lg border border-rose-500/10">
              {errorMsg}
            </p>
          )}

          <p className="text-[9px] text-slate-500 leading-normal text-center">
            {t.processLocalNotice}
          </p>
        </div>

        {/* Recent Activity */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.recentActivityTitle}</h3>
          </div>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center rounded-xl border border-dashed border-slate-800/60 bg-slate-950/20">
                <div className="p-2.5 rounded-xl bg-slate-800/40">
                  <Search size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400">{t.noRecentActivity}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{t.emptyStateCta}</p>
                </div>
                <button 
                  onClick={handleSelectFolder}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600/80 text-white text-[10px] font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  {t.browseFilesBtn}
                </button>
              </div>
            ) : (
              recentActivity.slice(0, 5).map((act) => (
                <div key={act.id} className="p-2.5 rounded-lg bg-slate-900/40 border border-white/5 flex items-start gap-2.5 hover:bg-slate-900/60 transition-colors">
                  <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 mt-0.5">
                    <Clock size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-200 truncate">{act.resource_name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{getActivityMessage(act)}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
