'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Search, Download, ChevronDown, ChevronRight } from 'lucide-react'
import type { ChangeLogEntry } from '@/types'
import { useOrgStore } from '@/store/useOrgStore'
import { api } from '@/lib/api'

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  RESTORE: 'bg-orange-100 text-orange-700',
  IMPORT: 'bg-gray-100 text-gray-600',
  EXPORT: 'bg-gray-100 text-gray-600'
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-600'}`}>
      {action}
    </span>
  )
}

function formatTs(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

interface GroupedEntry {
  key: string
  timestamp: string
  entity_type: string
  entity_id: string
  entity_label: string | null
  action: string
  entries: ChangeLogEntry[]
}

function groupByOperation(entries: ChangeLogEntry[]): GroupedEntry[] {
  const groups = new Map<string, GroupedEntry>()
  for (const entry of entries) {
    const minute = entry.timestamp.slice(0, 16)
    const key = `${minute}|${entry.entity_id}|${entry.action}`
    if (!groups.has(key)) {
      groups.set(key, { key, timestamp: entry.timestamp, entity_type: entry.entity_type, entity_id: entry.entity_id, entity_label: entry.entity_label, action: entry.action, entries: [] })
    }
    groups.get(key)!.entries.push(entry)
  }
  return Array.from(groups.values())
}

export default function StoricoView() {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('all')
  const [action, setAction] = useState('all')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const { showToast } = useOrgStore()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.changelog.list({
        search: search || undefined,
        entityType: entityType !== 'all' ? entityType : undefined,
        action: action !== 'all' ? action : undefined,
        limit: 500
      })
      setEntries(result)
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, entityType, action])

  useEffect(() => {
    const t = setTimeout(loadEntries, 250)
    return () => clearTimeout(t)
  }, [loadEntries])

  const grouped = groupByOperation(entries)

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleExportCsv = async () => {
    try {
      await api.changelog.exportCsv()
      showToast('CSV esportato', 'success')
    } catch (e) {
      showToast(String(e), 'error')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Filtra per nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-52 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>

        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-700">
          <option value="all">Tutti i tipi</option>
          <option value="struttura">Struttura</option>
          <option value="dipendente">Dipendente</option>
        </select>

        <select value={action} onChange={(e) => setAction(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-700">
          <option value="all">Tutte le azioni</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="RESTORE">RESTORE</option>
          <option value="IMPORT">IMPORT</option>
          <option value="EXPORT">EXPORT</option>
        </select>

        <div className="flex-1" />

        <button onClick={handleExportCsv} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex items-center justify-center h-24 text-sm text-gray-400">Caricamento...</div>}
        {!loading && grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm font-medium">Nessun evento nel log</p>
            <p className="text-xs mt-1">Le modifiche appariranno qui</p>
          </div>
        )}
        {!loading && grouped.map((group) => {
          const isExpanded = expandedKeys.has(group.key)
          const hasMultiple = group.entries.length > 1 && group.action === 'UPDATE'
          return (
            <div key={group.key} className="border-b border-gray-100">
              <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-default" onClick={() => hasMultiple && toggleExpand(group.key)}>
                <div className="w-4 flex-none">
                  {hasMultiple && <button className="text-gray-400">{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button>}
                </div>
                <span className="text-xs text-gray-400 font-mono w-20 flex-none">{formatTs(group.timestamp)}</span>
                <span className="text-xs text-gray-500 w-20 capitalize flex-none">{group.entity_type !== 'system' ? group.entity_type : '—'}</span>
                <span className="text-sm text-gray-900 flex-1 truncate">
                  {group.entity_label ?? group.entity_id}
                  {group.entity_id !== group.entity_label && group.entity_label && (
                    <span className="text-gray-400 text-xs ml-1.5">({group.entity_id})</span>
                  )}
                </span>
                <ActionBadge action={group.action} />
                <div className="text-xs text-gray-400 w-48 text-right truncate flex-none">
                  {group.action === 'UPDATE' && group.entries.length === 1 && group.entries[0].field_name ? (
                    <span><span className="text-gray-600">{group.entries[0].field_name}</span>{' '}<span className="line-through">{group.entries[0].old_value ?? '—'}</span>{' → '}<span>{group.entries[0].new_value ?? '—'}</span></span>
                  ) : group.action === 'UPDATE' && group.entries.length > 1 ? (
                    <span>{group.entries.length} campi</span>
                  ) : group.entries[0].new_value ? (
                    <span className="truncate">{group.entries[0].new_value}</span>
                  ) : null}
                </div>
              </div>
              {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 space-y-1">
                  {group.entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 text-xs py-0.5">
                      <span className="w-4 flex-none" /><span className="w-20 flex-none" /><span className="w-20 flex-none" />
                      <span className="text-gray-600 font-medium w-36 flex-none truncate">{e.field_name}</span>
                      <span className="text-gray-400 flex-1 truncate">
                        <span className="line-through">{e.old_value ?? '—'}</span>{' → '}<span className="text-gray-700">{e.new_value ?? '—'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-100 px-4 py-2 bg-white">
        <span className="text-xs text-gray-400">{grouped.length} operazioni · {entries.length} righe totali</span>
      </div>
    </div>
  )
}
