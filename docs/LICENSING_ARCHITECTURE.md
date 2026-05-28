# Licensing Architecture & Integration Strategy (will not be applied)

This document outlines how Dexta Toolkit implements its **Free / Pro** tier segregation, and how to securely connect online server-verified licenses (like Tebex or custom endpoints) in production builds.

## 1. Visual Integration
The UI displays clear badging:
- **FREE**: Unlocked for all users.
- **PRO**: Advanced utilities (Pack Browser extraction, Dependency scanner, ZIP builds).

For the development/local test builds:
- **Abstraction layer**: Defined in `src/store.ts` inside the Zustand state as `isPro: true` to allow full developer test access to all completed features.
- No insecure client-side bypass checks or hardcoded local keys are implemented.

## 2. Recommended Production License Flow
For distribution, local desktop applications must utilize a **Cryptographically Signed JWT** or **Handshake verification** mechanism. Do NOT perform verification via insecure local state alone.

### Proposed Online Verification Diagram
```
┌──────────────┐             IPC Request             ┌───────────────┐
│              │ ──────────────────────────────────> │               │
│  React App   │                                     │ Tauri Backend │
│              │ <────────────────────────────────── │               │
└──────────────┘             Binds & Claims          └───────┬───────┘
                                                             │
                                                             │ HTTPS Handshake
                                                             ▼
                                                     ┌───────────────┐
                                                     │ Secure Auth   │
                                                     │ API Gateway   │
                                                     └───────┬───────┘
                                                             │
                                                             │ Tebex / License Db
                                                             ▼
                                                     ┌───────────────┐
                                                     │ Validate Keys │
                                                     └───────────────┘
```

### Steps to Implement Security:
1. **Desktop Handshake**: When the user enters their license key in Settings, the Tauri Rust backend performs an HTTPS POST query containing the key, system GUID, and timestamp.
2. **Signed Payload**: The remote server validates the subscription against Tebex or database records, then replies with a cryptographically signed payload containing authorization parameters and a brief expiration timestamp.
3. **Local Decryption**: The Tauri app validates the signature using an embedded public key (assuring it originates from our authentic server), then grants access to Pro features.
4. **Offline Grace Period**: Cache the validated signed payload locally. The app remains authenticated offline for up to 3 days before requiring a renewal check.
