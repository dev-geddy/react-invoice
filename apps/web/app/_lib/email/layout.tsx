import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

/**
 * Shared GitHub-style shell for all transactional emails: neutral grays, system
 * font stack, a bordered white card on a soft canvas. Templates supply a
 * heading, a preview line, body content, and an optional footer note. Inline
 * styles only — the only styling email clients reliably honor.
 *
 * @spec L2-EMAIL-12
 */
export function EmailShell({
  heading,
  preview,
  children,
  footerNote,
}: {
  heading: string
  preview: string
  children: React.ReactNode
  footerNote?: string
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>{heading}</Heading>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>
            {footerNote ??
              "If you weren’t expecting this email, you can safely ignore it."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** Single green primary action, GitHub-flavored. */
export function PrimaryButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Section style={buttonWrap}>
      <Button style={button} href={href}>
        {children}
      </Button>
    </Section>
  )
}

/** Fallback "paste this URL" block, shared by link-bearing emails. */
export function FallbackUrl({ url }: { url: string }) {
  return (
    <>
      <Text style={emailMutedText}>
        If the button above doesn’t work, copy and paste this URL into your
        browser:
      </Text>
      <Link href={url} style={emailLink}>
        {url}
      </Link>
    </>
  )
}

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'

const main: React.CSSProperties = {
  backgroundColor: "#f6f8fa",
  fontFamily: fontStack,
  margin: 0,
  padding: "24px 0",
}

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #d0d7de",
  borderRadius: "6px",
  maxWidth: "544px",
  margin: "0 auto",
  overflow: "hidden",
}

const header: React.CSSProperties = {
  borderBottom: "1px solid #d0d7de",
  padding: "24px 32px",
}

const h1: React.CSSProperties = {
  color: "#1f2328",
  fontSize: "20px",
  fontWeight: 600,
  lineHeight: "1.25",
  margin: 0,
}

const content: React.CSSProperties = {
  padding: "24px 32px 8px",
}

const hr: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #d0d7de",
  margin: "24px 0 0",
}

const footer: React.CSSProperties = {
  color: "#656d76",
  fontSize: "12px",
  lineHeight: "1.5",
  padding: "16px 32px 24px",
  margin: 0,
}

const buttonWrap: React.CSSProperties = {
  padding: "8px 0 20px",
}

const button: React.CSSProperties = {
  backgroundColor: "#1f883d",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "1",
  padding: "12px 20px",
  textDecoration: "none",
}

/** Body copy styles, exported for templates. */
export const emailText: React.CSSProperties = {
  color: "#1f2328",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px",
}

export const emailMutedText: React.CSSProperties = {
  color: "#656d76",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 4px",
}

export const emailLink: React.CSSProperties = {
  color: "#0969da",
  fontSize: "13px",
  textDecoration: "none",
  wordBreak: "break-all",
}
