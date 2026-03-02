'use client'
import React, { useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import OrgChartView from '@/components/views/OrgChartView'
import GridView from '@/components/views/GridView'
import AccordionView from '@/components/views/AccordionView'
import ImportExportView from '@/components/views/ImportExportView'
import StoricoView from '@/components/views/StoricoView'
import { useOrgStore } from '@/store/useOrgStore'

export default function Home() {
  const { activeTab, refreshAll } = useOrgStore()

  useEffect(() => {
    refreshAll()
  }, [])

  return (
    <AppShell>
      {/* Keep all tabs mounted — hidden preserves local state (scroll position, accordion open, etc.) */}
      <div className={`h-full ${activeTab === 'orgchart' ? '' : 'hidden'}`}><OrgChartView /></div>
      <div className={`h-full ${activeTab === 'grid' ? '' : 'hidden'}`}><GridView /></div>
      <div className={`h-full ${activeTab === 'accordion' ? '' : 'hidden'}`}><AccordionView /></div>
      <div className={`h-full ${activeTab === 'importexport' ? '' : 'hidden'}`}><ImportExportView /></div>
      <div className={`h-full ${activeTab === 'storico' ? '' : 'hidden'}`}><StoricoView /></div>
    </AppShell>
  )
}
