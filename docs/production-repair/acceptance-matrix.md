# VICE OS / Acceptance matrix

Every criterion below refers to the supplied release specification. PARTIAL is not acceptance. No real financial test records were created.

| Area | Criterion | Status | Evidence or next verification |
|---|---|---|---|
| Authentication | Valid login works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Authentication | Sessions persist | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Authentication | Logout works | PARTIAL | Behavioral cleanup/failure tests pass; real-token revocation unverified. |
| Authentication | Account recovery works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Messages send | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Messages arrive | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Histories load | PARTIAL | Mocked latest-200 ordering/deduplication/stale-session tests pass; two-account delivery unverified. |
| Communications | Attachments work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Presence updates | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Calls connect | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Calls terminate correctly | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Screen sharing works where supported | NOT IMPLEMENTED | No screen-sharing media path in current implementation. |
| Trading | Charts load genuine provider data | PARTIAL | Proxy and invalid-OHLC tests pass; live provider and instrument coverage unverified. |
| Trading | Zoom works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Trading | Horizontal dragging works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Trading | Vertical dragging works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Trading | SOLACE markers render correctly | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Trading | Signal calculations pass deterministic tests | PARTIAL | Macro structure prefix invariance passes; complete requested signal matrix untested. |
| Holder system | Holder records load | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Holder system | Allocations reconcile | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Holder system | Tier classifications are correct | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Holder system | Permissions are enforced | PARTIAL | RLS enabled and anonymous access denied; complete authenticated role matrix untested. |
| Certificates | Verified allocations trigger eligible issuance | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Certificates | Certificates download | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Certificates | Verification works | PARTIAL | Unknown certificate rejection passed read-only API; legitimate/revoked records untested. |
| Certificates | Duplicate issuance is prevented | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | PDFs load | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | Supported edits save | NOT IMPLEMENTED | No genuine PDF form-edit/version workflow. |
| Documents | Profile autofill works | NOT IMPLEMENTED | No completed profile-driven PDF template workflow. |
| Documents | Downloads work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | Signature requests work | NOT IMPLEMENTED | Typed-name attestation exists; requests/sequence/reminders do not. |
| Documents | Signed documents are retained | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Academy | Courses load | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Academy | Progress persists | PARTIAL | Quiz attempts persist server-side; reading marks remain member-scoped local storage. |
| Academy | Assessments function | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Academy | Eligible completion certificates issue | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | Required RPCs exist | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | RLS tests pass | PARTIAL | Anonymous public API tests and zero public tables without RLS; authenticated role matrix untested. |
| Backend | Storage permissions work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | Realtime permissions work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | Audit logging works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Deployment | Production build succeeds | PASS | Strict public-root packaging and privacy test pass locally. |
| Deployment | All required assets are published | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Deployment | Production version is correct | BASELINE PASS | Live version fetched as 1.3.8.0; repaired asset identity pending publication. |
| Deployment | No critical runtime errors remain | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Deployment | End-to-end smoke tests pass | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
