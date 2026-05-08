export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-app flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-gradient-card rounded-2xl flex items-center justify-center shadow-float">
          <span className="text-3xl animate-bounce">💜</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full typing-dot" />
          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full typing-dot" />
          <div className="w-1.5 h-1.5 bg-primary-400 rounded-full typing-dot" />
        </div>
        <p className="text-xs text-gray-400">Carregando...</p>
      </div>
    </div>
  )
}
