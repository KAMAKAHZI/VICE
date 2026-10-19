# VICE4X · Mobile navigation and install identity

Release version: `1.3.8.0-IRU-CERTIFICATES`. The existing application and financial records are preserved.

## Repairs and cause

The installed iPhone app used `viewport-fit=cover` with a translucent status bar, but its fixed header remained at `top:0` with a 54-pixel height. Root padding did not move that fixed header. The system clock, signal and battery area therefore occupied the menu's touch region. The new shared header height includes `safe-area-inset-top`; banner, sidebar, main content and toast offsets derive from the same measurement. Side and bottom insets accommodate landscape cutouts and home indicators. Browser-supplied dimensions update on rotation without device-name assumptions.

The menu has a 44×44 minimum touch target, 44-pixel rows, a close backdrop, expanded-state accessibility attributes, keyboard/Escape navigation and inactive hidden items. Rotation to the persistent desktop sidebar and session cleanup remove the mobile backdrop. Reduced-motion preferences disable the drawer transition. Account text truncates within available space. Login, modal, sheet, call, notification and bottom-tab surfaces respect the safe rectangle.

The active manifest embedded a generic V; the alternate manifest referenced PNGs absent from the public package. Both now share one app identity and existing 192/512-pixel maskable PNGs. Safari receives an explicit 180-pixel Apple touch icon; the favicon uses a scalable SVG. All use the exact official in-app emblem path and metallic gold gradient. The emblem fits the maskable safe circle. The deployment whitelist and byte-for-byte production checks include all four icon assets.

Changed source: `index.html`, `vice4x-comms.css`, both manifests, four icons, `scripts/vice-pwa-icons.mjs`, public build whitelist, tests and two acceptance workflows. No database mutation, allocation change or provider purchase is part of this correction.

## Verification

The regression test reproduced the old collision against the previous source: header height was 54 pixels instead of 113 with a 59-pixel inset. Corrected source passed the following cases using Chromium's CSS environment safe-area override:

| Case | CSS viewport | Insets top / bottom / left / right | Result |
|---|---|---|---|
| Small phone | 320×568 | 0 / 0 / 0 / 0 | PASS |
| Classic phone | 375×667 | 20 / 0 / 0 / 0 | PASS |
| Notched phone | 390×844 | 47 / 34 / 0 / 0 | PASS |
| Island phone | 393×852 | 59 / 34 / 0 / 0 | PASS |
| Large phone | 430×932 | 59 / 34 / 0 / 0 | PASS |
| Android-shaped viewport | 412×915 | 28 / 24 / 0 / 0 | PASS |
| Phone landscape | 844×390 | 0 / 21 / 47 / 47 | PASS |
| Tablet portrait | 768×1024 | 24 / 20 / 0 / 0 | PASS |
| Tablet landscape | 1024×768 | 24 / 20 / 0 / 0 | PASS |
| Desktop | 1440×900 | 0 / 0 / 0 / 0 | PASS |

Each case checks safe header/content geometry, navigation, banner dismissal, lower tabs, session cleanup and runtime errors. Mobile tests place an intercepting strip over the status-bar area and verify actual menu/navigation taps. The tablet test also rotates to desktop layout. Fixtures are explicitly in-memory SIM and Supabase requests are blocked; no production records are changed.

Local acceptance: 25 JavaScript suites passed, including 79 Node test cases (79 passed, zero failed/skipped), the existing 12-case System suite and legacy contract gates. The build contains exactly 25 whitelisted files. Existing desktop/mobile browser smoke passed login UI validation, modal/layout, chart dragging, lending form and navigation rendering. Icon and portrait/landscape output were visually inspected.

GitHub acceptance and final production identity will be recorded after release. Publication is not claimed by this candidate report.

## Installation and limits

Reopen the installed app to load the new layout. If an existing iPhone shortcut retains the old icon, remove that shortcut and add the site again from Safari using Share → Add to Home Screen. The service worker does not cache application files. Install-icon refresh timing is controlled by the operating system.

This is browser-emulated responsive acceptance; physical iOS/Android verification remains open. Earlier provider, real-user, TURN/SFU, calendar/Zoom, signing, native trading and on-chain governance limits remain in the [Institutional Core](12-institutional-core.md), [October 18 record](2026-10-18-release.md), [release report](11-release-verification-report.md) and [acceptance matrix](acceptance-matrix.md). No unverified feature becomes accepted because this correction passes.

References: [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) and [Web App Manifest icon masks](https://w3c.github.io/manifest/#icon-masks).
