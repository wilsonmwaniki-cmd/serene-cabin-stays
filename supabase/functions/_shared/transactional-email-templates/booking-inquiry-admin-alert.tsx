import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  email?: string
  phone?: string
  podName?: string
  checkIn?: string
  checkOut?: string
  adults?: number
  children?: number
  rooms?: number
  notes?: string
}

const BookingInquiryAdminAlert = ({ name, email, phone, podName, checkIn, checkOut, adults, children, rooms, notes }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New booking inquiry from {name || 'a guest'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New booking inquiry</Heading>
        <Section style={meta}>
          <Text style={row}><b>Guest:</b> {name || '—'}</Text>
          <Text style={row}><b>Email:</b> {email || '—'}</Text>
          {phone && <Text style={row}><b>Phone:</b> {phone}</Text>}
        </Section>
        <Section style={meta}>
          {podName && <Text style={row}><b>Pod:</b> {podName}</Text>}
          {(checkIn || checkOut) && <Text style={row}><b>Dates:</b> {checkIn} → {checkOut}</Text>}
          <Text style={row}><b>Guests:</b> {adults ?? 0} adults · {children ?? 0} children · {rooms ?? 1} room(s)</Text>
        </Section>
        {notes && (
          <>
            <Hr style={hr} />
            <Text style={label}>Notes</Text>
            <Text style={body}>{notes}</Text>
          </>
        )}
        <Hr style={hr} />
        <Text style={footer}>Approve or decline from the admin dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingInquiryAdminAlert,
  subject: (d: Record<string, any>) => `New booking inquiry: ${d.name || 'guest'} · ${d.podName || 'pod'}`,
  displayName: 'Booking inquiry — admin alert',
  to: 'bookings@lera.co.ke',
  previewData: { name: 'Amani', email: 'amani@example.com', phone: '+254700000000', podName: 'Glamping Pod 1', checkIn: 'Jun 14, 2026', checkOut: 'Jun 16, 2026', adults: 2, children: 0, rooms: 1, notes: 'Anniversary trip' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '20px', color: '#2d3a2e', margin: '0 0 16px' }
const meta = { backgroundColor: '#f5f1ea', padding: '14px 16px', margin: '0 0 12px' }
const row = { fontSize: '14px', color: '#3a3a3a', margin: '4px 0' }
const label = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#8a8a8a', margin: '0 0 6px' }
const body = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const, margin: 0 }
const hr = { borderColor: '#e5e0d6', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#8a8a8a', margin: 0 }