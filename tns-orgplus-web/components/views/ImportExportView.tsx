'use client'
import React, { useState, useCallback, useRef } from 'react'
import { Upload, Download, FileX, AlertCircle, CheckCircle } from 'lucide-react'
import { useOrgStore } from '@/store/useOrgStore'
import { api } from '@/lib/api'
import type { ImportReport } from '@/types'

export default function ImportExportView() {
  const { counts, refreshAll, refreshCounts, showToast } = useOrgStore()
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewReport, setPreviewReport] = useState<ImportReport | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lastImportFile, setLastImportFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      setSelectedFile(file)
      setPreviewReport(null)
    } else {
      showToast('Seleziona un file .xls o .xlsx', 'error')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [])

  const handleImport = async () => {
    if (!selectedFile) return
    setImporting(true)
    try {
      const report = await api.xls.import(selectedFile)
      setPreviewReport(report)
      if (report.errors.length === 0) {
        showToast(`Importato: ${report.inserted} nuovi, ${report.updated} aggiornati, ${report.unchanged} invariati`, 'success')
        await refreshAll()
        setLastImportFile(selectedFile.name)
        setSelectedFile(null)
      } else {
        showToast(`Completato con ${report.errors.length} errori`, 'warning')
      }
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.xls.export()
      showToast('File esportato', 'success')
      await refreshCounts()
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-full p-6 flex gap-6">
      {/* IMPORT */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900 text-sm">Import</h2>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
        />

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={['border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer', dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'].join(' ')}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={`w-8 h-8 ${dragOver ? 'text-indigo-500' : 'text-gray-300'}`} />
          <p className="text-sm text-gray-500 text-center">
            <span className="font-medium text-gray-700">Trascina qui il file XLS</span>
            <br />oppure clicca per selezionare
          </p>
          <p className="text-xs text-gray-400">.xls · .xlsx</p>
        </div>

        {/* Selected file */}
        {selectedFile && (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 flex items-center justify-between">
            <span className="truncate">{selectedFile.name}</span>
            <button onClick={() => { setSelectedFile(null); setPreviewReport(null) }} className="text-gray-400 hover:text-gray-600 ml-2">
              <FileX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Import report */}
        {previewReport && (
          <div className={`rounded-lg px-3 py-3 text-sm border ${previewReport.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              {previewReport.errors.length > 0 ? <AlertCircle className="w-4 h-4 text-yellow-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
              <span className="font-medium">Report import</span>
            </div>
            <div className="text-gray-600 space-y-0.5">
              <div>Nuovi: {previewReport.inserted}</div>
              <div>Aggiornati: {previewReport.updated}</div>
              <div>Invariati: {previewReport.unchanged}</div>
              {previewReport.errors.length > 0 && (
                <div className="text-red-600 mt-2">
                  {previewReport.errors.slice(0, 3).map((e, i) => <div key={i} className="text-xs">• {e}</div>)}
                  {previewReport.errors.length > 3 && <div className="text-xs">…e altri {previewReport.errors.length - 3} errori</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {selectedFile && (
            <button onClick={handleImport} disabled={importing} className="w-full py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
              {importing ? 'Importando…' : 'Importa file selezionato'}
            </button>
          )}
        </div>

        {lastImportFile && <p className="text-xs text-gray-400">Ultimo import: {lastImportFile}</p>}
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-200" />

      {/* EXPORT */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-900 text-sm">Export</h2>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Strutture attive</span>
            <span className="font-medium text-gray-900">{counts?.strutture ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Dipendenti attivi</span>
            <span className="font-medium text-gray-900">{counts?.dipendenti ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-2">
            <span className="text-gray-500">Righe DB_TNS</span>
            <span className="font-medium text-gray-900">{counts?.db_tns ?? '—'}</span>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleExport}
          disabled={exporting || !counts || counts.strutture === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Esportando…' : 'Esporta XLS'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Formato .xls (Excel 97-2003) · 3 sheet (DB_TNS, TNS Personale, TNS Strutture)
        </p>
      </div>
    </div>
  )
}
