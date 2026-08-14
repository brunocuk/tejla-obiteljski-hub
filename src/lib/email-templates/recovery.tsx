import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Ponovno postavi lozinku za {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ponovno postavljanje lozinke</Heading>
        <Text style={text}>
          Zaprimili smo zahtjev za promjenu lozinke za {siteName}. Klikni na gumb ispod i postavi novu lozinku.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Postavi novu lozinku
        </Button>
        <Text style={footer}>
          Ako nisi zatražio/la promjenu lozinke, zanemari ovu poruku — lozinka ostaje nepromijenjena.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#7C5CFF',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
