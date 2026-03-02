'use client'
import React, { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import OrgChartView from '@/components/views/OrgChartView'
import GridView from '@/components/views/GridView'
import AccordionView from '@/components/views/AccordionView'
import ImportExportView from '@/components/views/ImportExportView'
import StoricoView from '@/components/views/StoricoView'
import { useOrgStore } from '@/store/useOrgStore'
import type { TabView } from '@/types'

export default function Home() {
  const { activeTab, refreshAll } = useOrgStore()

  // Lazy-mount tabs: only mount a view after it has been activated at least once.
  // This prevents AG Grid (and other heavy components) from initialising inside a
  // `display:none` container — which breaks ResizeObserver in React 19 Strict Mode.
  const [mountedTabs, setMountedTabs] = useState<Set<TabView>>(() => new Set([activeTab]))

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev
      return new Set([...prev, activeTab])
    })
  }, [activeTab])

  useEffect(() => {
    refreshAll()
  }, [])

  const vis = (tab: TabView) => activeTab === tab ? 'h-full' : 'h-full hidden'

  return (
    <AppShell>
      {mountedTabs.has('orgchart') && <div className={vis('orgchart')}><OrgChartView /></div>}
      {mountedTabs.has('grid') && <div className={vis('grid')}><GridView /></div>}
      {mountedTabs.has('accordion') && <div className={vis('accordion')}><AccordionView /></div>}
      {mountedTabs.has('importexport') && <div className={vis('importexport')}><ImportExportView /></div>}
      {mountedTabs.has('storico') && <div className={vis('storico')}><StoricoView /></div>}
    </AppShell>
  )
}
