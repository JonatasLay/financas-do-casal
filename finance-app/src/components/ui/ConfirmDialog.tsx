'use client'

import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-xs rounded-2xl p-5"
        style={{
          background: 'rgba(13,13,26,0.99)',
          border: `1px solid ${danger ? 'rgba(248,113,113,0.35)' : 'rgba(129,140,248,0.35)'}`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 40px ${danger ? 'rgba(248,113,113,0.1)' : 'rgba(129,140,248,0.1)'}`,
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: danger ? 'rgba(248,113,113,0.12)' : 'rgba(129,140,248,0.12)' }}
          >
            <AlertTriangle className="w-6 h-6" style={{ color: danger ? '#F87171' : '#818CF8' }} />
          </div>
          <div>
            <h3 className="font-bold text-sm mb-1.5" style={{ color: '#F1F5F9' }}>{title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{message}</p>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={danger
                ? { background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.4)' }
                : { background: 'rgba(129,140,248,0.15)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
