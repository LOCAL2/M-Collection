import { useMemo, useRef } from "react";
import { MacbookScroll } from "../components/ui/macbook-scroll";

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

export default function MacbookScrollPage({ onClose, theme = 'dark', images }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // สุ่มรูปและเลือกรูปแรก
  const displayImage = useMemo(() => {
    if (images && images.length > 0) {
      const shuffled = shuffleArray(images);
      return shuffled[0];
    }
    return "/real-fake.png"; // fallback image
  }, [images]);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 overflow-auto ${theme === 'light' ? 'bg-white' : 'bg-[#0B0B0F]'}`}
    >
      {/* Header */}
      <header className={`backdrop-blur-md border-b sticky top-0 z-20 ${
        theme === 'light' 
          ? 'bg-white/80 border-slate-200/50' 
          : 'bg-[#0B0B0F]/80 border-slate-700/50'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                theme === 'dark' ? 'bg-slate-600' : 'bg-slate-700'
              }`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Macbook
                </h1>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {images?.length || 0} images
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

      {/* Macbook Scroll Content */}
      <div className="overflow-hidden w-full">
        <MacbookScroll
          src={displayImage}
          showGradient={true}
          containerRef={containerRef}
          title={
            <span className={theme === 'light' ? 'text-gray-900' : 'text-white'}>
              M or new Gallery <br />
              <span className="text-lg font-normal opacity-70">Scroll down to see the magic ✨</span>
            </span>
          }
        />
      </div>

      {images && images.length === 0 && (
        <div className={`text-center py-20 ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
          <p className="text-lg">ไม่มีรูปภาพในแกลเลอรี่</p>
          <p className="text-sm mt-2">อัปโหลดรูปภาพเพื่อดู Macbook Scroll Effect</p>
        </div>
      )}
    </div>
  );
}
