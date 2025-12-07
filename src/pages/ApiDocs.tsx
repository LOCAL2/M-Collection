import { useState, useEffect } from 'react';
import { getGalleryStats } from '../api/public-api';

interface Props {
  onClose: () => void;
  userName: string;
  userId: string;
}

export default function ApiDocs({ onClose }: Props) {
  const [stats, setStats] = useState<{
    totalImages: number;
    totalUploaders: number;
    totalSize: number;
    recentUploads: number;
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const baseUrl = `${supabaseUrl}/rest/v1`;

  useEffect(() => {
    getGalleryStats().then(res => {
      if (res.success && res.data) {
        setStats(res.data);
      }
    });
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // สร้าง curl command (single line สำหรับ Windows)
  const buildCurlCommand = (endpoint: string, params: string = '') => {
    const url = `${baseUrl}${endpoint}${params ? `?${params}` : ''}`;
    return `curl "${url}&apikey=${supabaseAnonKey}"`;
  };

  // สร้าง JavaScript code
  const buildJsCode = (endpoint: string, params: string = '') => {
    return `const response = await fetch(
  '${baseUrl}${endpoint}${params ? `?${params}` : ''}&apikey=${supabaseAnonKey}'
);

if (!response.ok) {
  throw new Error(\`API Error: \${response.status}\`);
}

const data = await response.json();
console.log(data);`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: '#0f172a', backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">API Documentation</h1>
                <p className="text-slate-400 text-sm">Public API for developers</p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-all cursor-pointer font-medium border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <p className="text-slate-400 text-sm">Total Images</p>
                <p className="text-2xl font-bold text-white">{stats.totalImages.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <p className="text-slate-400 text-sm">Uploaders</p>
                <p className="text-2xl font-bold text-white">{stats.totalUploaders.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <p className="text-slate-400 text-sm">Total Size</p>
                <p className="text-2xl font-bold text-white">{formatBytes(stats.totalSize)}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <p className="text-slate-400 text-sm">Last 24h</p>
                <p className="text-2xl font-bold text-white">{stats.recentUploads.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Public API Notice */}
          <section className="mb-10">
            <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-6">
              <h3 className="text-green-400 font-bold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Public API - No Authentication Required
              </h3>
              <p className="text-slate-300 text-sm">
                This API is publicly accessible. You can use the URLs below directly in your browser or application.
                No API key required!
              </p>
            </div>
          </section>

          {/* Base URL */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">🔗 Base URL</h2>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
              <code className="text-green-400 text-sm">{baseUrl}</code>
              <button
                onClick={() => copyToClipboard(baseUrl, 200)}
                className="ml-4 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
              >
                {copiedIndex === 200 ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </section>

          {/* Quick Links - Public API */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">🔗 Quick API Endpoints</h2>
            <p className="text-slate-400 text-sm mb-4">
              Click "Open" to view data directly in your browser, or copy the URL to use in your application.
            </p>
            <div className="space-y-3">
              {[
                { title: 'Get all images (latest 20)', params: 'select=*&order=created_at.desc&limit=20' },
                { title: 'Get all images (no limit)', params: 'select=*&order=created_at.desc' },
                { title: 'Get only id, filename, url', params: 'select=id,filename,url&order=created_at.desc' },
                { title: 'Get first image', params: 'select=*&limit=1' },
              ].map((item, idx) => {
                const fullUrl = `${baseUrl}/images?${item.params}&apikey=${supabaseAnonKey}`;
                return (
                  <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="text-white font-medium">{item.title}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(fullUrl, 100 + idx)}
                          className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                        >
                          {copiedIndex === 100 + idx ? 'Copied!' : 'Copy URL'}
                        </button>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                    <code className="text-green-400 text-xs break-all block">{fullUrl}</code>
                  </div>
                );
              })}
            </div>
          </section>

          {/* cURL Commands */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">💻 cURL Commands</h2>
            <p className="text-slate-400 text-sm mb-4">Copy and paste into your terminal</p>
            
            {/* Get All Images */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">GET</span>
                <code className="text-white font-mono">/images</code>
              </div>
              <p className="text-slate-400 text-sm mb-4">Get all images with pagination</p>
              <div className="bg-slate-950 rounded-lg p-4 relative">
                <button
                  onClick={() => copyToClipboard(buildCurlCommand('/images', 'select=*&order=created_at.desc&limit=20'), 2)}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                >
                  {copiedIndex === 2 ? 'Copied!' : 'Copy'}
                </button>
                <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
{buildCurlCommand('/images', 'select=*&order=created_at.desc&limit=20')}
                </pre>
              </div>
            </div>

            {/* Get Image by ID */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">GET</span>
                <code className="text-white font-mono">/images?id=eq.{'{uuid}'}</code>
              </div>
              <p className="text-slate-400 text-sm mb-4">Get a single image by ID</p>
              <div className="bg-slate-950 rounded-lg p-4 relative">
                <button
                  onClick={() => copyToClipboard(buildCurlCommand('/images', 'id=eq.YOUR_IMAGE_ID&select=*'), 4)}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                >
                  {copiedIndex === 4 ? 'Copied!' : 'Copy'}
                </button>
                <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
{buildCurlCommand('/images', 'id=eq.YOUR_IMAGE_ID&select=*')}
                </pre>
              </div>
            </div>

            {/* Search by Filename */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">GET</span>
                <code className="text-white font-mono">/images?filename=ilike.*{'{query}'}*</code>
              </div>
              <p className="text-slate-400 text-sm mb-4">Search images by filename</p>
              <div className="bg-slate-950 rounded-lg p-4 relative">
                <button
                  onClick={() => copyToClipboard(buildCurlCommand('/images', 'filename=ilike.*photo*&select=*'), 5)}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                >
                  {copiedIndex === 5 ? 'Copied!' : 'Copy'}
                </button>
                <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
{buildCurlCommand('/images', 'filename=ilike.*photo*&select=*')}
                </pre>
              </div>
            </div>

            {/* Filter by Uploader */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">GET</span>
                <code className="text-white font-mono">/images?uploader_name=eq.{'{name}'}</code>
              </div>
              <p className="text-slate-400 text-sm mb-4">Get images by uploader name</p>
              <div className="bg-slate-950 rounded-lg p-4 relative">
                <button
                  onClick={() => copyToClipboard(buildCurlCommand('/images', 'uploader_name=eq.username&select=*'), 6)}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                >
                  {copiedIndex === 6 ? 'Copied!' : 'Copy'}
                </button>
                <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
{buildCurlCommand('/images', 'uploader_name=eq.username&select=*')}
                </pre>
              </div>
            </div>
          </section>

          {/* JavaScript Example */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">📝 JavaScript Example</h2>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="bg-slate-950 rounded-lg p-4 relative">
                <button
                  onClick={() => copyToClipboard(buildJsCode('/images', 'select=*&order=created_at.desc&limit=20'), 10)}
                  className="absolute top-2 right-2 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                >
                  {copiedIndex === 10 ? 'Copied!' : 'Copy'}
                </button>
                <pre className="text-sm text-slate-300 overflow-x-auto">
{buildJsCode('/images', 'select=*&order=created_at.desc&limit=20')}
                </pre>
              </div>
            </div>
          </section>

          {/* Query Parameters */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Query Parameters</h2>
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left text-slate-300 p-4">Parameter</th>
                    <th className="text-left text-slate-300 p-4">Description</th>
                    <th className="text-left text-slate-300 p-4">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="p-4 text-white font-mono">select</td>
                    <td className="p-4 text-slate-400">Fields to return</td>
                    <td className="p-4 text-green-400 font-mono">select=id,filename,url</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-white font-mono">order</td>
                    <td className="p-4 text-slate-400">Sort order</td>
                    <td className="p-4 text-green-400 font-mono">order=created_at.desc</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-white font-mono">limit</td>
                    <td className="p-4 text-slate-400">Max results</td>
                    <td className="p-4 text-green-400 font-mono">limit=20</td>
                  </tr>
                  <tr>
                    <td className="p-4 text-white font-mono">offset</td>
                    <td className="p-4 text-slate-400">Skip results</td>
                    <td className="p-4 text-green-400 font-mono">offset=20</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Data Schema */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Data Schema</h2>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="bg-slate-950 rounded-lg p-4">
                <pre className="text-sm text-slate-300 overflow-x-auto">
{`interface Image {
  id: string;              // UUID
  filename: string;        // Original filename
  storage_path: string;    // Path in storage
  url: string;             // Public URL
  uploader_name: string;   // Uploader's name
  file_size: number;       // Size in bytes
  mime_type: string;       // e.g., "image/jpeg"
  width: number | null;    // Image width
  height: number | null;   // Image height
  created_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Example Response */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Example Response</h2>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="bg-slate-950 rounded-lg p-4">
                <pre className="text-sm text-slate-300 overflow-x-auto">
{`[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "photo.jpg",
    "url": "https://xxx.supabase.co/storage/v1/object/public/gallery-images/user/photo.jpg",
    "uploader_name": "username",
    "file_size": 1024000,
    "mime_type": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "created_at": "2024-12-07T10:30:00.000Z"
  }
]`}
                </pre>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center text-slate-500 text-sm py-8 border-t border-slate-800">
            <p>M or new Gallery API v1.0</p>
            <p className="mt-2">For support, contact the gallery administrator</p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
