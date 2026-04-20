import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Wild by LERA'

interface Props {
  name?: string
  message?: string
}

const ContactReceived = ({ name, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for reaching out to {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `Asante, ${name}.` : 'Asante for reaching out.'}</Heading>
        <Text style={text}>
          We've received your note and one of the team will get back to you personally within a few hours.
        </Text>
        {message && (
          <Section style={quoteBox}>
            <Text style={quoteLabel}>Your message</Text>
            <Text style={quoteText}>"{message}"</Text>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={footer}>Warmly,<br />The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactReceived,
  subject: `We've received your message · ${SITE_NAME}`,
  displayName: 'Contact — guest confirmation',
  previewData: { name: 'Amani', message: 'Looking to book a quiet weekend for two in late June.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 'normal', color: '#2d3a2e', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 18px' }
const quoteBox = { backgroundColor: '#f5f1ea', padding: '16px 18px', borderLeft: '3px solid #b8654c', margin: '20px 0' }
const quoteLabel = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#8a8a8a', margin: '0 0 6px' }
const quoteText = { fontSize: '14px', color: '#3a3a3a', fontStyle: 'italic' as const, margin: 0, lineHeight: '1.5' }
const hr = { borderColor: '#e5e0d6', margin: '28px 0 18px' }
const footer = { fontSize: '13px', color: '#7a7a7a', margin: 0 }