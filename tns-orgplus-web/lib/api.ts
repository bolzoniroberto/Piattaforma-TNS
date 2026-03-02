/**
 * Client-side API wrapper — same interface as window.api in Electron,
 * but uses fetch() to call Next.js API routes.
 */
import type { Struttura, Dipendente, ChangeLogEntry, ImportReport, DeleteResult, StrutturaCounts } from '../types'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return res.json() as Promise<T>
}

export const api = {
  strutture: {
    list: (showDeleted = false): Promise<(Struttura & { dipendenti_count: number })[]> =>
      fetch(`/api/strutture?showDeleted=${showDeleted}`).then(r => json(r)),

    get: (codice: string): Promise<(Struttura & { dipendenti_count: number }) | null> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}`).then(r => r.status === 404 ? null : json(r)),

    getDipendenti: (codice: string): Promise<Dipendente[]> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}/dipendenti`).then(r => json(r)),

    create: (data: Partial<Struttura>): Promise<{ success: boolean; error?: string; message?: string }> =>
      fetch('/api/strutture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => json(r)),

    update: (codice: string, data: Partial<Struttura>): Promise<{ success: boolean; error?: string }> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => json(r)),

    delete: (codice: string): Promise<DeleteResult> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}`, { method: 'DELETE' }).then(r => json(r)),

    restore: (codice: string): Promise<{ success: boolean }> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}/restore`, { method: 'POST' }).then(r => json(r)),

    suggestCodice: (codicePadre: string): Promise<string> =>
      fetch(`/api/strutture/suggest-codice?codicePadre=${encodeURIComponent(codicePadre)}`).then(r => json<{ codice: string }>(r)).then(d => d.codice),

    checkCodice: (codice: string): Promise<{ available: boolean }> =>
      fetch(`/api/strutture/check-codice?codice=${encodeURIComponent(codice)}`).then(r => json(r)),

    updateParent: (codice: string, newCodiceParent: string | null): Promise<{ success: boolean; message?: string }> =>
      fetch(`/api/strutture/${encodeURIComponent(codice)}/parent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCodiceParent })
      }).then(r => json(r)),
  },

  dipendenti: {
    list: (showDeleted = false): Promise<Dipendente[]> =>
      fetch(`/api/dipendenti?showDeleted=${showDeleted}`).then(r => json(r)),

    get: (cf: string): Promise<Dipendente | null> =>
      fetch(`/api/dipendenti/${encodeURIComponent(cf)}`).then(r => r.status === 404 ? null : json(r)),

    create: (data: Partial<Dipendente>): Promise<{ success: boolean; error?: string; message?: string }> =>
      fetch('/api/dipendenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => json(r)),

    update: (cf: string, data: Partial<Dipendente>): Promise<{ success: boolean; error?: string }> =>
      fetch(`/api/dipendenti/${encodeURIComponent(cf)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => json(r)),

    delete: (cf: string): Promise<{ success: boolean }> =>
      fetch(`/api/dipendenti/${encodeURIComponent(cf)}`, { method: 'DELETE' }).then(r => json(r)),

    restore: (cf: string): Promise<{ success: boolean }> =>
      fetch(`/api/dipendenti/${encodeURIComponent(cf)}/restore`, { method: 'POST' }).then(r => json(r)),

    hardDelete: (cf: string): Promise<{ success: boolean; message?: string }> =>
      fetch(`/api/dipendenti/${encodeURIComponent(cf)}/hard`, { method: 'DELETE' }).then(r => json(r)),
  },

  xls: {
    /** Upload a File object from <input type="file"> */
    import: async (file: File): Promise<ImportReport> => {
      const fd = new FormData()
      fd.append('file', file)
      return fetch('/api/xls/import', { method: 'POST', body: fd }).then(r => json(r))
    },

    /** Trigger browser download of the XLS export */
    export: async (): Promise<void> => {
      const res = await fetch('/api/xls/export')
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `TNS_ORG_${dateStr}.xls`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  },

  changelog: {
    list: (filters: {
      search?: string
      entityType?: string
      action?: string
      dateFrom?: string
      dateTo?: string
      limit?: number
      offset?: number
    } = {}): Promise<ChangeLogEntry[]> => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.entityType && filters.entityType !== 'all') params.set('entityType', filters.entityType)
      if (filters.action && filters.action !== 'all') params.set('action', filters.action)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.limit !== undefined) params.set('limit', String(filters.limit))
      if (filters.offset !== undefined) params.set('offset', String(filters.offset))
      return fetch(`/api/changelog?${params}`).then(r => json(r))
    },

    exportCsv: async (): Promise<void> => {
      const res = await fetch('/api/changelog/export-csv')
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `storico_${dateStr}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  },

  stats: {
    counts: (): Promise<StrutturaCounts> =>
      fetch('/api/stats/counts').then(r => json(r)),

    sedi: (): Promise<string[]> =>
      fetch('/api/stats/sedi').then(r => json(r)),
  },
}
