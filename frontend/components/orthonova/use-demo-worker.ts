'use client'

import useSWR from 'swr'

export function useDemoWorker() {
  const { data, mutate } = useSWR<string>('orthonova-demo-display-name', null, { fallbackData: 'Priya Sharma' })
  return { name: data ?? 'Priya Sharma', setName: (name: string) => mutate(name, { revalidate: false }) }
}
