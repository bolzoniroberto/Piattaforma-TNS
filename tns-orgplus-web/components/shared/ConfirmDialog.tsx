import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  confirmVariant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-none" />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className={[
              'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
