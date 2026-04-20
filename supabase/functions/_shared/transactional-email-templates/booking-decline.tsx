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
}

const BookingDecline = ({ name, podName, checkIn, checkOut }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your stay request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Hello ${name},` : 'Hello,'}</Heading>
        <Text style={text}>
          Asante for your interest in staying with us at {SITE_NAME}. Unfortunately, we're unable to confirm your request for the dates below — either the pod is not available, or we cannot accommodate the group as planned.
        </Text>
        {(podName || checkIn || checkOut) && (
          <Section style={card}>
            {podName && <Text style={row}>{podName}</Text>}
            {(checkIn || checkOut) && <Text style={row}>{checkIn} → {checkOut}</Text>}
          </Section>
        )}
        <Text style={text}>
          We'd love to host you another time. Please reply to this email with alternative dates, or get in touch on +254 700 000 000 and we'll do our best to find a fit.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>With warmth,<br />The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingDecline,
  subject: `An update on your stay request · ${SITE_NAME}`,
  displayName: 'Booking declined',
  previewData: { name: 'Amani', podName: 'Glamping Pod 1', checkIn: 'Jun 14, 2026', checkOut: 'Jun 16, 2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2d3a2e', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 18px' }
const card = { backgroundColor: '#f5f1ea', padding: '16px 18px', borderLeft: '3px solid #b8654c', margin: '0 0 18px' }
const row = { fontSize: '15px', color: '#2d3a2e', margin: '2px 0' }
const hr = { borderColor: '#e5e0d6', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#7a7a7a', margin: 0, lineHeight: '1.6' }