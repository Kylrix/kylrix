## 2025-05-22 - Timing Attacks in Personal Access Token (PAT) Verification
**Vulnerability:** In `lib/services/pats.ts`, `PatService.verifyBearer` compared computed token hashes against stored database hashes using standard string equality (`hash !== row.key`), introducing timing side-channels that leak byte matching progress during token authentication.
**Learning:** Even when hashing raw tokens with SHA-256 before database lookup, evaluating the final hash match via `===` or `!==` leaks timing information byte-by-byte.
**Prevention:** Pre-hash both the computed SHA-256 token hash and the stored key with SHA-256 into uniform 32-byte buffers and compare using `timingSafeEqual(suppliedBuf, expectedBuf)`.

## 2025-05-21 - Timing Attack in Viewer Token Signature Verification
**Vulnerability:** In `lib/actions/secure-ops/shared.ts`, `isViewerTokenValid` compared computed HMAC signatures against user-provided token signatures using standard string equality (`signViewerToken(payload) === parts[2]`), vulnerable to timing side-channel attacks that leak byte-by-byte match progress.
**Learning:** Comparing cryptographic HMAC signatures directly with string equality or uneven buffers creates measurable timing differences that attackers can exploit to forge valid tokens.
**Prevention:** Always pre-hash both the computed HMAC signature and the presented token signature with SHA-256 before comparing them with `timingSafeEqual(expectedHash, suppliedHash)` inside a defensive try/catch block.

## 2025-05-20 - Timing Side-Channels in Passkey Challenge Token Verification
**Vulnerability:** In `lib/actions/auth-actions.ts`, passkey WebAuthn challenge tokens were verified by comparing user-supplied HMAC signatures against expected HMAC digests using an initial buffer length check (`sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)`). An unequal buffer length triggered an immediate early return, leaking HMAC length information and introducing measurable timing differences that could facilitate timing side-channel attacks.
**Learning:** Checking buffer lengths prior to `timingSafeEqual` prevents crashes when lengths differ, but the length comparison itself leaks timing and structural details about the expected signature.
**Prevention:** Always pre-hash both the user-supplied signature and the computed expected digest using SHA-256 (`createHash('sha256')`) prior to `timingSafeEqual(sigHash, expectedHash)`. This guarantees uniform 32-byte buffers, avoids early returns, and eliminates timing side channels.

## 2025-05-19 - Timing Attacks in Subscription HMAC Verification
**Vulnerability:** Subscription tier HMAC signatures in `lib/services/internal/subscription-prefs-merge.ts` were verified using standard string equality (`expected === sig`), vulnerable to timing side-channel attacks that leak HMAC bytes incrementally to forge premium entitlements.
**Learning:** `crypto.timingSafeEqual` throws an exception if buffer lengths differ; blindly passing arbitrary-length user input into `timingSafeEqual(Buffer.from(sig), Buffer.from(expected))` can crash or leak length information.
**Prevention:** Pre-hash both user-supplied signatures and expected digests using SHA-256 before invoking `timingSafeEqual(sigHash, expectedHash)`, ensuring identical 32-byte buffers and strictly constant-time verification.

## 2025-05-18 - Markdown Reverse Tabnabbing & Obfuscated Pseudo-Protocol Sanitization
**Vulnerability:** External links rendered in markdown with `target="_blank"` lacked `rel="noopener noreferrer"`, allowing opened tabs to manipulate `window.opener.location` (reverse tabnabbing). Additionally, DOMPurify configuration stripped `target` attributes while post-sanitization regexes only checked exact `javascript:` strings without handling whitespace prefixes (`href=" javascript:"`), `vbscript:`, or `data:text/html`.
**Learning:** Stripping `target` completely broke external links or opened them in-place, while relying on brittle post-processing regexes without proper URI regex structure allowed obfuscated payloads to bypass.
**Prevention:** Configure DOMPurify to allow `target` and `rel`, automatically append `rel="noopener noreferrer"` to any `target="_blank"` link in post-processing, and structure secondary regex sanitizers to handle leading whitespace and multi-protocol URIs.
