import React from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'warning'
  onClose: () => void
}

const icons = {
  success: <CheckCircle className="w-4 h-4 text-green-600" />,
  error: <XCircle className="w-4 h-4 text-red-600" />,
  warning: <AlertCircle className="w-4 h-4 text-yellow-600" />
}

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
}

export default function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-sm text-sm z-50 max-w-sm ${styles[type]}`}
    >
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
