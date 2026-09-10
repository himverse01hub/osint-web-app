import { useState } from 'react';

export const WarningBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-red-900/50 border border-red-700/50 text-red-300 text-sm px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c.77-1.333-.262-3-1.732-3z"></path>
          </svg>
          <span>
            <strong>WARNING:</strong> For authorised investigative use only. All searches must comply with applicable laws and policies.
          </span>
        </div>
        <button onClick={() => setVisible(false)} className="text-red-400 hover:text-red-300 transition-colors px-3 py-1 rounded hover:bg-red-800/20">
          Close
        </button>
      </div>
    </div>
  );
};

export default WarningBanner;
