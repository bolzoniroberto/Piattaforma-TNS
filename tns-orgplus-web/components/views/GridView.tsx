'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { ChevronRight, Plus, Search, Eye, EyeOff } from 'lucide-react'
import { useOrgStore } from '@/store/useOrgStore'
import { api } from '@/lib/api'
import type { Struttura, Dipendente } from '@/types'
import RecordDrawer from '@/components/shared/RecordDrawer'

type SubTab = 'strutture' | 'dipendenti' | 'orfani_dipendenti' | 'orfani_strutture' | 'strutture_vuote'

const isStrutturaTab = (t: SubTab) => t === 'strutture' || t === 'orfani_strutture' || t === 'strutture_vuote'

export default function GridView() {
  const { strutture, dipendenti, refreshAll, showToast } = useOrgStore()
  const [subTab, setSubTab] = useState<SubTab>('strutture')
  const [search, setSearch] = useState('')
  const [sedeFiltro, setSedeFiltro] = useState<string>('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState<'struttura' | 'dipendente'>('struttura')
  const [drawerRecord, setDrawerRecord] = useState<(Struttura & { dipendenti_count?: number }) | Dipendente | null>(null)
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view')

  const sediList = useMemo(() => {
    const all = new Set<string>()
    strutture.forEach((s) => s.sede_tns && all.add(s.sede_tns))
    dipendenti.forEach((d) => d.sede_tns && all.add(d.sede_tns))
    return Array.from(all).sort()
  }, [strutture, dipendenti])

  const openDrawer = useCallback(
    (type: 'struttura' | 'dipendente', record: (Struttura & { dipendenti_count?: number }) | Dipendente | null, mode: 'view' | 'edit' | 'create') => {
      setDrawerType(type)
      setDrawerRecord(record)
      setDrawerMode(mode)
      setDrawerOpen(true)
    },
    []
  )

  const saveCell = useCallback(
    async (field: string, value: string, data: Struttura | Dipendente) => {
      if (isStrutturaTab(subTab)) {
        return api.strutture.update((data as Struttura).codice, { [field]: value })
      } else {
        return api.dipendenti.update((data as Dipendente).codice_fiscale, { [field]: value })
      }
    },
    [subTab]
  )

  const handleCellValueChanged = useCallback(
    async (params: CellValueChangedEvent) => {
      if (params.oldValue === params.newValue) return
      const field = params.colDef.field
      if (!field) return
      const newVal = params.newValue ?? ''

      const selectedNodes = params.api.getSelectedNodes()
        .filter(n => n.rowIndex !== params.rowIndex)

      try {
        const result = await saveCell(field, newVal, params.data)
        if (!result.success) {
          showToast((result as { message?: string }).message ?? (result as { error?: string }).error ?? 'Errore aggiornamento', 'error')
          params.node.setDataValue(field, params.oldValue)
          return
        }
        if (selectedNodes.length > 0) {
          const promises = selectedNodes.map(node =>
            saveCell(field, newVal, node.data as Struttura | Dipendente).then(r => {
              if (r.success) node.setDataValue(field, newVal)
            })
          )
          await Promise.all(promises)
          showToast(`"${field}" aggiornato su ${selectedNodes.length + 1} righe`, 'success')
        } else {
          showToast(`Campo "${field}" aggiornato`, 'success')
        }
        await refreshAll()
      } catch (e) {
        showToast(String(e), 'error')
        params.node.setDataValue(field, params.oldValue)
      }
    },
    [subTab, saveCell, showToast, refreshAll]
  )

  const struttureCols: ColDef[] = useMemo(
    () => [
      { headerCheckboxSelection: true, checkboxSelection: true, width: 40, minWidth: 40, maxWidth: 40, pinned: 'left' as const, sortable: false, filter: false, floatingFilter: false, editable: false, suppressFillHandle: true, resizable: false, suppressMovable: true },
      { field: 'codice', headerName: 'Codice', width: 110, sortable: true, editable: false, suppressFillHandle: true, cellClass: 'font-mono text-xs text-gray-600' },
      { field: 'descrizione', headerName: 'Descrizione', flex: 2, sortable: true, editable: true, cellClass: 'text-sm font-medium text-gray-900' },
      { field: 'cdc_costo', headerName: 'CdC', width: 110, sortable: true, editable: true, cellClass: 'text-xs text-gray-500' },
      { field: 'codice_padre', headerName: 'Padre', width: 100, sortable: true, editable: true, cellClass: 'font-mono text-xs text-gray-500' },
      { field: 'titolare', headerName: 'Titolare', flex: 1.5, sortable: true, editable: true, cellClass: 'text-sm text-gray-600' },
      { field: 'approvatore', headerName: 'Approvatore', width: 130, sortable: true, editable: true, cellClass: 'text-xs text-gray-600' },
      { field: 'sede_tns', headerName: 'Sede', width: 120, sortable: true, editable: true, cellClass: 'text-xs text-gray-500' },
      { field: 'dipendenti_count', headerName: '# Dip.', width: 80, sortable: true, editable: false, filter: 'agNumberColumnFilter', suppressFillHandle: true, cellClass: 'text-xs text-gray-500 text-center', type: 'numericColumn' },
      {
        headerName: '', width: 46, pinned: 'right', sortable: false, editable: false, filter: false, floatingFilter: false, suppressFillHandle: true,
        cellRenderer: (params: ICellRendererParams) => (
          <button onClick={() => openDrawer('struttura', params.data, 'view')} className="flex items-center justify-center w-full h-full text-gray-300 hover:text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        )
      }
    ],
    [openDrawer]
  )

  const dipendentiCols: ColDef[] = useMemo(
    () => [
      { headerCheckboxSelection: true, checkboxSelection: true, width: 40, minWidth: 40, maxWidth: 40, pinned: 'left' as const, sortable: false, filter: false, floatingFilter: false, editable: false, suppressFillHandle: true, resizable: false, suppressMovable: true },
      { field: 'codice_fiscale', headerName: 'CF', width: 160, sortable: true, editable: false, suppressFillHandle: true, cellClass: 'font-mono text-xs text-gray-500' },
      { field: 'titolare', headerName: 'Titolare', flex: 2, sortable: true, editable: true, cellClass: 'text-sm font-medium text-gray-900' },
      { field: 'codice_struttura', headerName: 'Struttura', width: 120, sortable: true, editable: true, cellClass: 'font-mono text-xs text-gray-600' },
      { field: 'viaggiatore', headerName: 'Viaggiatore', width: 120, sortable: true, editable: true, cellClass: 'text-xs text-gray-600' },
      { field: 'approvatore', headerName: 'Approvatore', width: 130, sortable: true, editable: true, cellClass: 'text-xs text-gray-600' },
      { field: 'cassiere', headerName: 'Cassiere', width: 100, sortable: true, editable: true, cellClass: 'text-xs text-gray-600' },
      { field: 'sede_tns', headerName: 'Sede', width: 120, sortable: true, editable: true, cellClass: 'text-xs text-gray-500' },
      {
        headerName: '', width: 46, pinned: 'right', sortable: false, editable: false, filter: false, floatingFilter: false, suppressFillHandle: true,
        cellRenderer: (params: ICellRendererParams) => (
          <button onClick={() => openDrawer('dipendente', params.data, 'view')} className="flex items-center justify-center w-full h-full text-gray-300 hover:text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        )
      }
    ],
    [openDrawer]
  )

  const struttureCodici = useMemo(
    () => new Set(strutture.filter((s) => !s.deleted_at).map((s) => s.codice)),
    [strutture]
  )

  const orphanDipendenti = useMemo(
    () => dipendenti.filter((d) => !d.deleted_at && (!d.codice_struttura || !struttureCodici.has(d.codice_struttura))),
    [dipendenti, struttureCodici]
  )

  const orphanStrutture = useMemo(
    () => strutture.filter((s) => !s.deleted_at && s.codice_padre !== null && s.codice_padre !== undefined && !struttureCodici.has(s.codice_padre)),
    [strutture, struttureCodici]
  )

  const emptyStrutture = useMemo(() => {
    const conDipendenti = new Set(dipendenti.filter((d) => !d.deleted_at && d.codice_struttura).map((d) => d.codice_struttura))
    const childrenMap = new Map<string, string[]>()
    strutture.forEach((s) => {
      if (!s.deleted_at && s.codice_padre) {
        if (!childrenMap.has(s.codice_padre)) childrenMap.set(s.codice_padre, [])
        childrenMap.get(s.codice_padre)!.push(s.codice)
      }
    })
    function subtreeHasDipendenti(codice: string, visited = new Set<string>()): boolean {
      if (visited.has(codice)) return false
      visited.add(codice)
      if (conDipendenti.has(codice)) return true
      for (const child of childrenMap.get(codice) ?? []) {
        if (subtreeHasDipendenti(child, visited)) return true
      }
      return false
    }
    return strutture.filter((s) => !s.deleted_at && !subtreeHasDipendenti(s.codice))
  }, [strutture, dipendenti])

  const filteredData = useMemo(() => {
    const searchLower = search.toLowerCase()
    if (subTab === 'strutture') {
      return strutture.filter((s) => {
        const matchDeleted = showDeleted ? true : !s.deleted_at
        const matchSearch = !search || (s.codice?.toLowerCase().includes(searchLower) ?? false) || (s.descrizione?.toLowerCase().includes(searchLower) ?? false) || (s.titolare?.toLowerCase().includes(searchLower) ?? false)
        const matchSede = sedeFiltro === 'all' || (s.sede_tns?.toLowerCase() === sedeFiltro.toLowerCase())
        return matchDeleted && matchSearch && matchSede
      })
    } else if (subTab === 'dipendenti') {
      return dipendenti.filter((d) => {
        const matchDeleted = showDeleted ? true : !d.deleted_at
        const matchSearch = !search || (d.codice_fiscale?.toLowerCase().includes(searchLower) ?? false) || (d.titolare?.toLowerCase().includes(searchLower) ?? false) || (d.codice_struttura?.toLowerCase().includes(searchLower) ?? false)
        const matchSede = sedeFiltro === 'all' || (d.sede_tns?.toLowerCase() === sedeFiltro.toLowerCase())
        return matchDeleted && matchSearch && matchSede
      })
    } else if (subTab === 'orfani_dipendenti') {
      return orphanDipendenti.filter((d) => !search || (d.codice_fiscale?.toLowerCase().includes(searchLower) ?? false) || (d.titolare?.toLowerCase().includes(searchLower) ?? false) || (d.codice_struttura?.toLowerCase().includes(searchLower) ?? false))
    } else if (subTab === 'orfani_strutture') {
      return orphanStrutture.filter((s) => !search || (s.codice?.toLowerCase().includes(searchLower) ?? false) || (s.descrizione?.toLowerCase().includes(searchLower) ?? false) || (s.codice_padre?.toLowerCase().includes(searchLower) ?? false))
    } else {
      return emptyStrutture.filter((s) => !search || (s.codice?.toLowerCase().includes(searchLower) ?? false) || (s.descrizione?.toLowerCase().includes(searchLower) ?? false) || (s.codice_padre?.toLowerCase().includes(searchLower) ?? false))
    }
  }, [strutture, dipendenti, subTab, search, sedeFiltro, showDeleted, orphanDipendenti, orphanStrutture, emptyStrutture])

  const getRowClass = (params: { data?: (Struttura | Dipendente) & { deleted_at?: string | null } }) => {
    if (params.data?.deleted_at) return 'bg-red-50 line-through text-gray-400'
    return ''
  }

  const isMainTab = subTab === 'strutture' || subTab === 'dipendenti'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {(['strutture', 'dipendenti'] as const).map((tab) => (
            <button key={tab} onClick={() => setSubTab(tab)} className={['px-3 py-1.5 text-sm rounded-md transition-colors', subTab === tab ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'].join(' ')}>
              {tab === 'strutture' ? `Strutture (${strutture.filter((s) => !s.deleted_at).length})` : `Dipendenti (${dipendenti.filter((d) => !d.deleted_at).length})`}
            </button>
          ))}
          <button onClick={() => setSubTab('orfani_dipendenti')} title="Dipendenti la cui struttura non esiste in DB" className={['px-3 py-1.5 text-sm rounded-md transition-colors', subTab === 'orfani_dipendenti' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'].join(' ')}>
            ⚠️ Orfani Dip.{orphanDipendenti.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{orphanDipendenti.length}</span>}
          </button>
          <button onClick={() => setSubTab('orfani_strutture')} title="Strutture il cui codice_padre non esiste in DB" className={['px-3 py-1.5 text-sm rounded-md transition-colors', subTab === 'orfani_strutture' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'].join(' ')}>
            ⚠️ Orfani Str.{orphanStrutture.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{orphanStrutture.length}</span>}
          </button>
          <button onClick={() => setSubTab('strutture_vuote')} title="Strutture senza dipendenti in nessun livello sottostante" className={['px-3 py-1.5 text-sm rounded-md transition-colors', subTab === 'strutture_vuote' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'].join(' ')}>
            🌿 Str. Vuote{emptyStrutture.length > 0 && <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5">{emptyStrutture.length}</span>}
          </button>
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-52 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>

        {isMainTab && (
          <select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-700">
            <option value="all">Tutte le sedi</option>
            {sediList.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
          </select>
        )}

        {isMainTab && (
          <button onClick={() => setShowDeleted((v) => !v)} className={['flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors', showDeleted ? 'bg-red-50 border-red-200 text-red-700' : 'border-gray-200 text-gray-500 hover:text-gray-700'].join(' ')} title={showDeleted ? 'Nascondi eliminati' : 'Mostra eliminati'}>
            {showDeleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Eliminati</span>
          </button>
        )}

        {isMainTab && (
          <button onClick={() => openDrawer(subTab === 'strutture' ? 'struttura' : 'dipendente', null, 'create')} className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" />
            Aggiungi
          </button>
        )}
      </div>

      {(subTab === 'orfani_dipendenti' || subTab === 'orfani_strutture' || subTab === 'strutture_vuote') && (
        <div className={['px-4 py-2 border-b text-xs', subTab === 'strutture_vuote' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'].join(' ')}>
          {subTab === 'orfani_dipendenti' && '⚠️ Dipendenti la cui struttura di assegnazione (codice_struttura) non esiste nel database.'}
          {subTab === 'orfani_strutture' && '⚠️ Strutture il cui padre (codice_padre) non esiste nel database.'}
          {subTab === 'strutture_vuote' && '🌿 Strutture senza dipendenti in nessun livello sottostante.'}
        </div>
      )}

      {isMainTab && (
        <div className="px-4 py-1 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
          💡 Doppio click su una cella per modificarla · Seleziona più righe con ☑ per applicare lo stesso valore a tutte · Pulsante → per la scheda completa
        </div>
      )}

      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          rowData={filteredData}
          columnDefs={isStrutturaTab(subTab) ? struttureCols : dipendentiCols}
          defaultColDef={{ resizable: true, suppressMovable: false, sortable: true, filter: true, floatingFilter: true }}
          getRowClass={getRowClass}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onCellValueChanged={handleCellValueChanged}
          stopEditingWhenCellsLoseFocus={true}
          animateRows={true}
          suppressCellFocus={false}
          rowHeight={36}
          headerHeight={36}
        />
      </div>

      <RecordDrawer
        open={drawerOpen}
        type={drawerType}
        record={drawerRecord}
        initialMode={drawerMode}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => refreshAll()}
      />
    </div>
  )
}
