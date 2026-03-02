'use client'
import React, { memo } from 'react'

interface OrgGroupNodeData {
  label: string
  count: number
  color: string
  bgColor: string
}

interface OrgGroupNodeProps {
  data: OrgGroupNodeData
}

const OrgGroupNode = memo(function OrgGroupNode({ data }: OrgGroupNodeProps) {
  return (
    <div
      style={{
        border: `2px solid ${data.color}`,
        borderRadius: 12,
        background: data.bgColor,
        padding: '8px 12px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{data.label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{data.count} strutture</p>
    </div>
  )
})

export default OrgGroupNode
