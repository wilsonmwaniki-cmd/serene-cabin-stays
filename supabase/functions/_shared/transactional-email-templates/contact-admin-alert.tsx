import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
}

const ContactAdminAlert = ({ name, email, phone, subject, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New message from {name || 'a guest'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact message</Heading>
        <Section style={meta}>
          <Text style={row}><b>Name:</b> {name || '—'}</Text>
          <Text style={row}><b>Email:</b> {email || '—'}</Text>
          {phone && <Text style={row}><b>Phone:</b> {phone}</Text>}
          {subject && <Text style={row}><b>Subject:</b> {subject}</Text>}
        </Section>
        <Hr style={hr} />
        <Text style={label}>Message</Text>
        <Text style={body}>{message || '—'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactAdminAlert,
  subject: (d: Record<string, any>) => `New message from ${d.name || 'guest'} — Wild by LERA`,
  displayName: 'Contact — admin alert',
  to: 'bookings@lera.co.ke',
  previewData: { name: 'Amani', email: 'amani@example.com', phone: '+254700000000', subject: 'Weekend stay', message: 'Looking to book a quiet weekend for two.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '20px', color: '#2d3a2e', margin: '0 0 16px' }
const meta = { backgroundColor: '#f5f1ea', padding: '14px 16px', margin: '0 0 16px' }
const row = { fontSize: '14px', color: '#3a3a3a', margin: '4px 0' }
const label = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#8a8a8a', margin: '0 0 6px' }
const body = { fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const, margin: 0 }
const hr = { borderColor: '#e5e0d6', margin: '20px 0' }