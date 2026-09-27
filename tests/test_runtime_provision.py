import json
from zipfile import ZipFile

import pytest

from scripts import provision_runtime as runtime


def archive(tmp_path, name="artifacts/forecast.csv", corrupt=False):
    data = b"date,prediction\n2026-01-01,42\n"
    manifest = {"version": runtime.VERSION, "source": "synthetic", "files": {
        name: {"bytes": len(data), "sha256": "bad" if corrupt else runtime.digest(data)}
    }}
    path = tmp_path / "runtime.zip"
    with ZipFile(path, "w") as zipped:
        zipped.writestr(name, data)
        zipped.writestr("runtime-manifest.json", json.dumps(manifest))
    return path, runtime.digest(path.read_bytes()), data


def test_layout_and_idempotence(tmp_path):
    path, sha, data = archive(tmp_path)
    destination = tmp_path / "app"
    assert runtime.materialize(path, destination, sha) == 1
    assert runtime.materialize(path, destination, sha) == 1
    assert (destination / "artifacts/forecast.csv").read_bytes() == data
    assert (destination / "runtime-manifest.json").is_file()


def test_bad_archive_hash_writes_nothing(tmp_path):
    path, _, _ = archive(tmp_path)
    with pytest.raises(ValueError, match="SHA256"):
        runtime.materialize(path, tmp_path / "app", "wrong")
    assert not (tmp_path / "app").exists()


def test_bad_file_hash_writes_nothing(tmp_path):
    path, sha, _ = archive(tmp_path, corrupt=True)
    with pytest.raises(ValueError, match="checksum"):
        runtime.materialize(path, tmp_path / "app", sha)
    assert not (tmp_path / "app").exists()


@pytest.mark.parametrize("name", ["artifacts/../../escape", "backend/app/main.py", "artifacts/..\\escape", "artifacts/C:escape"])
def test_rejects_unsafe_paths(tmp_path, name):
    path, sha, _ = archive(tmp_path, name)
    with pytest.raises(ValueError, match="Unsafe|manifest paths differ"):
        runtime.materialize(path, tmp_path / "app", sha)
    assert not (tmp_path / "app").exists()


def test_preserves_different_local_files(tmp_path):
    path, sha, _ = archive(tmp_path)
    destination = tmp_path / "app"
    target = destination / "artifacts/forecast.csv"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"existing local output")
    with pytest.raises(ValueError, match="overwrite"):
        runtime.materialize(path, destination, sha)
    assert target.read_bytes() == b"existing local output"
    assert not (destination / "runtime-manifest.json").exists()


def test_network_failure_is_not_silently_ignored(tmp_path, monkeypatch):
    def unavailable(*args, **kwargs):
        raise TimeoutError("unavailable")
    monkeypatch.setattr(runtime, "urlopen", unavailable)
    with pytest.raises(TimeoutError):
        runtime.provision(tmp_path / "app")
    assert not (tmp_path / "app").exists()
