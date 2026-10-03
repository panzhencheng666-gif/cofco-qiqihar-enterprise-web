# God’s Eye View 免费版

The independent fourth application is built from selected MIT code from Bilawal Sidhu’s [God’s Eye View](https://github.com/bilawalsidhu/gods-eye-view), immutable upstream commit `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`. This free edition is a distinct limited application, not a full upstream deployment. It bundles no upstream local datasets, models, scenes, credentials, servers or settings.

## Build and integration

From repository root:

```sh
npm ci --prefix apps/gods-eye-view --ignore-scripts
node scripts/gods-eye-view-build.mjs
```

The dependency lock is independent. Direct dependencies are Cesium 1.138.0 and esbuild 0.25.12; engine 22.3.0 and widgets 14.3.0 are pinned by overrides to the audited upstream lock versions. No lifecycle script is allowed. The esbuild binary comes from its installed platform optional dependency. `dist/` and `node_modules/` are ignored. The standalone build outputs `apps/gods-eye-view/dist/`; the release controller copies this directory to `/enterprise-portal/depth-7/gods-eye-view/` without overwriting other applications. No root package or lockfile changes are required.

## Behavior and resource ownership

The host shell imports no globe engine. Explicit opening checks `GET /api/v1/session/me` with same-origin credentials and Accept JSON. The API envelope is unwrapped at `.data`; all `CurrentSession` required fields and arrays are checked, with ACTIVE account and employment statuses. The response stays in the shell and is never forwarded. The child independently repeats the same session check before dynamically loading its globe, preventing a direct child URL from bypassing the load gate.

The visible pause control, hiding the page or `pagehide` immediately aborts session checks and synchronously removes the child iframe. Returning requires explicit resume and a fresh session check. A login link opens the existing `/api/v1/session/login` in a separate tab upon user click; no unsupported returnTo override or automatic redirect is used. The child never resumes an aborted setup, aborts pending USGS work, and destroys its application/viewer on hide. The fixed same-origin iframe has `allow-scripts allow-same-origin`; module workers require normal origin access. This is resource isolation, not a security boundary against malicious same-origin scripts. Its tightly audited graph has no cookies, browser storage, identity forwarding or postMessage API.

## Sources and limits

- Default: flat WGS84 ellipsoid with atmosphere, no imagery fetch. It is not relief terrain or recent imagery.
- Optional OpenStreetMap street map, only when selected by the user. Fixed `https://tile.openstreetmap.org/` tiles, normal browser cache and strict-origin-when-cross-origin referrer. No tile prefetch, offline collection, headless map sweeps or bulk download. Contributors credit is visible. The public tile service has no guaranteed availability.
- Optional USGS past-day snapshot using the upstream source and normalizer. Magnitude M2.5+ only; exact event UTC times and fetched UTC time shown. Manual refresh only. Fixed feed endpoint; credential omission, redirects rejected, maximum 2 MiB body and 12-second timeout. Streaming body cancellation handles stalls, limits and page teardown. Failed refresh retains any previous snapshot and labels it stale.
- Local city directory and strict upstream decimal-degree parser. No remote geocoding.

Google/ion imagery, Esri, camera/people tracking, planes/ships, AI/voice, incompatible bundled cables/scenes and all recent-high-resolution imagery promises are absent. A Chinese source/capability panel explains these limits.

## Performance and CSP

CesiumWidget replaces the upstream full Viewer while reusing its pinch control and atmosphere compatibility module. Demand rendering, infinite time-change threshold, <=30 fps target, resolution scale <=1, 64-tile cache, reduced screen-space detail and <=4 requests per server are configured. No polling runs. Heavy code exists only in the frame’s dynamic chunk (about 3.8 MB uncompressed); host graph stays about 3.8 KB including shared helpers. Dist assets total about 13 MiB.

Both documents have scoped CSP meta tags. Host script/style/frame resources are same-origin. Child scripts are same-origin; workers are self/blob; data endpoints are only OSM/USGS plus own assets; no unsafe-eval. Child style attributes need unsafe-inline for Cesium layout. CSP must remain at least this restrictive after release; broader upstream standalone policies must not be copied. Browser acceptance remains required for actual WebGL and CSP runtime compatibility, source availability, navigation, hide teardown and mobile layout.

## Provenance and removal

`vendor/provenance.json` maps immutable SHA256s to preserved upstream paths and commit. The six selected upstream source files and four original legal/source/security documents are copied exactly. `src/viewer.js` is derived from the copied viewer: constructor uses CesiumWidget with free edition resource limits; upstream pinch logic stays intact. Build copies the provenance and upstream notices into the artifact plus Cesium license and third-party notices.

To remove: remove the portal catalogue entry and independently served globe directory, then delete `apps/gods-eye-view`, `scripts/gods-eye-view*.mjs` and this document. Existing three application bundles and dependencies are unaffected.
