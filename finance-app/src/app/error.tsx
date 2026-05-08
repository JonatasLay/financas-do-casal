'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-app flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-float p-8 max-w-sm w-full text-center">
        <p className="text-5xl mb-4">😵</p>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Algo deu errado</h2>
        <p className="text-sm text-gray-500 mb-1 leading-relaxed">
          {error.message || 'Ocorreu um erro inesperado.'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-300 mb-6 font-mono">{error.digest}</p>
        )}
        <div className="flex gap-3 mt-6">
          <Link
            href="/"
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            Início
          </Link>
          <button
            onClick={reset}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  )
}
