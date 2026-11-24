import type { Metadata } from 'next'
import { DressUp } from '@/components/dressup/DressUp'

export const metadata: Metadata = {
  title: 'Dress me up — Aryan Shrestha',
  description: 'Change his hair, colours and outfit. The look follows you around the site.',
}

export default function DressUpPage() {
  return <DressUp title="Dress me up" />
}
