# Security Policy (SECURITY.md)

We take the security of the SOLPredict decentralized prediction market seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

---

## 🛡️ Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately by sending an email to:
*   **Email**: `security@solpredict.io` (Recommended contact)

Please include the following details in your report:
*   A descriptive title and summary of the potential vulnerability.
*   Step-by-step instructions (or a Proof of Concept script) to reproduce the issue.
*   An assessment of the potential impact (e.g. loss of funds, unauthorized admin configuration changes, denial of service).

We will acknowledge receipt of your report within **24 hours** and work diligently to release a patched version as quickly as possible.

---

## 🔒 Current Security Audit Status

A baseline security scan was performed on the codebase:
1.  **Exposed Keys**: 0 active private keys, authority keypairs, or admin secrets are stored in this repository. All private keys are gitignored or loaded at runtime via standard Node.js/Next.js environment variables.
2.  **Solana Smart Contract Math**: Hardened to prevent integer overflow and underflow attacks, specifically verified via integration test suites (`Fractional Refund Math bug validation`).
3.  **Dependencies Scan**: Running `npm audit` identifies common downstream vulnerabilities in Solana wallet adapters (e.g. `@solana/web3.js` legacy versions or `@reown/appkit` WebSockets packages). These are sandboxed browser dependencies and do not impact smart contract execution safety.
