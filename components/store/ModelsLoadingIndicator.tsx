'use client'

export function ModelsLoadingIndicator() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40 font-[family-name:var(--font-vazir)]">
      <div className="bg-black/50 backdrop-blur-sm text-white px-8 py-6 rounded-2xl text-base border border-purple-500/20 shadow-xl shadow-purple-500/10">
        <div className="flex items-center gap-4">
          {/* Loading spinner */}
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 border-r-pink-400 animate-spin"></div>
          </div>
          <span>بارگذاری مدل‌های سه‌بعدی...</span>
        </div>
      </div>
    </div>
  )
}
