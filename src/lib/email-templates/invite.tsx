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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Pozvan/a si u {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pozvan/a si</Heading>
        <Text style={text}>
          Pozvani ste pridružiti se prostoru{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Klikni na gumb ispod da prihvatiš poziv i postaviš svoj račun.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Prihvati poziv
        </Button>
        <Text style={footer}>
          Ako nisi očekivao/la ovaj poziv, slobodno zanemari ovu poruku.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
