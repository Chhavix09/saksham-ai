import { CheckSquare, FileText, Square } from 'lucide-react'
import { useT } from '@/i18n'
import type { DocumentItem } from '@/types'

export function documentLabel(name: string): string {
  const labels: Record<string, string> = {
    identity_proof: 'Identity proof (Aadhaar / PAN / Voter ID)',
    address_proof: 'Address proof (utility bill / ration card)',
    income_certificate: 'Income certificate',
    project_documents: 'Project / business documents',
    education_documents: 'Education documents (marksheet / admission letter)',
    bank_details: 'Bank account details (passbook / cancelled cheque)',
    business_registration: 'Business registration proof',
  }
  return labels[name] ?? name.replace(/_/g, ' ')
}

export function requiredDocumentsToItems(required: string[]): DocumentItem[] {
  return required.map((name) => ({ name, label: documentLabel(name), provided: false }))
}

export default function DocumentChecklist({
  items,
  onChange,
}: {
  items: DocumentItem[]
  onChange: (items: DocumentItem[]) => void
}) {
  const { t } = useT()
  const toggle = (index: number) => {
    const next = items.map((item, i) => (i === index ? { ...item, provided: !item.provided } : item))
    onChange(next)
  }
  const providedCount = items.filter((i) => i.provided).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{t('appl.documentsHint')}</p>
        <span className="badge-brand">
          {providedCount}/{items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => toggle(index)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                item.provided ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-200'
              }`}
              aria-pressed={item.provided}
            >
              {item.provided ? (
                <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
              ) : (
                <Square className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
              )}
              <span className="flex items-start gap-2 text-sm text-slate-700">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}