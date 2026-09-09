import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, TriangleAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useT } from '@/i18n'

export function LoadingState({ label }: { label?: string }) {
  const { t } = useT()
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
      <p className="text-sm">{label ?? t('common.loading')}</p>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : undefined
  return <ErrorState message={message ?? 'Something went wrong.'} onRetry={onRetry} />
}

/** Accessible confirmation dialog for destructive or consequential actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => confirmRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(id)
    }
  }, [open, busy, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => !busy && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
                {cancelLabel ?? t('common.cancel')}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={danger ? 'btn-danger' : 'btn-primary'}
                onClick={onConfirm}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT()
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle className="h-10 w-10 text-saffron-500" aria-hidden="true" />
      <p className="max-w-sm text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="document"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function MatchBar({ score, colorClass = 'bg-brand-600' }: { score: number; colorClass?: string }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(score)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(score)}%`}
    >
      <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function Disclaimer({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ${className}`} role="note">
      {text}
    </p>
  )
}