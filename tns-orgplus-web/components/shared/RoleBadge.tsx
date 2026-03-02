import React from 'react'

interface RoleBadgeProps {
  value: string | null
  label?: string
}

const ROLE_COLORS: Record<string, string> = {
  APPR: 'bg-blue-100 text-blue-700',
  APPRAD: 'bg-blue-100 text-blue-700',
  APPRG: 'bg-blue-100 text-blue-700',
  APPRTOP: 'bg-indigo-100 text-indigo-700',
  APPRSRALTR: 'bg-indigo-100 text-indigo-700',
  V: 'bg-green-100 text-green-700',
  VAD: 'bg-green-100 text-green-700',
  VG: 'bg-green-100 text-green-700',
  VGTOP: 'bg-emerald-100 text-emerald-700',
  VGTOP2: 'bg-emerald-100 text-emerald-700'
}

function getRoleColor(value: string): string {
  return ROLE_COLORS[value] ?? 'bg-gray-100 text-gray-700'
}

export default function RoleBadge({ value, label }: RoleBadgeProps) {
  if (!value) {
    return <span className="text-gray-300 text-sm">—</span>
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${getRoleColor(value)}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {label ?? value}
    </span>
  )
}
