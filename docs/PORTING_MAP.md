# GeloTech desktop-to-web port map

The source of truth for desktop capabilities is the private [GeloTech-Tool](https://github.com/usermalik5/GeloTech-Tool) project documentation and implementation. Its current Android workflows rely on Windows/PySide6 plus ADB, Fastboot, drivers and native utilities; the iOS side relies on Windows command-line tools and local IPSW files. This project is an independent browser client and Cloudflare API, not a line-by-line UI rewrite.

## Browser release 0.1

| Capability | Web behavior | Status |
|---|---|---|
| Responsive dashboard and appearance | Live repair counts; light/dark mode; narrow-screen navigation | Implemented |
| Device connection check | Permission-based USB manufacturer/product descriptors where WebUSB is supported | Implemented; does not inspect Android/iOS system state |
| Technician preparation | Local checklist for authorization, backup, visible condition and power/cable checks | Implemented; no device changes |
| Repair records | Owner-scoped, server-validated notes in Cloudflare D1 | Implemented |
| Firmware integrity | Local streaming SHA-256 and optional comparison against a trusted value | Implemented; file remains in browser memory |
| Feature controls | Owner switches; repair-record access is checked by the Worker. USB and file checks are local browser tools, so their switches only control the screen. | Implemented |

## Port later, with a real browser-compatible design

- Device status, battery/storage information and operation journals need a reviewed transport bridge or companion app. A web page must not claim it reads these from USB descriptors.
- Compatibility matrix, troubleshooting guidance, recovery guides, technician reports, searchable history and workflow templates can be web-native after their data contracts are defined.
- Firmware catalog/search can connect to the free-link scraper data after source freshness, link safety, and download policy are agreed. This first release only checks a file selected by the technician.
- Team accounts, roles, invitations, and recovery need a deliberate identity and account-recovery design. This first release is deliberately owner-only.

## Keep on the supported desktop app

- ADB/Fastboot commands; APK install, backup/restore, package removal, repair authorization, scrcpy, device file management, driver operations, and native USB monitoring.
- Chipset flashing, bootloader actions, Android recovery transitions, and workflows that can erase/change device state.
- iOS device-mode detection, IPSW restore execution, Recovery/DFU transport and native driver/tool installation.

These need local native device access and must keep the desktop app's captured-device identity, preflight, confirmation, operation journal and post-action verification safety gates. A browser-only control that only looks like a working native action would mislead technicians and create risk.

## Explicit product safety boundary

The web workspace will not implement FRP/Google-account/MDM bypass, Activation Lock bypass, passcode bypass, baseband/security defeat, credential extraction, or unauthorized tracking. A file hash comparison checks bytes against the value supplied by the technician; it is not a malware scan, authenticity certificate, or device compatibility check.
