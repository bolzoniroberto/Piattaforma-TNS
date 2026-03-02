'use client'

import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, Trash2, Edit2, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import * as Accordion from '@radix-ui/react-accordion'
import { useOrgStore } from '@/store/useOrgStore'
import type { Struttura, Dipendente } from '@/types'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import RecordDrawer from '@/components/shared/RecordDrawer'
import { api } from '@/lib/api'

// ── Pending move (shown in confirmation modal before saving) ─────────────────
type PendingMove =
  | { kind: 'struttura'; codice: string; label: string; fromParent: string | null; toParent: string | null; toLabel: string }
  | { kind: 'dipendente'; cf: string; nome: string; fromCodice: string; toCodice: string; toLabel: string }

// ── DnD wrapper components ───────────────────────────────────────────────────

function DraggableStruttura({ codice, children }: { codice: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `str::${codice}` })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: 0.8, zIndex: 50, position: 'relative' as const }
    : {}
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'ring-2 ring-indigo-400 rounded-md' : ''}>
      <div className="flex items-center w-full">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
          title="Trascina per spostare questa struttura"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

function DroppableStruttura({ codice, children }: { codice: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop::${codice}` })
  return (
    <div ref={setNodeRef} className={isOver ? 'ring-2 ring-indigo-300 rounded-md bg-indigo-50 transition-colors' : 'transition-colors'}>
      {children}
    </div>
  )
}

function DraggableDipendente({ cf, children }: { cf: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `dip::${cf}` })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: 0.8, zIndex: 50, position: 'relative' as const }
    : {}
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'ring-2 ring-blue-400 rounded-md' : ''}>
      <div className="flex items-center w-full">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
          title="Trascina per spostare questo dipendente"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

// ── Tree data types ──────────────────────────────────────────────────────────

interface TreeStructura {
  struttura: Struttura & { dipendenti_count: number }
  children: TreeStructura[]
  dipendenti: Dipendente[]
}

// Build hierarchical tree
function buildTree(
  strutture: (Struttura & { dipendenti_count: number })[],
  dipendenti: Dipendente[],
  filteredCodici?: Set<string>,
  filteredDipendenteCFs?: Set<string>
): TreeStructura[] {
  const byParent = new Map<string | null, (Struttura & { dipendenti_count: number })[]>()
  const dipendentesByStruttura = new Map<string, Dipendente[]>()

  strutture.forEach((s) => {
    if (filteredCodici && !filteredCodici.has(s.codice)) return
    const p = s.codice_padre ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(s)
  })

  dipendenti.forEach((d) => {
    if (filteredDipendenteCFs && !filteredDipendenteCFs.has(d.codice_fiscale)) return
    if (!dipendentesByStruttura.has(d.codice_struttura)) {
      dipendentesByStruttura.set(d.codice_struttura, [])
    }
    dipendentesByStruttura.get(d.codice_struttura)!.push(d)
  })

  function build(parentCodice: string | null): TreeStructura[] {
    const children = byParent.get(parentCodice) ?? []
    return children
      .sort((a, b) => (a.codice ?? '').localeCompare(b.codice ?? ''))
      .map((s) => ({
        struttura: s,
        children: build(s.codice),
        dipendenti: dipendentesByStruttura.get(s.codice) ?? [],
      }))
  }

  return build(null)
}

// ── Accordion item component ─────────────────────────────────────────────────

interface AccordionStruturaItemProps {
  treeNode: TreeStructura
  onEditStruttura: (s: Struttura & { dipendenti_count: number }) => void
  onDeleteStruttura: (s: Struttura & { dipendenti_count: number }) => void
  onEditDipendente: (d: Dipendente) => void
  onDeleteDipendente: (d: Dipendente) => void
  compact: boolean
}

function AccordionStruturaItem({
  treeNode,
  onEditStruttura,
  onDeleteStruttura,
  onEditDipendente,
  onDeleteDipendente,
  compact,
}: AccordionStruturaItemProps) {
  return (
    <DroppableStruttura codice={treeNode.struttura.codice}>
      <Accordion.Item value={treeNode.struttura.codice} className="border-b border-gray-200">
        <Accordion.Trigger className="w-full p-3 hover:bg-gray-50 transition-colors flex items-center justify-between data-[state=open]:bg-gray-50">
          <DraggableStruttura codice={treeNode.struttura.codice}>
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center flex-1 min-w-0 text-left">
                <ChevronDown className="w-4 h-4 mr-2 flex-shrink-0 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{treeNode.struttura.codice}</div>
                  {!compact && (
                    <div className="text-sm text-gray-600 truncate">{treeNode.struttura.descrizione}</div>
                  )}
                </div>
              </div>
              {(treeNode.dipendenti.length > 0 || treeNode.children.length > 0) && (
                <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                  {treeNode.dipendenti.length > 0 && `${treeNode.dipendenti.length} dip.`}
                  {treeNode.children.length > 0 && ` ${treeNode.children.length} sub.`}
                </span>
              )}
            </div>
          </DraggableStruttura>
        </Accordion.Trigger>

        <Accordion.Content className="p-3 bg-gray-50">
          <div className="space-y-3">
            {/* Struttura card */}
            <div>
              <div className="text-xs font-semibold text-gray-700 px-3 mb-2">Struttura</div>
              <div className="py-2 px-3 bg-white border border-gray-200 rounded-md shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{treeNode.struttura.codice}</div>
                    {!compact && (
                      <>
                        <div className="text-sm text-gray-600 truncate">{treeNode.struttura.descrizione}</div>
                        {treeNode.struttura.titolare && (
                          <div className="text-xs text-gray-500">Titolare: {treeNode.struttura.titolare}</div>
                        )}
                        {treeNode.struttura.cdc_costo && (
                          <div className="text-xs text-gray-500">CdC: {treeNode.struttura.cdc_costo}</div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <button
                      onClick={() => onEditStruttura(treeNode.struttura)}
                      className="text-xs p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Modifica"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteStruttura(treeNode.struttura)}
                      className="text-xs p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dipendenti */}
            {treeNode.dipendenti.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 px-3 mb-2">Dipendenti ({treeNode.dipendenti.length})</div>
                <div className="space-y-2">
                  {treeNode.dipendenti.map((d) => (
                    <DraggableDipendente key={d.codice_fiscale} cf={d.codice_fiscale}>
                      <div className="py-2 px-3 bg-blue-50 border border-blue-200 rounded-md ml-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{d.codice_fiscale}</div>
                            {!compact && d.titolare && (
                              <div className="text-sm text-gray-600">{d.titolare}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <button
                              onClick={() => onEditDipendente(d)}
                              className="text-xs p-1.5 text-blue-600 hover:bg-blue-200 rounded transition-colors"
                              title="Modifica"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteDipendente(d)}
                              className="text-xs p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Elimina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </DraggableDipendente>
                  ))}
                </div>
              </div>
            )}

            {/* Child structures — recursive */}
            {treeNode.children.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 px-3 mb-2">Sottostrutture ({treeNode.children.length})</div>
                <Accordion.Root type="single" collapsible className="border border-gray-200 rounded-md">
                  {treeNode.children.map((child) => (
                    <AccordionStruturaItem
                      key={child.struttura.codice}
                      treeNode={child}
                      onEditStruttura={onEditStruttura}
                      onDeleteStruttura={onDeleteStruttura}
                      onEditDipendente={onEditDipendente}
                      onDeleteDipendente={onDeleteDipendente}
                      compact={compact}
                    />
                  ))}
                </Accordion.Root>
              </div>
            )}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </DroppableStruttura>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function AccordionView() {
  const { strutture, dipendenti, refreshAll, addToast } = useOrgStore()
  const [search, setSearch] = useState('')
  const [sedeFiltro, setSedeFiltro] = useState<string>('all')
  const [compact, setCompact] = useState(false)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRecord, setDrawerRecord] = useState<(Struttura & { dipendenti_count: number }) | Dipendente | null>(null)
  const [drawerType, setDrawerType] = useState<'struttura' | 'dipendente'>('struttura')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const sediList = useMemo(() => {
    const all = new Set<string>()
    strutture.forEach((s) => s.sede_tns && all.add(s.sede_tns))
    dipendenti.forEach((d) => d.sede_tns && all.add(d.sede_tns))
    return Array.from(all).sort()
  }, [strutture, dipendenti])

  const filteredStrutture = useMemo(() => {
    let result = strutture
    if (sedeFiltro !== 'all') {
      result = result.filter((s) => (s.sede_tns?.toLowerCase() ?? '') === sedeFiltro.toLowerCase())
    }
    return result
  }, [strutture, sedeFiltro])

  const filteredDipendenti = useMemo(() => {
    let result = dipendenti
    if (sedeFiltro !== 'all') {
      result = result.filter((d) => (d.sede_tns?.toLowerCase() ?? '') === sedeFiltro.toLowerCase())
    }
    return result
  }, [dipendenti, sedeFiltro])

  const searchDipendentiResults = useMemo(() => {
    if (!search) return new Set<string>()
    const lower = search.toLowerCase()
    const matching = new Set<string>()
    filteredDipendenti.forEach((d) => {
      if (
        d.codice_fiscale?.toLowerCase().includes(lower) ||
        d.titolare?.toLowerCase().includes(lower)
      ) {
        matching.add(d.codice_fiscale)
      }
    })
    return matching
  }, [search, filteredDipendenti])

  const searchResults = useMemo(() => {
    if (!search) return new Set<string>()
    const lower = search.toLowerCase()
    const matching = new Set<string>()
    filteredStrutture.forEach((s) => {
      if (
        s.descrizione?.toLowerCase().includes(lower) ||
        s.codice?.toLowerCase().includes(lower) ||
        s.titolare?.toLowerCase().includes(lower)
      ) {
        matching.add(s.codice)
      }
    })
    searchDipendentiResults.forEach((cf) => {
      const dip = filteredDipendenti.find((d) => d.codice_fiscale === cf)
      if (dip) matching.add(dip.codice_struttura)
    })
    return matching
  }, [search, filteredStrutture, filteredDipendenti, searchDipendentiResults])

  const treeData = useMemo(
    () => buildTree(
      filteredStrutture,
      filteredDipendenti,
      search ? searchResults : undefined,
      search ? searchDipendentiResults : undefined
    ),
    [filteredStrutture, filteredDipendenti, search, searchResults, searchDipendentiResults]
  )

  // ── Drag end: set pendingMove instead of saving directly ─────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (!overId.startsWith('drop::')) return

    const toCode = overId.replace('drop::', '')
    const toParent = toCode === 'root' ? null : toCode

    if (activeId.startsWith('str::')) {
      const codice = activeId.replace('str::', '')
      const struttura = strutture.find((s) => s.codice === codice)
      if (!struttura) return
      if (struttura.codice_padre === toParent) return // nessun cambiamento
      if (toParent === codice) return // non su se stesso
      const toLabel = toParent
        ? (strutture.find((s) => s.codice === toParent)?.descrizione ?? toParent)
        : '(radice)'
      setPendingMove({
        kind: 'struttura',
        codice,
        label: struttura.descrizione ?? codice,
        fromParent: struttura.codice_padre ?? null,
        toParent,
        toLabel,
      })
    } else if (activeId.startsWith('dip::')) {
      const cf = activeId.replace('dip::', '')
      const dip = dipendenti.find((d) => d.codice_fiscale === cf)
      if (!dip) return
      if (!toParent) return // dipendenti non possono stare alla radice
      if (dip.codice_struttura === toParent) return // nessun cambiamento
      const toLabel = strutture.find((s) => s.codice === toParent)?.descrizione ?? toParent
      setPendingMove({
        kind: 'dipendente',
        cf,
        nome: dip.titolare ?? cf,
        fromCodice: dip.codice_struttura ?? '',
        toCodice: toParent,
        toLabel,
      })
    }
  }

  // ── Confirm move: chiamato dopo conferma nella modale ────────────────────
  const handleConfirmMove = async () => {
    if (!pendingMove) return
    const move = pendingMove
    setPendingMove(null)
    try {
      if (move.kind === 'struttura') {
        const result = await api.strutture.updateParent(move.codice, move.toParent)
        if (result.success) {
          await refreshAll()
          addToast(`Struttura "${move.codice}" spostata con successo`, 'success')
        } else {
          addToast(result.message ?? 'Errore nello spostamento', 'error')
        }
      } else {
        const result = await api.dipendenti.update(move.cf, { codice_struttura: move.toCodice })
        if (result.success) {
          await refreshAll()
          addToast(`Dipendente spostato in "${move.toLabel}"`, 'success')
        } else {
          addToast((result as { error?: string }).error ?? 'Errore nello spostamento', 'error')
        }
      }
    } catch (e) {
      addToast('Errore: ' + String(e), 'error')
    }
  }

  const handleDeleteStruttura = (s: Struttura & { dipendenti_count: number }) => {
    if ((s.dipendenti_count || 0) > 0) {
      addToast(`La struttura "${s.codice}" ha ${s.dipendenti_count} dipendente(i). Trasferiscili prima.`, 'error')
      return
    }

    setConfirmDialog({
      title: 'Elimina struttura',
      message: `Sei sicuro di voler eliminare "${s.codice}"?`,
      onConfirm: async () => {
        try {
          const result = await api.strutture.delete(s.codice)
          if (result.success) {
            await refreshAll()
            addToast('Struttura eliminata', 'success')
          } else {
            addToast(result.message || 'Errore', 'error')
          }
        } catch (err) {
          addToast('Errore: ' + String(err), 'error')
        }
      },
    })
  }

  const handleDeleteDipendente = (d: Dipendente) => {
    setConfirmDialog({
      title: 'Elimina dipendente',
      message: `Sei sicuro di voler eliminare "${d.codice_fiscale}"?`,
      onConfirm: async () => {
        try {
          const result = await api.dipendenti.delete(d.codice_fiscale)
          if (result.success) {
            await refreshAll()
            addToast('Dipendente eliminato', 'success')
          } else {
            addToast('Errore', 'error')
          }
        } catch (err) {
          addToast('Errore: ' + String(err), 'error')
        }
      },
    })
  }

  // Messaggio per la modale di conferma spostamento
  const pendingMoveMessage = useMemo(() => {
    if (!pendingMove) return ''
    if (pendingMove.kind === 'struttura') {
      return [
        `Stai spostando la struttura "${pendingMove.label}" (${pendingMove.codice})`,
        ``,
        `Da: ${pendingMove.fromParent ?? '(radice)'}`,
        `A:  ${pendingMove.toLabel}${pendingMove.toParent ? ` (${pendingMove.toParent})` : ' (radice)'}`,
      ].join('\n')
    } else {
      return [
        `Stai spostando il dipendente "${pendingMove.nome}"`,
        `(CF: ${pendingMove.cf})`,
        ``,
        `Da struttura: ${pendingMove.fromCodice || '(nessuna)'}`,
        `A struttura:  ${pendingMove.toLabel} (${pendingMove.toCodice})`,
      ].join('\n')
    }
  }, [pendingMove])

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca struttura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <select
          value={sedeFiltro}
          onChange={(e) => setSedeFiltro(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
        >
          <option value="all">Tutte le sedi</option>
          {sediList.map((s) => (
            <option key={s} value={s.toLowerCase()}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => setCompact(!compact)}
          className={`text-sm px-3 py-2 rounded-md transition-colors ${
            compact ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {compact ? 'Compatto' : 'Esteso'}
        </button>

        <span className="text-xs text-gray-400 ml-auto">
          ≡ Trascina per spostare strutture e dipendenti
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {treeData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Nessuna struttura trovata</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Accordion.Root type="single" collapsible className="space-y-2">
              {treeData.map((rootNode) => (
                <AccordionStruturaItem
                  key={rootNode.struttura.codice}
                  treeNode={rootNode}
                  onEditStruttura={(s) => {
                    setDrawerType('struttura')
                    setDrawerRecord(s)
                    setDrawerOpen(true)
                  }}
                  onDeleteStruttura={handleDeleteStruttura}
                  onEditDipendente={(d) => {
                    setDrawerType('dipendente')
                    setDrawerRecord(d)
                    setDrawerOpen(true)
                  }}
                  onDeleteDipendente={handleDeleteDipendente}
                  compact={compact}
                />
              ))}
            </Accordion.Root>
          </DndContext>
        )}
      </div>

      {/* Confirm Dialog — delete */}
      {confirmDialog && (
        <ConfirmDialog
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={async () => {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Confirm Dialog — drag & drop move */}
      <ConfirmDialog
        open={pendingMove !== null}
        title={pendingMove?.kind === 'struttura' ? '📦 Sposta struttura' : '👤 Sposta dipendente'}
        message={pendingMoveMessage}
        confirmLabel="Conferma spostamento"
        confirmVariant="primary"
        onConfirm={handleConfirmMove}
        onCancel={() => setPendingMove(null)}
      />

      {/* Record Drawer */}
      {drawerOpen && drawerRecord && drawerType === 'struttura' && (
        <RecordDrawer
          open={drawerOpen}
          type="struttura"
          record={drawerRecord as Struttura & { dipendenti_count: number }}
          initialMode="view"
          onClose={() => setDrawerOpen(false)}
          onSaved={refreshAll}
        />
      )}
      {drawerOpen && drawerRecord && drawerType === 'dipendente' && (
        <RecordDrawer
          open={drawerOpen}
          type="dipendente"
          record={drawerRecord as Dipendente}
          initialMode="view"
          onClose={() => setDrawerOpen(false)}
          onSaved={refreshAll}
        />
      )}
    </div>
  )
}
