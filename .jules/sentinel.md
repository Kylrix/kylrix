## 2025-05-19 - Timing Attacks in Subscription HMAC Verification
**Vulnerability:** Subscription tier HMAC signatures in `lib/services/internal/subscription-prefs-merge.ts` were verified using standard string equality (`expected === sig`), vulnerable to timing side-channel attacks that leak HMAC bytes incrementally to forge premium entitlements.
**Learning:** `crypto.timingSafeEqual` throws an exception if buffer lengths differ; blindly passing arbitrary-length user input into `timingSafeEqual(Buffer.from(sig), Buffer.from(expected))` can crash or leak length information.
**Prevention:** Pre-hash both user-supplied signatures and expected digests using SHA-256 before invoking `timingSafeEqual(sigHash, expectedHash)`, ensuring identical 32-byte buffers and strictly constant-time verification.

## 2025-05-18 - Markdown Reverse Tabnabbing & Obfuscated Pseudo-Protocol Sanitization
**Vulnerability:** External links rendered in markdown with `target="_blank"` lacked `rel="noopener noreferrer"`, allowing opened tabs to manipulate `window.opener.location` (reverse tabnabbing). Additionally, DOMPurify configuration stripped `target` attributes while post-sanitization regexes only checked exact `javascript:` strings without handling whitespace prefixes (`href=" javascript:"`), `vbscript:`, or `data:text/html`.
**Learning:** Stripping `target` completely broke external links or opened them in-place, while relying on brittle post-processing regexes without proper URI regex structure allowed obfuscated payloads to bypass.
**Prevention:** Configure DOMPurify to allow `target` and `rel`, automatically append `rel="noopener noreferrer"` to any `target="_blank"` link in post-processing, and structure secondary regex sanitizers to handle leading whitespace and multi-protocol URIs.
