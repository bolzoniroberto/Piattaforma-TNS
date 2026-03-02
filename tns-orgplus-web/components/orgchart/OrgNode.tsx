'use client'
import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChevronRight, Users } from 'lucide-react'
import type { Struttura } from '@/types'

interface OrgNodeData {
  struttura: Struttura & { dipendenti_count: number }
  collapsed: boolean
  hasChildren: boolean
  childrenCount: number
  depth: number
  isOverflowed: boolean    // showing fewer than all children (overflow mode)
  hiddenCount: number      // how many children are currently hidden
  colorScheme?: { border: string; bg: string }
  alertNoTitolare?: boolean
  alertNoDipendenti?: boolean
  onExpand: () => void
  onExpandOverflow: () => void
  onOpenDrawer: () => void
}

interface OrgNodeProps {
  data: OrgNodeData
  selected: boolean
}

const OrgNode = memo(function OrgNode({ data, selected }: OrgNodeProps) {
  const {
    struttura, collapsed, hasChildren, childrenCount, depth,
    isOverflowed, hiddenCount, colorScheme, alertNoTitolare, alertNoDipendenti,
    onExpand, onExpandOverflow, onOpenDrawer
  } = data
  const isRoot = depth === 0

  return (
    <div
      className={[
        'relative rounded-lg shadow-sm select-none transition-all duration-150',
        isRoot ? 'border-2 border-indigo-300' : 'border border-gray-200',
        selected ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-md hover:border-gray-300'
      ].join(' ')}
      style={{
        width: 220,
        minHeight: 90,
        borderLeftColor: colorScheme?.border,
        borderLeftWidth: colorScheme ? 4 : undefined,
        backgroundColor: colorScheme?.bg ?? '#ffffff'
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />

      {(alertNoTitolare || alertNoDipendenti) && (
        <div className="absolute top-2 right-2 flex gap-1">
          {alertNoTitolare && <span className="w-2 h-2 rounded-full bg-red-400" title="Nessun titolare" />}
          {alertNoDipendenti && <span className="w-2 h-2 rounded-full bg-amber-400" title="0 dipendenti" />}
        </div>
      )}

      <div className="px-3 py-2.5 flex flex-col gap-1">
        <div
          className="font-semibold text-gray-900 leading-snug overflow-hidden"
          style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {struttura.descrizione}
        </div>

        {struttura.cdc_costo && (
          <div className="text-gray-400 leading-none" style={{ fontSize: 11 }}>
            CdC {struttura.cdc_costo}
          </div>
        )}

        {struttura.titolare && (
          <div className="text-gray-600 truncate" style={{ fontSize: 12 }}>
            {struttura.titolare}
          </div>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <span className="flex items-center gap-1 text-gray-400" style={{ fontSize: 11 }}>
            <Users className="w-3 h-3" />
            {struttura.dipendenti_count}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDrawer() }}
            className="text-gray-300 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />

      {/* Three-state expand button */}
      {hasChildren && (
        collapsed ? (
          // State 1 — collapsed: show "+N" to expand to overflow mode
          <button
            onClick={(e) => { e.stopPropagation(); onExpand() }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded hover:bg-gray-200 transition-colors border border-gray-200"
            style={{ fontSize: 11 }}
          >
            +{childrenCount}
          </button>
        ) : isOverflowed ? (
          // State 2 — overflow: show "···+N" to expand to full view
          <button
            onClick={(e) => { e.stopPropagation(); onExpandOverflow() }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded hover:bg-amber-100 transition-colors border border-amber-200 whitespace-nowrap"
            style={{ fontSize: 11 }}
            title={`Mostra altri ${hiddenCount} riporti`}
          >
            ···+{hiddenCount}
          </button>
        ) : (
          // State 3 — fully expanded: show "−" to collapse
          <button
            onClick={(e) => { e.stopPropagation(); onExpand() }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-50 text-indigo-400 text-xs px-2 py-0.5 rounded hover:bg-indigo-100 transition-colors border border-indigo-100"
            style={{ fontSize: 11 }}
          >
            −
          </button>
        )
      )}
    </div>
  )
})

export default OrgNode
