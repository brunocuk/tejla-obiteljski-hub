import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Potvrdi promjenu e-mail adrese za {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potvrdi promjenu e-mail adrese</Heading>
        <Text style={text}>
          Zatražio/la si promjenu e-mail adrese za {siteName} s{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          na{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Klikni na gumb ispod za potvrdu promjene:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Potvrdi promjenu
        </Button>
        <Text style={footer}>
          Ako nisi zatražio/la ovu promjenu, odmah osiguraj svoj račun.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#7C5CFF', textDecoration: 'underline' }
const button = {
  backgroundColor: '#7C5CFF',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
