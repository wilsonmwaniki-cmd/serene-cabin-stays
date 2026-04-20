import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Wild by LERA'

interface Props {
  name?: string
  podName?: string
  checkIn?: string
  checkOut?: string
  adults?: number
  children?: number
}

const BookingConfirmation = ({ name, podName, checkIn, checkOut, adults, children }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your stay at {SITE_NAME} is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Karibu sana, ${name}.` : 'Karibu sana.'}</Heading>
        <Text style={text}>
          Your stay at {SITE_NAME} is confirmed. We can't wait to host you.
        </Text>
        <Section style={card}>
          <Text style={label}>Your reservation</Text>
          {podName && <Text style={row}>{podName}</Text>}
          {(checkIn || checkOut) && <Text style={row}>{checkIn} → {checkOut}</Text>}
          {(adults != null || children != null) && (
            <Text style={rowMuted}>
              {adults ?? 0} adult{adults === 1 ? '' : 's'}
              {children ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''}
            </Text>
          )}
        </Section>
        <Text style={text}>
          Check-in is from 3pm and check-out by 2pm. If you have any special requests or arrival timing changes, just reply to this email.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>With warmth,<br />The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmation,
  subject: `Your stay is confirmed · ${SITE_NAME}`,
  displayName: 'Booking confirmed',
  previewData: { name: 'Amani', podName: 'Glamping Pod 1', checkIn: 'Jun 14, 2026', checkOut: 'Jun 16, 2026', adults: 2, children: 0 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 'normal', color: '#2d3a2e', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 22px' }
const card = { backgroundColor: '#f5f1ea', padding: '18px 20px', borderLeft: '3px solid #b8654c', margin: '0 0 22px' }
const label = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#8a8a8a', margin: '0 0 8px' }
const row = { fontSize: '15px', color: '#2d3a2e', margin: '2px 0' }
const rowMuted = { fontSize: '13px', color: '#7a7a7a', margin: '6px 0 0' }
const hr = { borderColor: '#e5e0d6', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#7a7a7a', margin: 0, lineHeight: '1.6' }