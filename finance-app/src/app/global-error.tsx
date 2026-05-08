'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FDF2F8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'Inter, system-ui, sans-serif',
          margin: 0,
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '360px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(99,102,241,0.15)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>💔</p>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
            App indisponível
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {error.message || 'Ocorreu um erro crítico. Recarregue a página.'}
          </p>
          <button
            onClick={reset}
            style={{
              width: '100%',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}
