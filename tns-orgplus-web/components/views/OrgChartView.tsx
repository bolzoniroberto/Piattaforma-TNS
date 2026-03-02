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
import { Search } from 'lucide-react'
import { useOrgStore } from '@/store/useOrgStore'
import type { Struttura } from '@/types'
import OrgNode from '@/components/orgchart/OrgNode'
import RecordDrawer from '@/components/shared/RecordDrawer'

const NODE_TYPES = { orgNode: OrgNode }

const H_GAP = 260
const V_GAP = 150

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

function layoutTree(nodes: TreeNode[], startX = 0): number {
  if (nodes.length === 0) return startX

  let x = startX
  for (const node of nodes) {
    if (node.children.length > 0) {
      const subtreeStart = x
      x = layoutTree(node.children, x)
      node.x = (subtreeStart + x - H_GAP) / 2
    } else {
      node.x = x
      x += H_GAP
    }
    node.y = node.depth * V_GAP
  }
  return x
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)])
}

interface OrgCanvasProps {
  strutture: (Struttura & { dipendenti_count: number })[]
}

function OrgCanvas({ strutture }: OrgCanvasProps) {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRecord, setDrawerRecord] = useState<(Struttura & { dipendenti_count: number }) | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<(Struttura & { dipendenti_count: number })[]>([])
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const [sedeFiltro, setSedeFiltro] = useState<string>('all')
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

  // Build tree (respecting collapsed state)
  const visibleTree = useMemo(() => {
    function filterCollapsed(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => ({
        ...n,
        children: collapsedSet.has(n.struttura.codice) ? [] : filterCollapsed(n.children)
      }))
    }

    const root = buildTree(filteredStrutture, null)
    const withLayout = filterCollapsed(root)
    layoutTree(withLayout)
    return flattenTree(withLayout)
  }, [filteredStrutture, collapsedSet])

  // Full tree for child count
  const fullTree = useMemo(() => {
    const root = buildTree(filteredStrutture, null)
    layoutTree(root)
    return flattenTree(root)
  }, [filteredStrutture])

  const childCountMap = useMemo(() => {
    const map = new Map<string, number>()
    const root = buildTree(filteredStrutture, null)
    function countChildren(nodes: TreeNode[]): void {
      for (const n of nodes) {
        map.set(n.struttura.codice, n.children.length)
        countChildren(n.children)
      }
    }
    countChildren(root)
    return map
  }, [filteredStrutture])

  const toggleCollapse = useCallback((codice: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev)
      if (next.has(codice)) {
        next.delete(codice)
      } else {
        next.add(codice)
      }
      return next
    })
  }, [])

  const nodes: Node[] = useMemo(() => {
    return visibleTree.map((tn) => ({
      id: tn.struttura.codice,
      type: 'orgNode',
      position: { x: tn.x, y: tn.y },
      data: {
        struttura: tn.struttura,
        collapsed: collapsedSet.has(tn.struttura.codice),
        hasChildren: (childCountMap.get(tn.struttura.codice) ?? 0) > 0,
        childrenCount: childCountMap.get(tn.struttura.codice) ?? 0,
        depth: tn.depth,
        onExpand: () => toggleCollapse(tn.struttura.codice),
        onOpenDrawer: () => {
          setDrawerRecord(tn.struttura)
          setDrawerOpen(true)
        }
      },
      className: highlightedNode === tn.struttura.codice ? 'ring-2 ring-indigo-500 rounded-lg' : undefined
    }))
  }, [visibleTree, collapsedSet, childCountMap, highlightedNode, toggleCollapse])

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = []
    visibleTree.forEach((tn) => {
      if (tn.struttura.codice_padre) {
        result.push({
          id: `${tn.struttura.codice_padre}-${tn.struttura.codice}`,
          source: tn.struttura.codice_padre,
          target: tn.struttura.codice,
          type: 'smoothstep',
          style: { stroke: '#d1d5db', strokeWidth: 1.5 }
        })
      }
    })
    return result
  }, [visibleTree])

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100)
    }
  }, [filteredStrutture])

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
  }, [strutture])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
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
          {/* Autocomplete dropdown */}
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

        <div className="flex-1" />

        {/* Sede filter */}
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
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
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

      {/* Drawer */}
      <RecordDrawer
        open={drawerOpen}
        type="struttura"
        record={drawerRecord}
        initialMode="view"
        onClose={() => setDrawerOpen(false)}
        onSaved={refreshAll}
      />
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
