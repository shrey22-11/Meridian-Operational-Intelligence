"""Private loopback-only PostgreSQL cluster. Does not touch the system service."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "stop", "status"], default="start", nargs="?")
    args = parser.parse_args()
    found = shutil.which("pg_ctl")
    candidates = sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin/pg_ctl.exe"), reverse=True)
    binary = Path(found) if found else (candidates[0] if candidates else None)
    if not binary:
        raise SystemExit("Install PostgreSQL or add its bin folder to PATH; Docker Compose is also supported.")
    def run(name, *arguments, check=True):
        exe = binary.parent / (name + (".exe" if os.name == "nt" else ""))
        if name == "pg_ctl" and "start" in arguments:
            # Windows server children can inherit PIPE handles and prevent communicate() returning.
            with (LOCAL / "startup.log").open("a") as log:
                return subprocess.run([str(exe), *map(str, arguments)],check=check,
                                      stdout=log,stderr=log,text=True,timeout=90)
        return subprocess.run([str(exe), *map(str, arguments)], check=check, capture_output=True, text=True)
    cluster = LOCAL / "postgres"
    if args.action != "start":
        result = run("pg_ctl", "-D", cluster, args.action, check=False)
        print(result.stdout or result.stderr)
        return
    LOCAL.mkdir(exist_ok=True)
    if not (cluster / "PG_VERSION").exists():
        if (ROOT / ".env").exists():
            raise SystemExit(".env already exists. Use your configured PostgreSQL, or move .env before creating a private cluster.")
        password = secrets.token_urlsafe(24)
        pwfile = LOCAL / "init-password"
        pwfile.write_text(password, encoding="utf-8")
        try:
            result = run("initdb", "-D", cluster, "-U", "ops_user", "--auth=scram-sha-256",
                         "--pwfile", pwfile, "--encoding=UTF8", "--locale=C")
        finally:
            pwfile.unlink(missing_ok=True)
        with (cluster / "postgresql.conf").open("a") as f:
            f.write("\nlisten_addresses = '127.0.0.1'\nport = 55432\n")
        template = (ROOT / ".env.example").read_text()
        (ROOT / ".env").write_text(template.replace("CHANGE_ME", password), encoding="utf-8")
    import socket
    try:
        with socket.create_connection(("127.0.0.1",55432),timeout=2):
            listening=True
    except OSError:
        listening=False
    if not listening:
        result = run("pg_ctl", "-D", cluster, "-l", LOCAL / "postgres.log", "-w", "start")
        print("PostgreSQL startup complete.")
    from dotenv import dotenv_values
    from sqlalchemy.engine import make_url
    import psycopg
    url = make_url(dotenv_values(ROOT / ".env")["DATABASE_URL"])
    with psycopg.connect(host=url.host, port=url.port, user=url.username, password=url.password,
                        dbname="postgres", autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname=%s", (url.database,)).fetchone()
        if not exists:
            from psycopg import sql
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(url.database)))
    print("Private PostgreSQL ready at 127.0.0.1:55432 (ops_intelligence).")


if __name__ == "__main__":
    main()
