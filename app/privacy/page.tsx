import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How GameOn handles your personal data.',
};

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0D1520', minHeight: '100vh', color: '#DCE4EE', fontFamily: "'Sora', sans-serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(124,189,212,0.1)', padding: '0 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#7CBDD4,#4890aa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0D1520" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: '#DCE4EE' }}>
              Game<span style={{ color: '#7CBDD4' }}>On</span>
            </span>
          </Link>
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: '#8FA8C0', textDecoration: 'none' }}>
            ← Back
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 40px 120px' }}>

        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7CBDD4', marginBottom: 16 }}>
          Legal
        </p>
        <h1 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 14, color: '#4A6580', marginBottom: 56 }}>
          Last updated: June 3, 2026
        </p>

        <Section title="1. Data Controller">
          <P>GameOn ("we", "us", "our") is the data controller for the personal data described in this policy. Contact us at <A href="mailto:hello@playgameon.app">hello@playgameon.app</A> with any questions.</P>
        </Section>

        <Section title="2. What Data We Collect">
          <P>We collect and process the following categories of personal data:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li><strong>Account data:</strong> email address and password (encrypted) when you create an account.</Li>
            <Li><strong>Game data:</strong> team names, scores, mission answers, and timestamps generated during a game.</Li>
            <Li><strong>Photos:</strong> images uploaded by players as answers to photo missions. These are stored temporarily and automatically deleted 30 days after the game ends.</Li>
            <Li><strong>Payment information:</strong> handled exclusively by Stripe. We never store card details.</Li>
            <Li><strong>Technical data:</strong> IP address, browser type, and usage patterns collected automatically when you use the service.</Li>
          </ul>
        </Section>

        <Section title="3. Legal Basis for Processing">
          <P>We process your personal data on the following legal grounds:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li><strong>Contract (GDPR art. 6.1 b):</strong> processing required to fulfil our agreement with you, such as providing the service.</Li>
            <Li><strong>Legitimate interest (GDPR art. 6.1 f):</strong> security, error tracking, and service improvement.</Li>
            <Li><strong>Consent (GDPR art. 6.1 a):</strong> for analytics and marketing, where you have given your consent.</Li>
          </ul>
        </Section>

        <Section title="4. How Long We Retain Data">
          <P>We retain your data for as long as your account is active. Upon account deletion, personal data is erased within 30 days. Game data not linked to an account is automatically deleted after 90 days. Photos from photo missions are deleted after 30 days.</P>
        </Section>

        <Section title="5. Third Parties and Sub-processors">
          <P>We share data with the following sub-processors to operate the service:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li><strong>Supabase Inc.</strong> (database and file storage) — USA, protected by standard contractual clauses.</Li>
            <Li><strong>Vercel Inc.</strong> (web hosting and CDN) — USA, protected by standard contractual clauses.</Li>
            <Li><strong>Stripe Inc.</strong> (payments) — USA, PCI-DSS certified.</Li>
            <Li><strong>Anthropic PBC</strong> (AI features — the in-app support chat and AI mission/game generation process the text you enter) — USA, protected by standard contractual clauses.</Li>
            <Li><strong>Resend</strong> (transactional email) — processes your email address to send account and subscription messages.</Li>
          </ul>
          <P style={{ marginTop: 16 }}>We never sell your personal data to third parties.</P>
        </Section>

        <Section title="6. Your Rights">
          <P>As a data subject you have the following rights under GDPR:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li><strong>Access:</strong> request a copy of the data we process about you.</Li>
            <Li><strong>Rectification:</strong> request that incorrect data is corrected.</Li>
            <Li><strong>Erasure:</strong> request that your data is deleted ("right to be forgotten").</Li>
            <Li><strong>Data portability:</strong> request your data in a machine-readable format.</Li>
            <Li><strong>Objection:</strong> object to processing based on legitimate interest.</Li>
          </ul>
          <P style={{ marginTop: 16 }}>Account holders can exercise access, portability and erasure directly from the app: your profile menu has <strong>Export my data</strong> (a machine-readable JSON copy of your account) and <strong>Delete account</strong> (permanent erasure of your account and all associated data). For any other request, contact <A href="mailto:hello@playgameon.app">hello@playgameon.app</A>. We will respond within 30 days. You also have the right to lodge a complaint with the <A href="https://www.imy.se" target="_blank" rel="noopener">Swedish Authority for Privacy Protection (IMY)</A>.</P>
        </Section>

        <Section title="7. Cookies">
          <P>We use necessary cookies to keep you logged in and to ensure the service works correctly. If you accept analytics cookies, these are used to understand how the service is used (see section 8). You can clear cookies in your browser at any time.</P>
        </Section>

        <Section title="8. Analytics">
          <P>We use privacy-friendly analytics tools to measure traffic statistics. No personally identifiable data is sent to third parties for this purpose.</P>
        </Section>

        <Section title="9. Security">
          <P>All data is transmitted encrypted over HTTPS. Passwords are stored using bcrypt hashing. We conduct regular security reviews and follow industry standards for data protection.</P>
        </Section>

        <Section title="10. Changes">
          <P>We reserve the right to update this policy. For material changes, you will be notified by email or a prominent notice in the service. Continued use after the notified effective date constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="11. Contact">
          <P>Questions about this privacy policy can be sent to us at <A href="mailto:hello@playgameon.app">hello@playgameon.app</A>.</P>
        </Section>

        {/* Footer nav */}
        <div style={{ marginTop: 72, paddingTop: 32, borderTop: '1px solid rgba(124,189,212,0.1)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/terms" style={{ fontSize: 14, fontWeight: 600, color: '#8FA8C0', textDecoration: 'none' }}>Terms of Service →</Link>
          <Link href="/dpa" style={{ fontSize: 14, fontWeight: 600, color: '#8FA8C0', textDecoration: 'none' }}>Data Processing Agreement →</Link>
          <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: '#4A6580', textDecoration: 'none' }}>Back to home</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#DCE4EE', marginBottom: 14, letterSpacing: '-0.02em' }}>{title}</h2>
      {children}
    </section>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: 15, lineHeight: 1.75, color: '#8FA8C0', ...style }}>{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 15, lineHeight: 1.7, color: '#8FA8C0' }}>{children}</li>;
}

function A({ href, children, target, rel }: { href: string; children: React.ReactNode; target?: string; rel?: string }) {
  return <a href={href} target={target} rel={rel} style={{ color: '#7CBDD4', textDecoration: 'underline', textUnderlineOffset: 3 }}>{children}</a>;
}
