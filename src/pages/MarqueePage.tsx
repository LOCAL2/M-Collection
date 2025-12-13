import { useMemo } from "react";
import { ThreeDMarquee } from "../components/ui/3d-marquee";

interface Props {
  onClose: () => void;
  theme?: 'light' | 'dark';
  images?: string[];
}

// ฟังก์ชันสุ่ม array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function MarqueePage({ onClose, theme = 'dark', images }: Props) {
  // สุ่มรูปจาก gallery (ใช้ useMemo เพื่อไม่ให้สุ่มใหม่ทุกครั้งที่ re-render)
  const displayImages = useMemo(() => {
    if (images && images.length > 0) {
      // สุ่มและเลือก 32 รูป
      return shuffleArray(images).slice(0, 32);
    }
    return [];
  }, [images]);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      style={{ 
        backgroundColor: theme === 'light' ? '#f0f4f8' : '#0f172a', 
        backgroundImage: theme === 'light'
          ? 'linear-gradient(rgba(148, 163, 184, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.5) 1px, transparent 1px)'
          : 'linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)', 
        backgroundSize: '25px 25px' 
      }}
    >
      <div className="min-h-screen">
        {/* Header */}
        <header className={`backdrop-blur-md border-b sticky top-0 z-10 ${
          theme === 'light' 
            ? 'bg-white/80 border-slate-200/50' 
            : 'bg-slate-900/80 border-slate-700/50'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === 'dark' ? 'bg-purple-500' : 'bg-purple-600'
                }`}>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    3D View
                  </h1>
                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Interactive 3D Gallery
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  theme === 'light' 
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className={`${theme === 'light' ? 'bg-white/95 border-gray-200' : 'bg-slate-900/95 border-slate-800'} backdrop-blur-sm rounded-2xl border p-6`}>
            <ThreeDMarquee images={displayImages} />
          </div>
        </div>
      </div>
    </div>
  );
}
