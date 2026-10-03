# Additive static deployment

The fourth application is a separate build. Never deploy the root `dist` as part of this change: the live portal and other applications have independent production updates.

A release contains `manifest.json`, immutable `files/`, `index.before.html`, `index.next.html`, and `static-release.py`. Pin the archive SHA256 before transport. The manifest hashes every file. Build the next portal from freshly observed live bytes, preserving the existing three entries and changing only the catalog/script pointer to immutable new names. Keep before/after entry hashes and the original entry in the deployment receipt.

`static-release.py stage RELEASE_DIRECTORY` takes the existing shared deployment lock and requires the exact live entry hash. It refuses differing existing files and symlink destinations, adds only the fourth application's namespace and immutable portal files, and leaves the live entry unchanged. Open the manifest's `preview` path for authenticated browser acceptance.

`static-release.py promote RELEASE_DIRECTORY` verifies every staged asset and uses compare-and-swap plus atomic replacement for only the portal entry. No backend, gateway, service, data, port, or existing application asset changes.

`static-release.py rollback RELEASE_DIRECTORY` restores only the captured entry if it is still the exact promoted version. It refuses to overwrite later owners' edits. Assets remain inert for recovery; removal must be a separately reviewed manifest-based operation. `verify` checks every staged hash. Local roundtrip, stale-entry and namespace/symlink rejection tests are required before executing a release.

The catalog source has `godsEyeViewEnabled` for build-time removal. Existing app catalog records remain unchanged in source. The deployment catalog must retain the current production records when production and source differ.
