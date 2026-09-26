---
name: why
description: Core architectural rationale and design philosophy for Kylrix: data sovereignty, E2EE balance, free tier limits, passkeys, Telegram bridges, and zero-trust invariants.
---

# Kylrix Architectural Rationale ("Why")

## 1. Data Sovereignty & Exportability
- All user data is 100% portable with JSON, markdown, and encrypted HTML export capabilities to guarantee users own their data indefinitely.

## 2. Practical UX vs Theoretical Encryption
- Normal notes and non-vault resources use server-side encryption + RLS to enable instant search, real-time collaboration, and mobile sync without key exchange friction.
- Vault credentials and keys use strict client-side zero-knowledge E2EE (Argon2id + AES-256-GCM).

## 3. Zero-Support Passkeys & Crypto-Only Billing
- Passkeys are heavily incentivized to eliminate account takeover and forgotten password support friction.
- BlockBee crypto checkout avoids corporate credit card bloat, KYC friction, and chargeback overhead.

## 4. Free Tier Limits & Resource Gates
- Core features are free and unlimited, but capped at 8 collaborators per shared resource to prevent undocumented concurrency bottlenecks on open-source instances.

## 5. Telegram Notification Bridge & Scrapped BYOK
- Telegram push notifications bypass Apple/Google app store fee structures and closed ecosystems.
- Scrapped client BYOK in favor of server-brokered agent execution to maintain zero-trust key isolation.
