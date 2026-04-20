/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as contactReceived } from './contact-received.tsx'
import { template as contactAdminAlert } from './contact-admin-alert.tsx'
import { template as bookingInquiryReceived } from './booking-inquiry-received.tsx'
import { template as bookingInquiryAdminAlert } from './booking-inquiry-admin-alert.tsx'
import { template as bookingConfirmation } from './booking-confirmation.tsx'
import { template as bookingDecline } from './booking-decline.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-received': contactReceived,
  'contact-admin-alert': contactAdminAlert,
  'booking-inquiry-received': bookingInquiryReceived,
  'booking-inquiry-admin-alert': bookingInquiryAdminAlert,
  'booking-confirmation': bookingConfirmation,
  'booking-decline': bookingDecline,
}