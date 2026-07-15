'use client'
import dynamic from 'next/dynamic'

const StoreScene = dynamic(() => import('@/components/store/Scene'), {
  ssr: false,
})

export default function StoreSlugPage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <StoreScene />
    </div>
  )
}
