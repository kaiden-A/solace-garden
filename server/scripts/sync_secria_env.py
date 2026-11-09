"""Fetch one Secria environment and write it as a deployable env snapshot.

The snapshot is written as JSON, which is valid YAML for
``gcloud run deploy --env-vars-file``. Values are never printed and the file is
created with owner-only permissions.

Environment variables:
    SECRIA_API_URL          Base URL of the Secria API.
    SECRIA_TOKEN            Read-only service token.
    SECRIA_ENV_FILE         Output path (default: /tmp/secria-env.yaml).
    SECRIA_EXPECT_PROJECT   Optional expected project slug.
    SECRIA_EXPECT_ENV       Optional expected environment slug.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import httpx

ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PLATFORM_KEYS = {"PORT", "K_SERVICE", "K_REVISION", "K_CONFIGURATION"}


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required.")
    return value


def _fail(response: httpx.Response, action: str) -> None:
    try:
        body = response.json()
    except ValueError:
        body = {}
    detail = body.get("error") if isinstance(body, dict) else None
    raise SystemExit(f"{action} failed: HTTP {response.status_code}" + (f": {detail}" if detail else "."))


def main() -> int:
    api_url = _required("SECRIA_API_URL").rstrip("/")
    token = _required("SECRIA_TOKEN")
    output = Path(os.getenv("SECRIA_ENV_FILE", "/tmp/secria-env.yaml"))
    expect_project = os.getenv("SECRIA_EXPECT_PROJECT", "").strip()
    expect_env = os.getenv("SECRIA_EXPECT_ENV", "").strip()

    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=api_url, headers=headers, timeout=30.0) as client:
        scope_response = client.get("/api/v1/service-tokens/current")
        if scope_response.status_code >= 400:
            _fail(scope_response, "Reading the service-token scope")
        scope = scope_response.json()
        if not isinstance(scope, dict):
            raise SystemExit("The API returned an invalid service-token scope.")

        project_slug = str(scope.get("projectSlug", ""))
        environment_slug = str(scope.get("environmentSlug", ""))
        if expect_project and project_slug != expect_project:
            raise SystemExit(f"This token is scoped to project {project_slug!r}, not {expect_project!r}.")
        if expect_env and environment_slug != expect_env:
            raise SystemExit(f"This token is scoped to environment {environment_slug!r}, not {expect_env!r}.")

        project_id = scope.get("projectId")
        environment_id = scope.get("environmentId")
        if not project_id or not environment_id:
            raise SystemExit("The service-token scope is missing project or environment ids.")

        response = client.get(
            f"/api/v1/projects/{project_id}/environments/{environment_id}/secrets/download",
            params={"format": "json"},
        )
        if response.status_code >= 400:
            _fail(response, "Downloading the Secria environment")
        payload = response.json()
        if not isinstance(payload, dict):
            raise SystemExit("The API returned an invalid environment snapshot.")

        snapshot: dict[str, str] = {}
        for key, value in payload.items():
            name = str(key)
            if name in PLATFORM_KEYS:
                continue
            if not ENV_NAME.fullmatch(name):
                raise SystemExit(f"Invalid environment variable name: {name!r}.")
            snapshot[name] = str(value)

        if not snapshot:
            raise SystemExit("The Secria environment is empty; refusing to deploy it.")

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(snapshot, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        os.chmod(output, 0o600)

    print(
        f"Wrote {len(snapshot)} keys from "
        f"{scope.get('workspaceSlug')}/{project_slug}/{environment_slug} "
        f"to {output}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
