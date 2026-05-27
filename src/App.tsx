import React, { useEffect } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { StreamAnalyzer } from './pages/StreamAnalyzer';
import { VehicleMerger } from './pages/VehicleMerger';
import { PackBrowser } from './pages/PackBrowser';
import { MetaFixer } from './pages/MetaFixer';
import { DependencyScanner } from './pages/DependencyScanner';
import { BuildExport } from './pages/BuildExport';
import { Settings } from './pages/Settings';
import { useStore } from './store';

function App() {
  const { currentPage, loadDb } = useStore();

  useEffect(() => {
    // Load local AppData SQLite/JSON database configurations on start
    loadDb();
  }, [loadDb]);

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'analyzer':
        return <StreamAnalyzer />;
      case 'merger':
        return <VehicleMerger />;
      case 'browser':
        return <PackBrowser />;
      case 'fixer':
        return <MetaFixer />;
      case 'dependencies':
        return <DependencyScanner />;
      case 'export':
        return <BuildExport />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#05070e] text-slate-100 select-none">
      {/* Custom Title bar with drag region and controls */}
      <Titlebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Nav Navigation */}
        <Sidebar />

        {/* Dynamic Inner Page Content */}
        <main className="flex-grow overflow-hidden h-full">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}

export default App;
