import { apiFetch } from '../lib/api';
import { useState } from 'react';

export const ExifToolPanel = () => {
  const [action, setAction] = useState<'extract' | 'sanitize'>('extract');
  const [imageData, setImageData] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setImageData(dataUrl);
      setPreviewUrl(dataUrl);
      setResult(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) {
      setError('Please drop an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setImageData(dataUrl);
      setPreviewUrl(dataUrl);
      setResult(null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!imageData) {
      setError('Please select an image first');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
      try {
      const response = await apiFetch('/api/osint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'exiftool', action, imageData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Processing failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card card-hover p-6">
          <h3 className="text-lg font-semibold text-white mb-4">ExifTool Operations</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-police-300 font-medium text-sm">Action</label>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setAction('extract'); setResult(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    action === 'extract' ? 'bg-accent-cyan text-police-900' : 'bg-police-800 text-police-300'
                  }`}
                >
                  Extract Metadata
                </button>
                <button
                  onClick={() => { setAction('sanitize'); setResult(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    action === 'sanitize' ? 'bg-accent-cyan text-police-900' : 'bg-police-800 text-police-300'
                  }`}
                >
                  Sanitize Image
                </button>
              </div>
            </div>

            <div>
              <label className="text-police-300 font-medium text-sm">Select Image</label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="mt-2 border-2 border-dashed border-police-700 rounded-lg p-8 text-center hover:border-accent-cyan transition-colors cursor-pointer"
                onClick={() => document.getElementById('exif-file-input')?.click()}
              >
                <input
                  id="exif-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <svg className="h-10 w-10 mx-auto text-police-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p className="text-police-400 text-sm">Drop an image here or click to browse</p>
                <p className="text-police-600 text-xs mt-1">Supports JPEG, PNG, WebP, TIFF, HEIC (max 50MB)</p>
              </div>
            </div>

            {previewUrl && (
              <div>
                <label className="text-police-300 font-medium text-sm">Preview</label>
                <div className="mt-2 rounded-lg overflow-hidden border border-police-700">
                  <img src={previewUrl} alt="Preview" className="max-h-64 w-full object-contain bg-police-950" />
                </div>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading || !imageData}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Processing...' : action === 'extract' ? 'Extract EXIF Data' : 'Sanitize Image'}
            </button>
          </div>
        </div>

        <div className="card card-hover p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {action === 'extract' ? 'Extracted Metadata' : 'Sanitization Result'}
          </h3>
          
          {error && (
            <div className="mb-4 rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && !error && (
            <div className="space-y-3">
              {action === 'extract' ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.metadata ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-police-400 text-sm">Total Tags Found:</span>
                        <span className="text-accent-cyan font-medium">{result.metadata.allTags}</span>
                      </div>
                      {Object.entries(result.metadata)
                        .filter(([k]) => k !== 'allTags')
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between bg-police-800/50 rounded p-3">
                            <span className="text-police-300 text-sm font-medium">{key}</span>
                            <span className="text-white text-sm">{String(value)}</span>
                          </div>
                        ))}
                      {result.metadata.GPS && (
                        <div className="mt-4 p-4 bg-police-800/50 rounded-lg border border-accent-cyan/30">
                          <h4 className="text-accent-cyan text-sm font-medium mb-2">GPS Coordinates</h4>
                          <p className="text-white text-sm">Latitude: {result.metadata.GPS.latitude}</p>
                          <p className="text-white text-sm">Longitude: {result.metadata.GPS.longitude}</p>
                          {result.metadata.GPS.altitude && (
                            <p className="text-white text-sm">Altitude: {result.metadata.GPS.altitude}</p>
                          )}
                          {result.metadata.GPS.position && (
                            <p className="text-white text-sm">Position: {result.metadata.GPS.position}</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-police-400">No metadata found in this image.</p>
                  )}
                </div>
              ) : (
                <div>
                  {result.sanitized && (
                    <div>
                      <p className="text-green-400 text-sm mb-2">{result.message}</p>
                      <p className="text-police-400 text-sm mb-3">Original size: {(result.originalSize / 1024).toFixed(1)} KB</p>
                      <img src={result.sanitized} alt="Sanitized" className="max-h-64 w-full object-contain rounded-lg border border-police-700" />
                    </div>
                  )}
                  {!result.sanitized && <p className="text-police-400">No result yet.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExifToolPanel;
