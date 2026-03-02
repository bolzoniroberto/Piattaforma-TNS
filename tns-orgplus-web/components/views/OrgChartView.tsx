'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, X } from 'lucide-react'
import { useOrgStore } from '@/store/useOrgStore'
import type { Struttura } from '@/types'
import OrgNode from '@/components/orgchart/OrgNode'
import OrgGroupNode from '@/components/orgchart/OrgGroupNode'
import RecordDrawer from '@/components/shared/RecordDrawer'

const NODE_TYPES = { orgNode: OrgNode, orgGroup: OrgGroupNode }

const H_GAP = 260
const V_GAP = 150
const OVERFLOW_DEFAULT = 3   // children shown before "···" button
const OVERFLOW_MAX = 12      // max children visible when overflow expanded
const GRID_COLS = 4          // columns in multi-row grid layout

// Sede layout constants
const SEDE_NODE_W = 240
const SEDE_NODE_H = 100
const SEDE_PAD = 20
const SEDE_GAP = 40
const SEDE_INNER_COLS = 4

interface TreeNode {
  struttura: Struttura & { dipendenti_count: number }
  children: TreeNode[]
  depth: number
  x: number
  y: number
}

function buildTree(
  strutture: (Struttura & { dipendenti_count: number })[],
  rootCodice: string | null
): TreeNode[] {
  const byParent = new Map<string | null, (Struttura & { dipendenti_count: number })[]>()

  strutture
    .filter((s) => !s.deleted_at)
    .forEach((s) => {
      const p = s.codice_padre ?? null
      if (!byParent.has(p)) byParent.set(p, [])
      byParent.get(p)!.push(s)
    })

  function build(parentCodice: string | null, depth: number): TreeNode[] {
    const children = byParent.get(parentCodice) ?? []
    return children.map((s) => ({
      struttura: s,
      children: build(s.codice, depth + 1),
      depth,
      x: 0,
      y: 0
    }))
  }

  return build(rootCodice, 0)
}

/**
 * Layout algorithm with multi-row grid support.
 */
function layoutTree(nodes: TreeNode[], startX = 0): number {
  if (nodes.length === 0) return startX

  let x = startX

  for (const node of nodes) {
    node.y = node.depth * V_GAP

    if (node.children.length === 0) {
      node.x = x
      x += H_GAP
    } else if (
      node.children.length > GRID_COLS &&
      node.children.every((c) => c.children.length === 0)
    ) {
      const n = node.children.length
      const actualCols = Math.min(GRID_COLS, n)
      const gridWidth = actualCols * H_GAP
      const gridStartX = x

      node.x = gridStartX + gridWidth / 2 - H_GAP / 2

      for (let i = 0; i < n; i++) {
        const col = i % GRID_COLS
        const row = Math.floor(i / GRID_COLS)
        node.children[i].x = gridStartX + col * H_GAP
        node.children[i].y = (node.depth + 1 + row) * V_GAP
      }

      x = gridStartX + gridWidth
    } else {
      const subtreeStart = x
      x = layoutTree(node.children, x)
      node.x = (subtreeStart + x - H_GAP) / 2
    }
  }

  return x
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)])
}

type ColorMode = 'none' | 'sede' | 'livello' | 'unita'
type ColorScheme = { border: string; bg: string }

function buildColorMap(
  strutture: (Struttura & { dipendenti_count: number })[],
  mode: ColorMode
): Map<string, ColorScheme> {
  if (mode === 'none') return new Map()
  type ColorField = 'sede_tns' | 'livello' | 'unita_organizzativa'
  const field: ColorField =
    mode === 'sede' ? 'sede_tns' :
    mode === 'livello' ? 'livello' :
    'unita_organizzativa'
  const unique = [...new Set(
    strutture.map((s) => (s[field] as string | null) ?? '').filter(Boolean)
  )]
  return new Map(
    unique.map((val, i) => [
      val,
      {
        border: `hsl(${Math.round((i / unique.length) * 300)}, 55%, 55%)`,
        bg: `hsl(${Math.round((i / unique.length) * 300)}, 55%, 97%)`
      }
    ])
  )
}

function buildSedeLayout(
  strutture: (Struttura & { dipendenti_count: number })[],
  colorMap: Map<string, ColorScheme>,
  colorMode: ColorMode,
  focusPath: Set<string> | null,
  onOpenDrawer: (s: Struttura & { dipendenti_count: number }) => void
): { nodes: Node[]; edges: Edge[] } {
  const bySede = new Map<string, (Struttura & { dipendenti_count: number })[]>()
  strutture.filter((s) => !s.deleted_at).forEach((s) => {
    const sede = s.sede_tns ?? 'N/A'
    if (!bySede.has(sede)) bySede.set(sede, [])
    bySede.get(sede)!.push(s)
  })

  const sedeList = [...bySede.keys()]
  const sedeColors = new Map<string, ColorScheme>(
    sedeList.map((sede, i) => [
      sede,
      {
        border: `hsl(${Math.round((i / sedeList.length) * 300)}, 55%, 55%)`,
        bg: `hsl(${Math.round((i / sedeList.length) * 300)}, 55%, 97%)`
      }
    ])
  )

  let offsetX = 0
  const nodes: Node[] = []
  const edges: Edge[] = []

  bySede.forEach((items, sede) => {
    const cols = Math.min(SEDE_INNER_COLS, items.length)
    const rows = Math.ceil(items.length / SEDE_INNER_COLS)
    const groupW = SEDE_PAD * 2 + cols * SEDE_NODE_W + (cols - 1) * 12
    const groupH = 50 + rows * SEDE_NODE_H + (rows - 1) * 12
    const sedeColor = sedeColors.get(sede)!

    nodes.push({
      id: `group_${sede}`,
      type: 'orgGroup',
      position: { x: offsetX, y: 0 },
      style: { width: groupW, height: groupH },
      data: {
        label: sede,
        count: items.length,
        color: sedeColor.border,
        bgColor: sedeColor.bg
      }
    })

    items.forEach((s, i) => {
      type ColorField = 'sede_tns' | 'livello' | 'unita_organizzativa'
      const field: ColorField =
        colorMode === 'sede' ? 'sede_tns' :
        colorMode === 'livello' ? 'livello' :
        'unita_organizzativa'
      const fieldVal = colorMode !== 'none' ? (s[field] as string | null) ?? '' : ''
      const colorScheme = colorMode !== 'none' ? colorMap.get(fieldVal) : undefined
      const focusStyle: React.CSSProperties = focusPath
        ? { opacity: focusPath.has(s.codice) ? 1 : 0.2, transition: 'opacity 150ms' }
        : { transition: 'opacity 150ms' }

      nodes.push({
        id: s.codice,
        type: 'orgNode',
        parentId: `group_${sede}`,
        extent: 'parent',
        position: {
          x: SEDE_PAD + (i % SEDE_INNER_COLS) * (SEDE_NODE_W + 12),
          y: 40 + Math.floor(i / SEDE_INNER_COLS) * (SEDE_NODE_H + 12)
        },
        data: {
          struttura: s,
          collapsed: false,
          hasChildren: false,
          childrenCount: 0,
          depth: 0,
          isOverflowed: false,
          hiddenCount: 0,
          colorScheme,
          alertNoTitolare: !s.titolare,
          alertNoDipendenti: s.dipendenti_count === 0,
          onExpand: () => {},
          onExpandOverflow: () => {},
          onOpenDrawer: () => onOpenDrawer(s)
        },
        style: focusStyle
      })
    })

    offsetX += groupW + SEDE_GAP
  })

  // Cross-sede edges only
  strutture.filter((s) => !s.deleted_at).forEach((s) => {
    if (s.codice_padre) {
      const parent = strutture.find((p) => p.codice === s.codice_padre)
      if (parent && parent.sede_tns !== s.sede_tns) {
        edges.push({
          id: `e_${s.codice_padre}-${s.codice}`,
          source: s.codice_padre,
          target: s.codice,
          style: { stroke: '#d1d5db', strokeDasharray: '4 4' }
        })
      }
    }
  })

  return { nodes, edges }
}

interface OrgCanvasProps {
  strutture: (Struttura & { dipendenti_count: number })[]
}

function OrgCanvas({ strutture }: OrgCanvasProps) {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set())
  const [expandedOverflow, setExpandedOverflow] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRecord, setDrawerRecord] = useState<(Struttura & { dipendenti_count: number }) | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<(Struttura & { dipendenti_count: number })[]>([])
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const [sedeFiltro, setSedeFiltro] = useState<string>('all')
  const [colorMode, setColorMode] = useState<ColorMode>('none')
  const [viewMode, setViewMode] = useState<'tree' | 'sede'>('tree')
  const [focusedNode, setFocusedNode] = useState<string | null>(null)
  const { fitView, setCenter } = useReactFlow()
  const { refreshAll } = useOrgStore()

  const sediList = useMemo(() => {
    const all = new Set<string>()
    strutture.forEach((s) => s.sede_tns && all.add(s.sede_tns))
    return Array.from(all).sort()
  }, [strutture])

  const filteredStrutture = useMemo(() => {
    if (sedeFiltro === 'all') return strutture
    return strutture.filter((s) => (s.sede_tns?.toLowerCase() ?? '') === sedeFiltro.toLowerCase())
  }, [strutture, sedeFiltro])

  const childCountMap = useMemo(() => {
    const map = new Map<string, number>()
    const root = buildTree(filteredStrutture, null)
    function count(nodes: TreeNode[]): void {
      for (const n of nodes) {
        map.set(n.struttura.codice, n.children.length)
        count(n.children)
      }
    }
    count(root)
    return map
  }, [filteredStrutture])

  const visibleTree = useMemo(() => {
    function filterTree(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => {
        const codice = n.struttura.codice
        if (collapsedSet.has(codice)) return { ...n, children: [] }

        const allChildren = filterTree(n.children)
        if (allChildren.length <= OVERFLOW_DEFAULT) return { ...n, children: allChildren }
        if (expandedOverflow.has(codice)) return { ...n, children: allChildren.slice(0, OVERFLOW_MAX) }
        return { ...n, children: allChildren.slice(0, OVERFLOW_DEFAULT) }
      })
    }

    const root = buildTree(filteredStrutture, null)
    const filtered = filterTree(root)
    layoutTree(filtered)
    return flattenTree(filtered)
  }, [filteredStrutture, collapsedSet, expandedOverflow])

  const colorMap = useMemo(
    () => buildColorMap(filteredStrutture, colorMode),
    [filteredStrutture, colorMode]
  )

  const focusPath = useMemo(() => {
    if (!focusedNode) return null
    const set = new Set<string>()
    let cur: string | null = focusedNode
    while (cur) {
      set.add(cur)
      cur = filteredStrutture.find((s) => s.codice === cur)?.codice_padre ?? null
    }
    filteredStrutture
      .filter((s) => s.codice_padre === focusedNode)
      .forEach((s) => set.add(s.codice))
    return set
  }, [focusedNode, filteredStrutture])

  const focusedLabel = useMemo(() => {
    if (!focusedNode) return null
    return filteredStrutture.find((s) => s.codice === focusedNode)?.descrizione ?? focusedNode
  }, [focusedNode, filteredStrutture])

  const toggleCollapse = useCallback((codice: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev)
      if (next.has(codice)) {
        next.delete(codice)
      } else {
        next.add(codice)
        setExpandedOverflow((o) => { const s = new Set(o); s.delete(codice); return s })
      }
      return next
    })
  }, [])

  const toggleOverflow = useCallback((codice: string) => {
    setExpandedOverflow((prev) => {
      const next = new Set(prev)
      if (next.has(codice)) next.delete(codice)
      else next.add(codice)
      return next
    })
  }, [])

  const { nodes, edges } = useMemo(() => {
    if (viewMode === 'sede') {
      return buildSedeLayout(filteredStrutture, colorMap, colorMode, focusPath, (s) => {
        setDrawerRecord(s)
        setDrawerOpen(true)
        setFocusedNode(s.codice)
      })
    }

    // Tree view
    const treeNodes: Node[] = visibleTree.map((tn) => {
      const codice = tn.struttura.codice
      const totalChildren = childCountMap.get(codice) ?? 0
      const isCollapsed = collapsedSet.has(codice)
      const isOverflowed =
        !isCollapsed &&
        totalChildren > OVERFLOW_DEFAULT &&
        !expandedOverflow.has(codice)
      const hiddenCount = isOverflowed
        ? totalChildren - OVERFLOW_DEFAULT
        : Math.max(0, totalChildren - OVERFLOW_MAX)

      type ColorField = 'sede_tns' | 'livello' | 'unita_organizzativa'
      const field: ColorField =
        colorMode === 'sede' ? 'sede_tns' :
        colorMode === 'livello' ? 'livello' :
        'unita_organizzativa'
      const fieldVal = colorMode !== 'none' ? (tn.struttura[field] as string | null) ?? '' : ''
      const colorScheme = colorMode !== 'none' ? colorMap.get(fieldVal) : undefined
      const focusStyle: React.CSSProperties = focusPath
        ? { opacity: focusPath.has(codice) ? 1 : 0.2, transition: 'opacity 150ms' }
        : { transition: 'opacity 150ms' }

      return {
        id: codice,
        type: 'orgNode',
        position: { x: tn.x, y: tn.y },
        data: {
          struttura: tn.struttura,
          collapsed: isCollapsed,
          hasChildren: totalChildren > 0,
          childrenCount: totalChildren,
          depth: tn.depth,
          isOverflowed,
          hiddenCount,
          colorScheme,
          alertNoTitolare: !tn.struttura.titolare,
          alertNoDipendenti: tn.struttura.dipendenti_count === 0,
          onExpand: () => toggleCollapse(codice),
          onExpandOverflow: () => toggleOverflow(codice),
          onOpenDrawer: () => {
            setDrawerRecord(tn.struttura)
            setDrawerOpen(true)
            setFocusedNode(codice)
          }
        },
        className: highlightedNode === codice ? 'ring-2 ring-indigo-500 rounded-lg' : undefined,
        style: focusStyle
      }
    })

    const treeEdges: Edge[] = []
    visibleTree.forEach((tn) => {
      if (tn.struttura.codice_padre) {
        treeEdges.push({
          id: `${tn.struttura.codice_padre}-${tn.struttura.codice}`,
          source: tn.struttura.codice_padre,
          target: tn.struttura.codice,
          type: 'smoothstep',
          style: { stroke: '#d1d5db', strokeWidth: 1.5 }
        })
      }
    })

    return { nodes: treeNodes, edges: treeEdges }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, visibleTree, collapsedSet, expandedOverflow, childCountMap, highlightedNode,
      toggleCollapse, toggleOverflow, filteredStrutture, colorMode, colorMap, focusPath])

  // Fit view when data changes
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStrutture, viewMode])

  // Fit view when side panel opens/closes
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen])

  // Search
  useEffect(() => {
    if (!search) {
      setSearchResults([])
      return
    }
    const lower = search.toLowerCase()
    const results = strutture
      .filter(
        (s) =>
          s.descrizione?.toLowerCase().includes(lower) ||
          s.codice?.toLowerCase().includes(lower) ||
          s.titolare?.toLowerCase().includes(lower)
      )
      .slice(0, 8)
    setSearchResults(results)
  }, [search, strutture])

  const handleSelectSearchResult = useCallback(
    (s: Struttura & { dipendenti_count: number }) => {
      setSearch(s.descrizione ?? '')
      setSearchResults([])
      setHighlightedNode(s.codice)
      const node = nodes.find((n) => n.id === s.codice)
      if (node) {
        setCenter(node.position.x + 110, node.position.y + 45, { duration: 600, zoom: 1 })
      }
      setTimeout(() => setHighlightedNode(null), 2000)
    },
    [nodes, setCenter]
  )

  const expandAll = useCallback(() => setCollapsedSet(new Set()), [])
  const collapseAll = useCallback(() => {
    const allCodes = new Set(strutture.map((s) => s.codice))
    setCollapsedSet(allCodes)
    setExpandedOverflow(new Set())
  }, [strutture])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'orgNode') {
      setFocusedNode(node.id)
    }
  }, [])

  const handlePaneClick = useCallback(() => {
    setFocusedNode(null)
    setDrawerOpen(false)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca struttura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {searchResults.map((s) => (
                <button
                  key={s.codice}
                  onClick={() => handleSelectSearchResult(s)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  <span className="font-medium text-gray-900">{s.descrizione}</span>
                  <span className="text-gray-400 ml-2 text-xs">{s.codice}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {viewMode === 'tree' && (
          <>
            <button
              onClick={expandAll}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 hover:bg-gray-50 rounded-md transition-colors"
            >
              Espandi tutto
            </button>
            <button
              onClick={collapseAll}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 hover:bg-gray-50 rounded-md transition-colors"
            >
              Comprimi tutto
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Focus indicator */}
        {focusedNode && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-md text-xs text-indigo-700">
            <span className="truncate max-w-[150px]">{focusedLabel}</span>
            <button onClick={() => setFocusedNode(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Color mode selector */}
        <select
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as ColorMode)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-700"
        >
          <option value="none">Colora per…</option>
          <option value="sede">Sede</option>
          <option value="livello">Livello</option>
          <option value="unita">Unità Org.</option>
        </select>

        {/* View mode toggle */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('tree')}
            className={[
              'px-3 py-1.5 text-sm transition-colors',
              viewMode === 'tree' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
            ].join(' ')}
          >
            Albero
          </button>
          <button
            onClick={() => setViewMode('sede')}
            className={[
              'px-3 py-1.5 text-sm transition-colors border-l border-gray-200',
              viewMode === 'sede' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
            ].join(' ')}
          >
            Per Sede
          </button>
        </div>

        {/* Sede filter (only in tree mode) */}
        {viewMode === 'tree' && (
          <select
            value={sedeFiltro}
            onChange={(e) => setSedeFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-700"
          >
            <option value="all">Tutte le sedi</option>
            {sediList.map((s) => (
              <option key={s} value={s.toLowerCase()}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Color legend */}
      {colorMode !== 'none' && colorMap.size > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
          {[...colorMap.entries()].map(([val, c]) => (
            <span key={val} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm" style={{ background: c.border }} />
              {val || '—'}
            </span>
          ))}
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 min-w-0 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            <Controls
              position="bottom-right"
              className="!shadow-none !border !border-gray-200 !rounded-lg overflow-hidden"
            />
            <MiniMap
              position="bottom-left"
              className="!border !border-gray-200 !rounded-lg"
              style={{ width: 120, height: 80 }}
              nodeColor="#e5e7eb"
            />
          </ReactFlow>
        </div>

        {/* Side panel */}
        {drawerOpen && (
          <div className="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <RecordDrawer
              variant="panel"
              open={drawerOpen}
              type="struttura"
              record={drawerRecord}
              initialMode="view"
              onClose={() => {
                setDrawerOpen(false)
                setFocusedNode(null)
              }}
              onSaved={refreshAll}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrgChartView() {
  const { strutture } = useOrgStore()

  if (strutture.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="text-gray-400 text-5xl mb-4">🏢</div>
        <p className="text-gray-500 font-medium">Nessuna struttura caricata</p>
        <p className="text-sm text-gray-400 mt-1">
          Vai su <strong>Import / Export</strong> per caricare il file XLS
        </p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <OrgCanvas strutture={strutture} />
    </ReactFlowProvider>
  )
}
