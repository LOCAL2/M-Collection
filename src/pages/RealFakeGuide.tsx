interface Props {
  onClose: () => void;
}

export default function RealFakeGuide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto overflow-x-hidden">
      <div className="min-h-screen overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">วิธีสังเกตของแท้</h1>
                <p className="text-slate-400 text-sm">คู่มือการตรวจสอบความถูกต้องของสินค้า</p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-all cursor-pointer font-medium border border-slate-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Notice */}
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-6 mb-8">
            <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              การสังเกตของแท้
            </h3>
            <p className="text-slate-300 text-sm">
              ศึกษาวิธีการสังเกตความแตกต่างระหว่างของแท้และของปลอม พรี่เอ็มสนับสนุนของแท้นะครับ
            </p>
          </div>

          {/* Image with lazy loading */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-2xl">
            <img 
              src="/real-fake.png" 
              alt="การสังเกตของแท้ - คู่มือเปรียบเทียบของแท้และของปลอม" 
              className="w-full h-auto"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="text-center text-slate-500 text-sm py-8 border-t border-slate-800 mt-8">
          </div>
        </div>
      </div>
    </div>
  );
}
