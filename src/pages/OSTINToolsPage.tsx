import { useState } from 'react';
import { ExifToolPanel } from '../components/ExifToolPanel';
import { GhuntPanel } from '../components/GhuntPanel';

export const OSTINToolsPage = () => {
  const [activeTab, setActiveTab] = useState<'exiftool' | 'ghunt'>('exiftool');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient">OSINT Tools</h1>
          <p className="text-police-400">ExifTool metadata extraction and GHunt OSINT intelligence gathering</p>
        </div>
      </div>

      <div className="flex border-b border-police-700 mb-6">
        <button
          onClick={() => setActiveTab('exiftool')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'exiftool'
              ? 'bg-police-800 text-white border-b-2 border-accent-cyan'
              : 'text-police-400 hover:bg-police-800/50 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          ExifTool
        </button>
        <button
          onClick={() => setActiveTab('ghunt')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'ghunt'
              ? 'bg-police-800 text-white border-b-2 border-accent-cyan'
              : 'text-police-400 hover:bg-police-800/50 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          GHunt
        </button>
      </div>

      {activeTab === 'exiftool' && <ExifToolPanel />}
      {activeTab === 'ghunt' && <GhuntPanel />}
    </div>
  );
};

export default OSTINToolsPage;
