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
  /** Ime osobe koja poziva; prazno kad metadata nije stigla (fallback na generički tekst). */
  inviterName?: string
  /** Ime obiteljskog prostora u koji se poziva. */
  familyName?: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
  inviterName,
  familyName,
}: InviteEmailProps) => {
  const inviter = (inviterName ?? '').trim()
  const family = (familyName ?? '').trim()
  return (
    <Html lang="hr" dir="ltr">
      <Head />
      <Preview>
        {inviter ? `${inviter} te poziva u ${siteName}` : `Pozvan/a si u ${siteName}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{inviter ? `${inviter} te poziva` : 'Pozvan/a si'}</Heading>
          {inviter ? (
            <Text style={text}>
              Bok! {inviter} te poziva da se pridružiš
              {family ? (
                <>
                  {' '}obiteljskom prostoru <strong>{family}</strong> u aplikaciji{' '}
                </>
              ) : (
                <> obiteljskom prostoru u aplikaciji </>
              )}
              <Link href={siteUrl} style={link}>
                <strong>{siteName}</strong>
              </Link>
              . Klikni na gumb ispod da prihvatiš poziv i postaviš svoj račun.
            </Text>
          ) : (
            <Text style={text}>
              Pozvani ste pridružiti se prostoru{' '}
              <Link href={siteUrl} style={link}>
                <strong>{siteName}</strong>
              </Link>
              . Klikni na gumb ispod da prihvatiš poziv i postaviš svoj račun.
            </Text>
          )}
          <Button style={button} href={confirmationUrl}>
            Prihvati poziv
          </Button>
          <Text style={text}>
            Ako gumb ne radi, otvori ovaj link:
            <br />
            <Link href={confirmationUrl} style={link}>
              {confirmationUrl}
            </Link>
          </Text>
          <Text style={footer}>
            Ako nisi očekivao/la ovaj poziv, slobodno zanemari ovu poruku.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

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
const link = { color: '#8D6B78', textDecoration: 'underline' }
const button = {
  backgroundColor: '#8D6B78',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
