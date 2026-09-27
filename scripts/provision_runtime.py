"""Restore the pinned, existing synthetic runtime release during Vercel build.

No database access, training, credentials, or runtime network dependency.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tempfile
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2025-12-31-ad80d4556622"
URL = (
    "https://github.com/shrey22-11/Meridian-Operational-Intelligence/"
    "releases/download/v1.0.0-free-cloud/"
    f"meridian-runtime-{VERSION}.zip"
)
SHA256 = "117fdb0d8024a48f2511d811f7fb82070cd419776d04d048d4d4b5c96928c6a7"
MAX_DOWNLOAD = 20 * 1024 * 1024
MAX_EXPANDED = 60 * 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def materialize(archive: Path, destination: Path, expected_sha: str = SHA256) -> int:
    """Validate the entire release before writing; reject conflicting local files."""
    if archive.stat().st_size > MAX_DOWNLOAD or digest(archive.read_bytes()) != expected_sha:
        raise ValueError("Runtime archive SHA256/size verification failed")
    destination = destination.resolve()
    with ZipFile(archive) as zipped:
        names = zipped.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive paths")
        if sum(info.file_size for info in zipped.infolist()) > MAX_EXPANDED:
            raise ValueError("Runtime archive expanded size exceeded")
        manifest_bytes = zipped.read("runtime-manifest.json")
        manifest = json.loads(manifest_bytes)
        if manifest["version"] != VERSION or manifest["source"] != "synthetic":
            raise ValueError("Unexpected runtime version/source")
        if set(names) != set(manifest["files"]) | {"runtime-manifest.json"}:
            raise ValueError("Archive and manifest paths differ")
        payload = {"runtime-manifest.json": manifest_bytes}
        for name, metadata in manifest["files"].items():
            path = PurePosixPath(name)
            allowed = (
                name.startswith(("artifacts/", "data/exports/"))
                or name in {"reports/statistics.json", "data/curated/quality_report.json"}
            )
            if not allowed or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                raise ValueError("Unsafe runtime archive path")
            data = zipped.read(name)
            if len(data) != metadata["bytes"] or digest(data) != metadata["sha256"]:
                raise ValueError("Runtime file checksum mismatch")
            payload[name] = data
        for name, data in payload.items():
            target = (destination / name).resolve()
            if not target.is_relative_to(destination):
                raise ValueError("Runtime path escapes destination")
            if target.exists() and (not target.is_file() or target.read_bytes() != data):
                raise ValueError(f"Refusing to overwrite different existing runtime file: {name}")
        for name, data in payload.items():
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(data)
    return len(manifest["files"])


def provision(destination: Path = ROOT) -> int:
    # Keep the ZIP outside the application tree so Vercel does not bundle it too.
    with tempfile.TemporaryDirectory(prefix="meridian-runtime-") as temporary:
        archive = Path(temporary) / "runtime.zip"
        with urlopen(URL, timeout=60) as response, archive.open("wb") as output:
            total = 0
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_DOWNLOAD:
                    raise ValueError("Runtime download size exceeded")
                output.write(chunk)
        count = materialize(archive, destination)
    print(f"Verified and provisioned {count} synthetic runtime files; version={VERSION}; sha256={SHA256}")
    return count


if __name__ == "__main__":
    provision()
