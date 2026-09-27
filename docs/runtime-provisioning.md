# Preview runtime artifacts

Vercel runs `python -m scripts.provision_runtime` after dependency installation,
before bundling FastAPI. It downloads the existing synthetic runtime archive from
[release v1.0.0-free-cloud](https://github.com/shrey22-11/Meridian-Operational-Intelligence/releases/tag/v1.0.0-free-cloud).

- Asset: `meridian-runtime-2025-12-31-ad80d4556622.zip`
- SHA256: `117fdb0d8024a48f2511d811f7fb82070cd419776d04d048d4d4b5c96928c6a7`
- The archive checksum, embedded manifest, individual file checksums and paths
  are validated before materialization. Download or validation failures fail the build.
- Original paths are retained: `artifacts/`, `reports/statistics.json`,
  `data/exports/`, `data/curated/quality_report.json`, and `runtime-manifest.json`.
- The temporary archive is outside the application tree; generated files remain
  ignored by Git. Existing different local files are never overwritten.
- Vercel bundles these files with the function. Cold starts require neither
  downloading artifacts nor persistent writable storage.
- No training, ETL, database writes, AI configuration changes, or credentials are
  involved. Local development commands remain unchanged.

Do not run bootstrap to resolve missing files in Preview. Check the build log for
the verified provision message. If the release becomes unavailable, new builds
fail; deployments already containing the files remain self-contained. A future
artifact version requires explicitly reviewing and updating the pinned URL/hash.
