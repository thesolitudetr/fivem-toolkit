import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { useStore } from '../store';
import { translations } from '../translations';

export const Titlebar: React.FC = () => {
  const { settings } = useStore();
  const t = translations[settings.language] || translations.en;
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const win = getCurrentWindow();
    await win.minimize();
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const win = getCurrentWindow();
    await win.toggleMaximize();
    const max = await win.isMaximized();
    setIsMaximized(max);
  };

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const win = getCurrentWindow();
    await win.close();
  };

  const handleDrag = async (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      try {
        const win = getCurrentWindow();
        await win.startDragging();
      } catch (err) {
        console.error('Error starting drag:', err);
      }
    }
  };

  useEffect(() => {
    const win = getCurrentWindow();
    const checkMaximized = async () => {
      const max = await win.isMaximized();
      setIsMaximized(max);
    };

    checkMaximized();
    // Poll maximized status occasionally or on window resize
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  return (
    <div 
      onMouseDown={handleDrag}
      onDoubleClick={handleMaximize}
      data-tauri-drag-region 
      className="titlebar flex items-center justify-between pl-4 pr-0 select-none cursor-default"
    >
      <div 
        onMouseDown={handleDrag}
        data-tauri-drag-region 
        className="flex items-center gap-2 text-xs font-semibold text-slate-400"
      >
        <span data-tauri-drag-region className="text-indigo-400 font-extrabold tracking-wider">DEXTA</span>
        <span data-tauri-drag-region className="opacity-40">|</span>
        <span data-tauri-drag-region>{t.subtitle}</span>
      </div>

      <div 
        className="flex items-center h-full"
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleMinimize}
          className="titlebar-button cursor-pointer h-full"
          title={t.titleMinimize}
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleMaximize}
          className="titlebar-button cursor-pointer h-full"
          title={isMaximized ? t.titleRestore : t.titleMaximize}
        >
          <Square size={12} />
        </button>
        <button 
          onClick={handleClose}
          className="titlebar-button close cursor-pointer h-full"
          title={t.titleClose}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
