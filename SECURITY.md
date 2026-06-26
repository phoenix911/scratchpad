# Security Policy

## Supported versions

Scratchpad is a single-binary app; the **latest release** is the supported
version. Please update before reporting an issue.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on the repository. If that isn't available,
open a minimal public issue asking for a private contact channel — without
exploit details.

When reporting, please include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected version / commit
- Any suggested remediation

We'll acknowledge your report, work on a fix, and credit you in the release notes
unless you prefer to remain anonymous.

## Notes for self-hosters

- Set `SCRATCHPAD_PASSWORD` whenever the app is reachable beyond `localhost`.
- Keep `.env` and the SQLite DB **outside** `DATA_DIR` so they're never committed
  to your data repo.
- Share links are intentionally public but unguessable; treat any minted link as
  sensitive and revoke links you no longer need.
- Run behind a TLS-terminating reverse proxy or tunnel; the app sets Secure
  cookies when it sees `X-Forwarded-Proto: https`.
