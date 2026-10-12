import { useEffect, useMemo, useRef, useState } from 'react'
import { DOCUMENT_KIND_LABEL } from '../../data/recordOptions'
import { Modal, useToast } from '../Shared'
import {
  ACCEPTED_DOCUMENT_TYPES,
  dataUrlToObjectUrl,
  formatBytes,
  isRenderableDocument,
  prepareDocument,
} from '../../services/documentFiles'
import { addDocument, removeDocument, type Actor } from '../../services/recordsService'
import type { DocumentKind, RecordDocument, StudentRecord } from '../../types'
import { ENTRY_KIND_LABEL, formatDate, verifiableEntries, verificationFor, type VerificationMap } from '../../utils/records'
import { Field, SectionCard, VerifiedBadge } from './RecordBits'

export function DocumentViewer({ doc, onClose }: { doc: RecordDocument; onClose: () => void }) {
  const url = useMemo(() => dataUrlToObjectUrl(doc.dataUrl), [doc.dataUrl])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  // Images go through <img> (never executes scripts); only PDFs use the iframe.
  const isImage = doc.dataUrl.startsWith('data:image/')
  const renderable = isRenderableDocument(doc.dataUrl)

  return (
    <Modal title={doc.name} onClose={onClose} wide>
      <p className="text-sm text-ink-muted mb-3">
        {DOCUMENT_KIND_LABEL[doc.kind]} · uploaded by {doc.uploadedByName} on {formatDate(doc.uploadedAt)}
      </p>
      {isImage ? (
        <img src={doc.dataUrl} alt={doc.name} className="w-full max-h-[70vh] object-contain rounded-2xl border border-line bg-white" />
      ) : renderable ? (
        <iframe src={url} title={doc.name} className="w-full h-[70vh] rounded-2xl border border-line bg-white" />
      ) : (
        <p className="text-sm">This file type can't be previewed. Download it to view.</p>
      )}
      <a
        href={url}
        {...(renderable ? { target: '_blank', rel: 'noreferrer' } : { download: doc.name })}
        className="btn-outline inline-block mt-3 text-sm"
      >
        {renderable ? 'Open in new tab' : 'Download'}
      </a>
    </Modal>
  )
}

export default function DocumentsPanel({
  record,
  documents,
  actor,
  onChanged,
  verifications,
  canVerify = false,
  onToggleVerify,
}: {
  record: StudentRecord | null
  documents: RecordDocument[]
  actor: Actor
  onChanged: () => void
  verifications?: VerificationMap
  canVerify?: boolean
  onToggleVerify?: (doc: RecordDocument, verified: boolean) => void
}) {
  const { push } = useToast()
  const [kind, setKind] = useState<DocumentKind>('offer_letter')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<RecordDocument | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const entries = record ? verifiableEntries(record) : []
  const entryLabel = (id: string) => {
    const entry = entries.find((e) => e.item.id === id)
    return entry ? `${ENTRY_KIND_LABEL[entry.kind]}: ${entry.label || 'untitled'}` : ''
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!record || !file) {
      push('Choose a file to upload first.', 'error')
      return
    }
    setBusy(true)
    try {
      const prepared = await prepareDocument(file)
      await addDocument(record, { ...prepared, kind, name: file.name, linkedItemId }, actor)
      push('Document uploaded.', 'success')
      if (fileInput.current) fileInput.current.value = ''
      setLinkedItemId('')
      onChanged()
    } catch (error: any) {
      console.error(error)
      const quota = error?.name === 'QuotaExceededError'
      push(quota ? 'Browser storage is full in demo mode — remove a document first.' : error?.message ?? 'Upload failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(doc: RecordDocument) {
    if (!window.confirm(`Remove "${doc.name}"?`)) return
    try {
      await removeDocument(doc, actor)
      onChanged()
    } catch (error) {
      console.error(error)
      push('Could not remove the document.', 'error')
    }
  }

  return (
    <SectionCard
      title="Documents & proof"
      subtitle="Offer letters, admission / seat allotment letters, internship certificates and scorecards. Photos are compressed automatically."
    >
      {!record ? (
        <p className="text-sm text-ink-muted">Save the record once to start uploading documents.</p>
      ) : (
        <form onSubmit={handleUpload} className="grid sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-end mb-5">
          <Field label="Document type">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
              {Object.entries(DOCUMENT_KIND_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Proof for (optional)">
            <select className="input" value={linkedItemId} onChange={(e) => setLinkedItemId(e.target.value)}>
              <option value="">— Not linked —</option>
              {entries.map((entry) => (
                <option key={entry.item.id} value={entry.item.id}>
                  {ENTRY_KIND_LABEL[entry.kind]}: {entry.label || 'untitled'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="File (photo or PDF)">
            <input ref={fileInput} className="input" type="file" accept={ACCEPTED_DOCUMENT_TYPES} />
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {documents
          .slice()
          .sort((a, b) => b.uploadedAt - a.uploadedAt)
          .map((doc) => {
            const verified = verifications ? verificationFor(doc, verifications) : null
            return (
              <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line dark:border-cream-soft/20 p-3">
                <button
                  type="button"
                  onClick={() => setOpen(doc)}
                  className="w-14 h-14 shrink-0 rounded-xl border border-line overflow-hidden bg-white flex items-center justify-center text-2xl"
                  aria-label={`View ${doc.name}`}
                >
                  {doc.dataUrl.startsWith('data:image/') ? <img src={doc.dataUrl} alt="" className="w-full h-full object-cover" /> : '📄'}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{doc.name}</p>
                  <p className="text-xs text-ink-muted">
                    {DOCUMENT_KIND_LABEL[doc.kind]}
                    {doc.linkedItemId && entryLabel(doc.linkedItemId) ? ` · ${entryLabel(doc.linkedItemId)}` : ''}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {doc.uploadedByName} · {formatDate(doc.uploadedAt)} · {formatBytes(doc.size)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {verifications && <VerifiedBadge verification={verified} />}
                  <button type="button" className="btn-outline text-xs" onClick={() => setOpen(doc)}>
                    View
                  </button>
                  {canVerify && onToggleVerify && (
                    <button type="button" className="btn-outline text-xs" onClick={() => onToggleVerify(doc, !verified)}>
                      {verified ? 'Undo verify' : 'Verify'}
                    </button>
                  )}
                  <button type="button" className="text-xs font-semibold underline" onClick={() => handleRemove(doc)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        {documents.length === 0 && <p className="text-sm text-ink-muted">No documents uploaded yet.</p>}
      </div>

      {open && <DocumentViewer doc={open} onClose={() => setOpen(null)} />}
    </SectionCard>
  )
}
