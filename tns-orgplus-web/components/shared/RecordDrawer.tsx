'use client'
import React, { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { Struttura, Dipendente } from '@/types'
import { useOrgStore } from '@/store/useOrgStore'
import { api } from '@/lib/api'
import ConfirmDialog from './ConfirmDialog'
import RoleBadge from './RoleBadge'

type Mode = 'view' | 'edit' | 'create'

interface RecordDrawerProps {
  open: boolean
  type: 'struttura' | 'dipendente'
  record?: (Struttura & { dipendenti_count?: number }) | Dipendente | null
  initialMode?: Mode
  variant?: 'overlay' | 'panel'
  onClose: () => void
  onSaved?: () => void
}

const SECTION_LABEL = 'text-xs uppercase tracking-wider text-gray-400 font-medium mb-3'
const FIELD_ROW = 'flex justify-between items-start py-1.5 border-b border-gray-50 last:border-0'
const FIELD_LABEL = 'text-sm text-gray-500 shrink-0 w-44'
const FIELD_VALUE = 'text-sm text-gray-900 text-right'

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return (
      <div className={FIELD_ROW}>
        <span className={FIELD_LABEL}>{label}</span>
        <span className="text-gray-300 text-sm">—</span>
      </div>
    )
  }
  return (
    <div className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>
      <span className={FIELD_VALUE}>{value}</span>
    </div>
  )
}

function RoleRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>
      <RoleBadge value={value ?? null} />
    </div>
  )
}

const FIELD_OPTIONS: Record<string, string[]> = {
  approvatore:           ['APPR', 'APPRG', 'APPRSRALTR', 'APPRTOP'],
  viaggiatore:           ['V', 'VG', 'VGTOP2', 'VGTOP'],
  cassiere:              ['CMIR', 'CMID', 'CRMR', 'CAQD'],
  segr_red_assistita:    ['SGQMIILD', 'SGQRMGUOR', 'SGRRM', 'SGRADIOMI', 'SGRMI', 'SGRADIORM', 'SGDR', 'SGHTSI'],
  segretario_assistito:  ['SEGRETARIOMI'],
  controllore_assistito: ['CONTD', 'CONTGMI', 'CONTGRM', 'CONTGRADIOMI', 'CONTGRADIORM'],
  sede_tns:              ['Milano', 'Roma', 'Trento', 'Venezia Marghera', 'Palermo', 'Genova'],
  gruppo_sind:           ['RSUGRAMI', 'CDRQUOMI', 'RSUGRARM', 'POLQUOMI', 'RSURADMI', 'CDRQUORM', 'CDRRAD', 'RSUCUL', 'CDRAGEMI', 'RSUGRAMIEVENTI', 'DIRIGENTI', 'CDRAGERM', 'CDRUOR', 'CDRGUI', 'RSUGRATN', 'RSURADRM', 'POLQUORM', 'RSUGRARMMFE', 'RSUGRARMEVENTI', 'CDRAGERMMFE'],
  ruoli_afc:             ['AFCCDG', 'AFCNS', 'AFCFISC', 'AFCSV'],
  ruoli_hr:              ['AMMPERS'],
}

const ROLE_FIELDS: { key: string; label: string }[] = [
  { key: 'approvatore', label: 'Approvatore' },
  { key: 'viaggiatore', label: 'Viaggiatore' },
  { key: 'cassiere', label: 'Cassiere' },
  { key: 'controllore', label: 'Controllore' },
  { key: 'segretario', label: 'Segretario' },
  { key: 'visualizzatori', label: 'Visualizzatori' },
  { key: 'amministrazione', label: 'Amministrazione' }
]

const ASSISTENTI_FIELDS: { key: string; label: string }[] = [
  { key: 'segr_red_assistita', label: 'Segr. Red. Assistita' },
  { key: 'segretario_assistito', label: 'Segretario Assistito' },
  { key: 'controllore_assistito', label: 'Controllore Assistito' }
]

const CLASSIFICAZIONI_FIELDS: { key: string; label: string }[] = [
  { key: 'ruoli_afc', label: 'RuoliAFC' },
  { key: 'ruoli_hr', label: 'RuoliHR' },
  { key: 'altri_ruoli', label: 'AltriRuoli' },
  { key: 'sede_tns', label: 'Sede TNS' },
  { key: 'gruppo_sind', label: 'Gruppo Sind.' },
  { key: 'ruoli_oltre_v', label: 'RUOLI OltreV' },
  { key: 'ruoli', label: 'RUOLI' },
  { key: 'livello', label: 'LIVELLO' }
]

export default function RecordDrawer({
  open,
  type,
  record,
  initialMode = 'view',
  variant = 'overlay',
  onClose,
  onSaved
}: RecordDrawerProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [form, setForm] = useState<Record<string, string>>({})
  const [strutturaDipendenti, setStrutturaDipendenti] = useState<Dipendente[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmHardDelete, setConfirmHardDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { showToast, refreshAll } = useOrgStore()

  useEffect(() => {
    if (!open) return
    setMode(record ? initialMode : 'create')
    setDeleteError(null)
    if (record) {
      const r = record as unknown as Record<string, unknown>
      const f: Record<string, string> = {}
      Object.keys(r).forEach((k) => {
        if (r[k] !== null && r[k] !== undefined) f[k] = String(r[k])
      })
      setForm(f)
    } else {
      setForm({})
    }
  }, [open, record, initialMode])

  useEffect(() => {
    if (open && type === 'struttura' && record) {
      const s = record as Struttura
      api.strutture.getDipendenti(s.codice).then(setStrutturaDipendenti)
    } else {
      setStrutturaDipendenti([])
    }
  }, [open, type, record])

  if (!open) return null

  const r = record as Record<string, unknown> | undefined
  const title =
    type === 'struttura'
      ? (r?.descrizione as string) ?? 'Nuova Struttura'
      : (r?.titolare as string) ?? 'Nuovo Dipendente'

  const handleSave = async () => {
    setSaving(true)
    try {
      let result: { success: boolean; error?: string; message?: string }
      if (mode === 'create') {
        result = type === 'struttura'
          ? await api.strutture.create(form as Record<string, unknown>)
          : await api.dipendenti.create(form as Record<string, unknown>)
      } else {
        result = type === 'struttura'
          ? await api.strutture.update(r!.codice as string, form as Record<string, unknown>)
          : await api.dipendenti.update(r!.codice_fiscale as string, form as Record<string, unknown>)
      }
      if (result.success) {
        showToast('Salvato con successo', 'success')
        await refreshAll()
        setMode('view')
        onSaved?.()
      } else {
        showToast(result.message ?? 'Errore durante il salvataggio', 'error')
      }
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    try {
      const result = type === 'struttura'
        ? await api.strutture.delete(r!.codice as string)
        : await api.dipendenti.delete(r!.codice_fiscale as string)
      if (result.success) {
        showToast('Eliminato con successo', 'success')
        await refreshAll()
        onClose()
      } else {
        setDeleteError((result as { message?: string }).message ?? 'Impossibile eliminare')
      }
    } catch (e) {
      setDeleteError(String(e))
    }
  }

  const handleHardDelete = async () => {
    setConfirmHardDelete(false)
    try {
      const result = await api.dipendenti.hardDelete(r!.codice_fiscale as string)
      if (result.success) {
        showToast('Dipendente eliminato definitivamente', 'success')
        await refreshAll()
        onClose()
      } else {
        setDeleteError(result.message ?? 'Impossibile eliminare definitivamente')
      }
    } catch (e) {
      setDeleteError(String(e))
    }
  }

  const fieldInput = (key: string, placeholder?: string) => (
    <input
      className="w-full px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
      value={form[key] ?? ''}
      placeholder={placeholder}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
    />
  )

  const fieldCombo = (key: string) => {
    const opts = FIELD_OPTIONS[key]
    const listId = `drawer-opts-${key}`
    return (
      <>
        <input
          list={listId}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
          value={form[key] ?? ''}
          placeholder="Seleziona o digita..."
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
        <datalist id={listId}>
          {opts.map((o) => <option key={o} value={o} />)}
        </datalist>
      </>
    )
  }

  const fieldAuto = (key: string, placeholder?: string) =>
    FIELD_OPTIONS[key] ? fieldCombo(key) : fieldInput(key, placeholder)

  if (variant === 'panel') {
    return (
      <>
        <div className="h-full w-full flex flex-col">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
            <h2 className="font-semibold text-gray-900 text-sm flex-1 truncate">{title}</h2>
            {mode === 'view' && record && (
              <button onClick={() => setMode('edit')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                Modifica
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <div>
              <p className={SECTION_LABEL}>Dati Identificativi</p>
              {mode !== 'view' ? (
                <div className="space-y-2">
                  {type === 'struttura' ? (
                    <>
                      <div><label className="text-xs text-gray-500 mb-1 block">Codice *</label>{fieldInput('codice', 'es. G01')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Descrizione *</label>{fieldInput('descrizione', 'Nome struttura')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Struttura padre</label>{fieldInput('codice_padre', 'es. A')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">CdC Costo</label>{fieldInput('cdc_costo')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Titolare</label>{fieldInput('titolare', 'COGNOME NOME')}</div>
                    </>
                  ) : (
                    <>
                      <div><label className="text-xs text-gray-500 mb-1 block">Codice Fiscale *</label>{fieldInput('codice_fiscale')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Titolare</label>{fieldInput('titolare', 'COGNOME NOME')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Struttura</label>{fieldInput('codice_struttura', 'Codice struttura')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">CdC Costo</label>{fieldInput('cdc_costo')}</div>
                      <div><label className="text-xs text-gray-500 mb-1 block">Unità Organizzativa</label>{fieldInput('unita_organizzativa')}</div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {type === 'struttura' ? (
                    <>
                      <FieldRow label="Codice" value={r?.codice as string} />
                      <FieldRow label="CdC Costo" value={r?.cdc_costo as string} />
                      <FieldRow label="Struttura padre" value={r?.codice_padre as string} />
                      <FieldRow label="Titolare" value={r?.titolare as string} />
                      {r?.unita_organizzativa && <FieldRow label="Unità Org." value={r.unita_organizzativa as string} />}
                    </>
                  ) : (
                    <>
                      <FieldRow label="Codice Fiscale" value={r?.codice_fiscale as string} />
                      <FieldRow label="Struttura" value={r?.codice_struttura as string} />
                      <FieldRow label="CdC Costo" value={r?.cdc_costo as string} />
                      <FieldRow label="Unità Org." value={r?.unita_organizzativa as string} />
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className={SECTION_LABEL}>Ruoli Principali</p>
              {mode !== 'view' ? (
                <div className="space-y-2">
                  {ROLE_FIELDS.map(({ key, label }) => (
                    <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                  ))}
                </div>
              ) : (
                <div>{ROLE_FIELDS.map(({ key, label }) => <RoleRow key={key} label={label} value={r?.[key] as string} />)}</div>
              )}
            </div>

            <div>
              <p className={SECTION_LABEL}>Ruoli Assistenti</p>
              {mode !== 'view' ? (
                <div className="space-y-2">
                  {ASSISTENTI_FIELDS.map(({ key, label }) => (
                    <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                  ))}
                </div>
              ) : (
                <div>{ASSISTENTI_FIELDS.map(({ key, label }) => <RoleRow key={key} label={label} value={r?.[key] as string} />)}</div>
              )}
            </div>

            <div>
              <p className={SECTION_LABEL}>Classificazioni</p>
              {mode !== 'view' ? (
                <div className="space-y-2">
                  {CLASSIFICAZIONI_FIELDS.map(({ key, label }) => (
                    <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                  ))}
                </div>
              ) : (
                <div>{CLASSIFICAZIONI_FIELDS.map(({ key, label }) => <FieldRow key={key} label={label} value={r?.[key] as string} />)}</div>
              )}
            </div>

            {type === 'struttura' && mode === 'view' && (
              <div>
                <p className={SECTION_LABEL + ' mb-3'}>Dipendenti ({strutturaDipendenti.length})</p>
                {strutturaDipendenti.length === 0 ? (
                  <p className="text-sm text-gray-400">Nessun dipendente assegnato</p>
                ) : (
                  <div className="space-y-1">
                    {strutturaDipendenti.map((d) => (
                      <div key={d.codice_fiscale} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <div>
                          <span className="text-sm text-gray-900">{d.titolare ?? '—'}</span>
                          <span className="text-xs text-gray-400 ml-2">{d.codice_fiscale.slice(0, 8)}…</span>
                        </div>
                        <div className="flex gap-1">
                          {d.approvatore && <RoleBadge value={d.approvatore} />}
                          {d.viaggiatore && <RoleBadge value={d.viaggiatore} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{deleteError}</div>
            )}

            {mode === 'view' && record && (
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Elimina {type === 'struttura' ? 'struttura' : 'dipendente'}
                </button>
                {type === 'dipendente' && (r as unknown as Dipendente)?.deleted_at && (
                  <button
                    onClick={() => setConfirmHardDelete(true)}
                    className="flex items-center gap-1.5 text-sm text-red-700 font-semibold hover:text-red-900 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Elimina definitivamente
                  </button>
                )}
              </div>
            )}
          </div>

          {mode !== 'view' && (
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => record ? setMode('view') : onClose()}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmDelete}
          title={`Elimina ${type === 'struttura' ? 'struttura' : 'dipendente'}`}
          message={`Sei sicuro di voler eliminare "${title}"? L'operazione è reversibile.`}
          confirmLabel="Elimina"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />

        <ConfirmDialog
          open={confirmHardDelete}
          title="Eliminazione definitiva"
          message={`⚠️ ATTENZIONE: questa operazione è IRREVERSIBILE.\n\nIl dipendente "${title}" verrà cancellato definitivamente dal database e non potrà essere recuperato.`}
          confirmLabel="Elimina definitivamente"
          onConfirm={handleHardDelete}
          onCancel={() => setConfirmHardDelete(false)}
        />
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-xl z-40 flex flex-col"
        style={{ animation: 'slideInRight 200ms ease-out' }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-gray-900 text-sm flex-1 truncate">{title}</h2>
          {mode === 'view' && record && (
            <button onClick={() => setMode('edit')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              Modifica
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <p className={SECTION_LABEL}>Dati Identificativi</p>
            {mode !== 'view' ? (
              <div className="space-y-2">
                {type === 'struttura' ? (
                  <>
                    <div><label className="text-xs text-gray-500 mb-1 block">Codice *</label>{fieldInput('codice', 'es. G01')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Descrizione *</label>{fieldInput('descrizione', 'Nome struttura')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Struttura padre</label>{fieldInput('codice_padre', 'es. A')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">CdC Costo</label>{fieldInput('cdc_costo')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Titolare</label>{fieldInput('titolare', 'COGNOME NOME')}</div>
                  </>
                ) : (
                  <>
                    <div><label className="text-xs text-gray-500 mb-1 block">Codice Fiscale *</label>{fieldInput('codice_fiscale')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Titolare</label>{fieldInput('titolare', 'COGNOME NOME')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Struttura</label>{fieldInput('codice_struttura', 'Codice struttura')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">CdC Costo</label>{fieldInput('cdc_costo')}</div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Unità Organizzativa</label>{fieldInput('unita_organizzativa')}</div>
                  </>
                )}
              </div>
            ) : (
              <div>
                {type === 'struttura' ? (
                  <>
                    <FieldRow label="Codice" value={r?.codice as string} />
                    <FieldRow label="CdC Costo" value={r?.cdc_costo as string} />
                    <FieldRow label="Struttura padre" value={r?.codice_padre as string} />
                    <FieldRow label="Titolare" value={r?.titolare as string} />
                    {r?.unita_organizzativa && <FieldRow label="Unità Org." value={r.unita_organizzativa as string} />}
                  </>
                ) : (
                  <>
                    <FieldRow label="Codice Fiscale" value={r?.codice_fiscale as string} />
                    <FieldRow label="Struttura" value={r?.codice_struttura as string} />
                    <FieldRow label="CdC Costo" value={r?.cdc_costo as string} />
                    <FieldRow label="Unità Org." value={r?.unita_organizzativa as string} />
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <p className={SECTION_LABEL}>Ruoli Principali</p>
            {mode !== 'view' ? (
              <div className="space-y-2">
                {ROLE_FIELDS.map(({ key, label }) => (
                  <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                ))}
              </div>
            ) : (
              <div>{ROLE_FIELDS.map(({ key, label }) => <RoleRow key={key} label={label} value={r?.[key] as string} />)}</div>
            )}
          </div>

          <div>
            <p className={SECTION_LABEL}>Ruoli Assistenti</p>
            {mode !== 'view' ? (
              <div className="space-y-2">
                {ASSISTENTI_FIELDS.map(({ key, label }) => (
                  <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                ))}
              </div>
            ) : (
              <div>{ASSISTENTI_FIELDS.map(({ key, label }) => <RoleRow key={key} label={label} value={r?.[key] as string} />)}</div>
            )}
          </div>

          <div>
            <p className={SECTION_LABEL}>Classificazioni</p>
            {mode !== 'view' ? (
              <div className="space-y-2">
                {CLASSIFICAZIONI_FIELDS.map(({ key, label }) => (
                  <div key={key}><label className="text-xs text-gray-500 mb-1 block">{label}</label>{fieldAuto(key)}</div>
                ))}
              </div>
            ) : (
              <div>{CLASSIFICAZIONI_FIELDS.map(({ key, label }) => <FieldRow key={key} label={label} value={r?.[key] as string} />)}</div>
            )}
          </div>

          {type === 'struttura' && mode === 'view' && (
            <div>
              <p className={SECTION_LABEL + ' mb-3'}>Dipendenti ({strutturaDipendenti.length})</p>
              {strutturaDipendenti.length === 0 ? (
                <p className="text-sm text-gray-400">Nessun dipendente assegnato</p>
              ) : (
                <div className="space-y-1">
                  {strutturaDipendenti.map((d) => (
                    <div key={d.codice_fiscale} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                      <div>
                        <span className="text-sm text-gray-900">{d.titolare ?? '—'}</span>
                        <span className="text-xs text-gray-400 ml-2">{d.codice_fiscale.slice(0, 8)}…</span>
                      </div>
                      <div className="flex gap-1">
                        {d.approvatore && <RoleBadge value={d.approvatore} />}
                        {d.viaggiatore && <RoleBadge value={d.viaggiatore} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{deleteError}</div>
          )}

          {mode === 'view' && record && (
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Elimina {type === 'struttura' ? 'struttura' : 'dipendente'}
              </button>
              {type === 'dipendente' && (r as unknown as Dipendente)?.deleted_at && (
                <button
                  onClick={() => setConfirmHardDelete(true)}
                  className="flex items-center gap-1.5 text-sm text-red-700 font-semibold hover:text-red-900 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Elimina definitivamente
                </button>
              )}
            </div>
          )}
        </div>

        {mode !== 'view' && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => record ? setMode('view') : onClose()}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Elimina ${type === 'struttura' ? 'struttura' : 'dipendente'}`}
        message={`Sei sicuro di voler eliminare "${title}"? L'operazione è reversibile.`}
        confirmLabel="Elimina"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmHardDelete}
        title="Eliminazione definitiva"
        message={`⚠️ ATTENZIONE: questa operazione è IRREVERSIBILE.\n\nIl dipendente "${title}" verrà cancellato definitivamente dal database e non potrà essere recuperato.`}
        confirmLabel="Elimina definitivamente"
        onConfirm={handleHardDelete}
        onCancel={() => setConfirmHardDelete(false)}
      />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
