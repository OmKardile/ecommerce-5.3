# Seed image sources — demo assets

Real web imagery gathered from the URLs supplied by the store owner. These are
**temporary/demo assets**: before production, replace with locally licensed or
self-shot originals (drop files into `upload/` and update
`prisma/seed-images.json`, then re-seed).

| Key | File(s) | Source | Notes |
| --- | --- | --- | --- |
| hero | `hero/01.jpg` | Unsplash (via image search, re-hosted) | Owner-specified Unsplash photo `FwcMuEOW3O0` was unreachable (Unsplash blocks automated fetch, 401 BotStopper). Substituted a real, watermark-free Unsplash security-camera photo (3000×2000 → 1920×1280, sky negative space for headline overlay). Swap `hero/01.jpg` to restore the exact original. |
| dome | `dome/01.png`, `dome/02.png` | cpplusworld.com product listings (CP-UNC-DA21L3C-Q2, CP-URC-DC24PL3C) | Official CP Plus product shots, 280×200 (max res the site serves), black background (CP Plus brand style). |
| dome | `dome/03.jpg` | moglix.com product page (Consistent 3MP Wi-Fi dome) | 500×500 white background. |
| bullet | `bullet/01.png`–`bullet/03.png` | cpplusworld.com (CP-UNC-TA21L3C-Q2, CP-UVC-VB24FL3-B, CP-UNC-TA21L6C-Q) | Official CP Plus product shots, 280×200, black background. |
| dvr | `dvr/01.png`, `dvr/02.png` | cpplusworld.com (CP-UVR-0401E1V-I, CP-UVR-0401F1V-I) | Official CP Plus product shots, 280×200, black background. |
| nvr | `nvr/01.jpg` | umart.com.au (TP-Link VIGI NVR1008H-8P) | 378×378 white background (max res available). |
| hdd | `hdd/01.png` | westerndigital.com (WD Purple SATA HDD gallery) | 1280×1280 white background. Page is JS-rendered; captured via headless browser. |
| monitor | `monitor/01.jpg` | peclights.com (Eagle 21.5″ LED FHD CCTV monitor) | 600×600. |
| coax | `coax/01.jpg` | Pexels photo 12266914 | Lifestyle cabling photo, 1200×1800. |
| cat6 | `cat6/01.jpg` | Pexels photo 1054397 | Ethernet patching photo, 1200×1800. |
| connector | `connector/01.jpg` | Pexels photo 4682187 | Patch panel photo, 1600×1065. |
| fiber | `fiber/01.jpg` | Pexels photo 2881233 | Server optics photo, 1600×1065. |
| poe | `poe/01.jpg` | tp-link.com (TL-SL1218MP overview) | 1000×1000 product shot. |

## Known limitations

- cpplusworld.com serves at most **280×200** for product shots (verified on
  listing + detail pages). They are crisp in cards, soft when zoomed on the
  PDP. For production quality, supply higher-resolution shots of the same
  models (or let us substitute licensed distributor imagery).
- CP Plus shots use the brand's **black-background** studio style; TP-Link /
  WD / Eagle shots are white-background. Backgrounds are consistent within
  each brand family.
- Pexels/Unsplash licenses permit commercial use without attribution; retailer
  product shots are demo placeholders only and must be replaced with licensed
  or owned imagery before going live.
