import type { Metadata } from 'next'
import { DressUp } from '@/components/dressup/DressUp'

export const metadata: Metadata = {
  title: 'Page not found — Aryan Shrestha',
}

/** Unknown routes (HTTP 404) get the dress-up page under its own heading (spec §5). */
export default function NotFound() {
  return <DressUp title="This page doesn't exist — but you can dress me up" />
}
