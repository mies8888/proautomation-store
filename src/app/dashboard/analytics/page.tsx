'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const AnalyticsContent = dynamic(
  () => import('./analytics-content'),
  { 
    ssr: false,
    loading: () => <div className="p-8">Loading analytics...</div>
  }
)

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading analytics...</div>}>
      <AnalyticsContent />
    </Suspense>
  )
}
