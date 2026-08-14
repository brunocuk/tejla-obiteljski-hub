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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Potvrdi svoju e-mail adresu za {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potvrdi e-mail adresu</Heading>
        <Text style={text}>
          Hvala što si se registrirao/la na{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Potvrdi svoju e-mail adresu (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) klikom na gumb ispod:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Potvrdi e-mail
        </Button>
        <Text style={footer}>
          Ako nisi izradio/la račun, slobodno zanemari ovu poruku.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
