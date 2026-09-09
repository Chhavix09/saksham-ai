import { Check } from 'lucide-react'

export function ProgressStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Progress">
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-brand-600 text-white'
                    : active
                      ? 'bg-brand-100 text-brand-800 ring-2 ring-brand-500'
                      : 'bg-slate-100 text-slate-400'
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`hidden text-xs font-medium sm:block ${active ? 'text-brand-800' : done ? 'text-slate-700' : 'text-slate-400'}`}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && <div className={`h-0.5 w-6 sm:w-10 ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export function ApplicationStepper({ status }: { status: string }) {
  const steps = [
    'recommendation_generated',
    'documents_pending',
    'submitted',
    'under_review',
    'approved',
    'disbursed',
  ]
  const currentIndex = steps.indexOf(status)
  const rejected = status === 'rejected'

  return (
    <ol className="flex items-center gap-0.5 overflow-x-auto pb-1" aria-label="Application status">
      {steps.map((step, index) => {
        const reached = index <= currentIndex
        return (
          <li key={step} className="flex shrink-0 items-center">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                reached ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
              aria-hidden="true"
            >
              {reached ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            {index < steps.length - 1 && <div className={`h-0.5 w-4 sm:w-8 ${index < currentIndex ? 'bg-brand-600' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
      {rejected && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Rejected</span>}
    </ol>
  )
}