#!/usr/bin/env python3
"""Validate basic structure/frontmatter of the YourCustomWaifu agent pack."""
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[2]
AGENTS = ROOT / ".agents"
errors = []
required = [
    ROOT / "AGENTS.md",
    AGENTS / "README.md",
    AGENTS / "SOURCES-AND-LICENSES.md",
    AGENTS / "rules" / "00-product-scope.md",
    AGENTS / "skills" / "electron" / "SKILL.md",
    AGENTS / "skills" / "desktop-window-lifecycle" / "SKILL.md",
    AGENTS / "skills" / "vrm-avatar-stage" / "SKILL.md",
]
for p in required:
    if not p.is_file(): errors.append(f"Missing required file: {p.relative_to(ROOT)}")

skills = sorted((AGENTS / "skills").glob("*/SKILL.md")) if (AGENTS / "skills").exists() else []
if not skills: errors.append("No SKILL.md files found")
for p in skills:
    text = p.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        errors.append(f"Missing YAML frontmatter: {p.relative_to(ROOT)}")
        continue
    chunks = text.split("---", 2)
    if len(chunks) < 3:
        errors.append(f"Malformed YAML frontmatter: {p.relative_to(ROOT)}")
        continue
    fm = chunks[1]
    if not re.search(r"(?m)^name:\s*[a-z0-9-]+\s*$", fm):
        errors.append(f"Missing/invalid name metadata: {p.relative_to(ROOT)}")
    if not re.search(r"(?m)^description:\s*.+$", fm):
        errors.append(f"Missing description metadata: {p.relative_to(ROOT)}")

if errors:
    print("AGENT PACK VALIDATION FAILED")
    print("\n".join(f"- {e}" for e in errors))
    sys.exit(1)
print("AGENT PACK VALIDATION PASSED")
print(f"Skills: {len(skills)}")
print(f"Rules: {len(list((AGENTS / 'rules').glob('*.md')))}")
print(f"Agent profiles: {len(list((AGENTS / 'agents').glob('*.md')))}")
print("Note: This validates the agent pack only, not the application.")
