#!/usr/bin/env python3
"""
Emit minified JSON file lists for Supabase MCP `deploy_edge_function` (flat layout).

Output files (gitignored): scripts/edge_mcp_<slug>.json
Run from repo root: python3 scripts/render-edge-mcp-bundles.py
"""
from __future__ import annotations

import json
from pathlib import Path


def bundle_generate_manifest(root: Path) -> list[dict[str, str]]:
    fn_root = root / "supabase/functions"
    idx = (fn_root / "generate-manifest/index.ts").read_text().replace("../_shared/", "./_shared/")
    return [
        {"name": "index.ts", "content": idx},
        {"name": "_shared/ai-gateway.ts", "content": (fn_root / "_shared/ai-gateway.ts").read_text()},
        {"name": "_shared/auth.ts", "content": (fn_root / "_shared/auth.ts").read_text()},
        {"name": "_shared/env.ts", "content": (fn_root / "_shared/env.ts").read_text()},
    ]


def bundle_mcp_server(root: Path) -> list[dict[str, str]]:
    fn_root = root / "supabase/functions"
    idx = (fn_root / "mcp-server/index.ts").read_text()
    idx = idx.replace("../_shared/", "./_shared/").replace("../../../shared/", "./shared/")
    return [
        {"name": "index.ts", "content": idx},
        {"name": "_shared/auth.ts", "content": (fn_root / "_shared/auth.ts").read_text()},
        {"name": "_shared/env.ts", "content": (fn_root / "_shared/env.ts").read_text()},
        {"name": "shared/mission-actions.ts", "content": (root / "shared/mission-actions.ts").read_text()},
    ]


def bundle_agent_action(root: Path) -> list[dict[str, str]]:
    fn_root = root / "supabase/functions"
    idx = (fn_root / "agent-action/index.ts").read_text()
    idx = idx.replace("../_shared/", "./_shared/").replace("../../../shared/", "./shared/")
    pe = (fn_root / "_shared/provider-execution.ts").read_text().replace(
        'from "../../../shared/mission-actions.ts"',
        'from "../shared/mission-actions.ts"',
    )
    return [
        {"name": "index.ts", "content": idx},
        {"name": "_shared/auth.ts", "content": (fn_root / "_shared/auth.ts").read_text()},
        {"name": "_shared/crypto.ts", "content": (fn_root / "_shared/crypto.ts").read_text()},
        {"name": "_shared/env.ts", "content": (fn_root / "_shared/env.ts").read_text()},
        {"name": "_shared/provider-execution.ts", "content": pe},
        {"name": "shared/mission-actions.ts", "content": (root / "shared/mission-actions.ts").read_text()},
    ]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "scripts"
    bundles = {
        "generate_manifest": bundle_generate_manifest(root),
        "mcp_server": bundle_mcp_server(root),
        "agent_action": bundle_agent_action(root),
    }
    for slug, files in bundles.items():
        path = out_dir / f"edge_mcp_{slug}.json"
        path.write_text(json.dumps(files, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
