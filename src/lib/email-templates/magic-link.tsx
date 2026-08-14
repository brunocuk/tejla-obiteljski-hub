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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="hr" dir="ltr">
    <Head />
    <Preview>Tvoj link za prijavu u {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Link za prijavu</Heading>
        <Text style={text}>
          Klikni na gumb ispod za prijavu u {siteName}. Link uskoro istječe.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Prijavi se
        </Button>
        <Text style={footer}>
          Ako nisi zatražio/la ovaj link, slobodno zanemari ovu poruku.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
  backgroundColor: '#8D6B78',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
