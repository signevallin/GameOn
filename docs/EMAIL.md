# Email deliverability (SPF / DKIM / DMARC)

GameOn sends transactional email via **Resend** from `hello@rivalry.se`
(welcome, subscription, payment-failed/dunning). Without domain authentication
these land in spam — which for the payment-failed email means silent churn. Set
this up once on the `rivalry.se` DNS.

## 1. Verify the domain in Resend

Resend dashboard → **Domains → Add Domain → `rivalry.se`**. Resend shows the
exact DNS records to add (values are account-specific — copy them from Resend,
don't hardcode). You'll get:

- an **SPF** record (a `TXT` on the sending subdomain, e.g. `send`)
- a **DKIM** record (a `CNAME`, or a `TXT` with the public key)
- a **MX** record for the sending subdomain (for return-path/bounces)

Add each one at your DNS provider exactly as shown.

## 2. Add a DMARC record

Resend does not create DMARC for you. Add a `TXT` record so receivers know how
to treat mail that fails checks:

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:hello@rivalry.se; fo=1` |

Start with `p=quarantine`. Once you've watched the aggregate (`rua`) reports for
a couple of weeks and confirmed all legitimate mail passes, tighten to
`p=reject`.

## 3. Verify and test

- Wait for Resend to show the domain **Verified** (DNS can take up to a few hours).
- Send a test email (e.g. trigger a Stripe test-mode checkout) and check the
  received message's headers show `spf=pass`, `dkim=pass`, `dmarc=pass`.
- Cross-check with a tool like mail-tester.com (aim for 10/10) or MXToolbox.

## Notes

- Keep a **single** SPF `TXT` record on any given name — multiple SPF records
  are invalid. If you already have one, merge Resend's include into it rather
  than adding a second.
- The `FROM` address is set in `app/api/stripe/webhook/route.ts`
  (`GameOn <hello@rivalry.se>`); keep the domain there in sync with the
  verified Resend domain.
