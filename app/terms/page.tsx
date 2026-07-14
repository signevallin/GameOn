import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Rivalry.',
};

export default function TermsPage() {
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
              Rival<span style={{ color: '#7CBDD4' }}>ry</span>
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 14, color: '#4A6580', marginBottom: 56 }}>
          Last updated: June 3, 2026
        </p>

        <Section title="1. About the Service">
          <P>Rivalry is a web-based platform for creating and running team-based competitions and games at events. The service is provided by Rivalry ("we", "us"). By creating an account or using the service, you accept these terms.</P>
        </Section>

        <Section title="2. Account and Access">
          <P>You must be at least 18 years old to create an account. You are responsible for keeping your login credentials confidential and for all activity that occurs under your account. Contact us immediately if you suspect unauthorised access.</P>
          <P style={{ marginTop: 12 }}>Players (participants in a game) do not need an account — they join using a game key provided by the organiser.</P>
        </Section>

        <Section title="3. Subscriptions and Payment">
          <P>Rivalry offers a free Starter plan and paid plans (Pro and Studio). Paid plans are billed in advance on a monthly or annual cycle, as chosen at checkout, and renew automatically until cancelled. You can cancel anytime from the billing portal; access continues until the end of the paid period. Prices are in SEK and include VAT.</P>
          <P style={{ marginTop: 12 }}>Payments are handled by Stripe. We do not store card details. If a payment fails, we will retry for up to 7 days before downgrading the subscription to the Starter plan.</P>
        </Section>

        <Section title="4. Right of Withdrawal and Refunds">
          <P>As a consumer you have a 14-day right of withdrawal from the date of purchase, provided you have not started using the paid features. Contact us at <A href="mailto:hello@rivalry.se">hello@rivalry.se</A> to exercise this right.</P>
          <P style={{ marginTop: 12 }}>Beyond the statutory right of withdrawal, we do not offer refunds for a subscription period that has already started.</P>
        </Section>

        <Section title="5. Cancellation">
          <P>You may cancel your subscription at any time from your account. Upon cancellation, access to paid features continues until the end of the current billing period, after which the account is automatically downgraded to the Starter plan.</P>
          <P style={{ marginTop: 12 }}>We reserve the right to suspend or delete accounts that violate these terms, without prior notice in cases of serious violations.</P>
        </Section>

        <Section title="6. User-Generated Content">
          <P>You and your players may upload content (images, team names, answers) during games. You are responsible for ensuring that the content does not:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li>violate any law or third-party rights (copyright, trademarks, privacy),</Li>
            <Li>contain offensive, discriminatory, or illegal material,</Li>
            <Li>constitute spam or marketing without our consent.</Li>
          </ul>
          <P style={{ marginTop: 16 }}>Photos that are uploaded are automatically deleted 30 days after the game ends. You grant us a non-exclusive licence to store and display the content in order to provide the service.</P>
        </Section>

        <Section title="7. Acceptable Use">
          <P>It is prohibited to:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li>use the service to distribute malware or carry out attacks,</Li>
            <Li>attempt to breach systems or circumvent security measures,</Li>
            <Li>create accounts using automated methods (bots),</Li>
            <Li>abuse APIs or place unnecessary load on the service,</Li>
            <Li>resell access to the service without written permission.</Li>
          </ul>
        </Section>

        <Section title="8. Availability and Changes">
          <P>We strive for high availability but do not guarantee uninterrupted operation. We reserve the right to modify, restrict, or discontinue parts of the service with 30 days' notice, except in cases of security issues requiring immediate action.</P>
          <P style={{ marginTop: 12 }}>These terms may be updated. Material changes will be communicated by email at least 14 days in advance. Continued use constitutes acceptance of the updated terms.</P>
        </Section>

        <Section title="9. Limitation of Liability">
          <P>The service is provided "as is". To the extent permitted by law, we are not liable for indirect damages, lost profits, or data loss resulting from use of or interruptions to the service.</P>
          <P style={{ marginTop: 12 }}>Our total liability to you will never exceed the amount you have paid for the service during the 12 months preceding the event giving rise to the claim.</P>
        </Section>

        <Section title="10. Governing Law and Disputes">
          <P>These terms are governed by Swedish law. Disputes shall in the first instance be resolved through negotiation. If the parties cannot reach a resolution, the dispute will be settled by a general court with Stockholm District Court as the court of first instance.</P>
          <P style={{ marginTop: 12 }}>As a consumer you also have the right to contact the <A href="https://www.arn.se" target="_blank" rel="noopener">Swedish National Board for Consumer Disputes (ARN)</A> or use the European Commission's <A href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">Online Dispute Resolution (ODR) platform</A>.</P>
        </Section>

        <Section title="11. Business Customers (B2B Addendum)">
          <P>When you use Rivalry on behalf of a company or other organisation, the following applies in addition to — and where conflicting, instead of — the sections above:</P>
          <ul style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Li><strong>No consumer rights:</strong> the 14-day right of withdrawal in Section 4 and the consumer dispute options in Section 10 (ARN/ODR) apply to consumers only and do not apply to business customers.</Li>
            <Li><strong>Authority:</strong> you confirm that you are authorised to bind the organisation to these terms.</Li>
            <Li><strong>Data processing:</strong> our <Link href="/dpa" style={{ color: '#7CBDD4', textDecoration: 'underline', textUnderlineOffset: 3 }}>Data Processing Agreement</Link> (GDPR Art. 28) forms part of these terms and governs our processing of your players&apos; personal data on your behalf.</Li>
            <Li><strong>Liability:</strong> the limitation in Section 9 applies. Neither party&apos;s liability is limited in cases of intent or gross negligence.</Li>
            <Li><strong>Invoicing:</strong> paid plans are charged by card via Stripe. Invoice payment can be arranged for annual Studio subscriptions — contact <A href="mailto:hello@rivalry.se">hello@rivalry.se</A>.</Li>
          </ul>
        </Section>

        <Section title="12. Contact">
          <P>Questions about these terms can be sent to <A href="mailto:hello@rivalry.se">hello@rivalry.se</A>.</P>
        </Section>

        {/* Footer nav */}
        <div style={{ marginTop: 72, paddingTop: 32, borderTop: '1px solid rgba(124,189,212,0.1)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ fontSize: 14, fontWeight: 600, color: '#8FA8C0', textDecoration: 'none' }}>Privacy Policy →</Link>
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
