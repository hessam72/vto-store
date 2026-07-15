'use client'

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center overflow-hidden font-[family-name:var(--font-vazir)]">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-amber-600 to-amber-500 rounded-full mix-blend-screen filter blur-3xl animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-yellow-600 to-amber-500 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* Spinning gem icon */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 border-r-yellow-400 animate-spin"></div>

            {/* Middle rotating ring (opposite direction) */}
            <div className="absolute inset-2 rounded-full border-3 border-transparent border-b-amber-300 border-l-yellow-300 animate-spin" style={{ animationDirection: 'reverse' }}></div>

            {/* Inner gem */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/50">
              <div className="text-2xl">✨</div>
            </div>
          </div>
        </div>

        {/* Farsi text */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent animate-pulse">
           ویترین مجازی
          </h1>

          <div className="space-y-3">
            <p className="text-lg md:text-xl text-amber-100 animate-pulse" style={{ animationDelay: '0.2s' }}>
              در حال بارگذاری تجربه سه‌بعدی...
            </p>

            {/* Loading dots */}
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>

          {/* Secondary text */}
          <p className="text-sm md:text-base text-amber-200/70 mt-8">
            لطفا صبور باشید...
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-12 w-64 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>

      {/* Floating particles (subtle) */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
