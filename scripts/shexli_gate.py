"""Run shexli on each target and fail unless every report is clean.

shexli always exits 0, so the gate reads its JSON report (stable field
names) instead of matching the human-readable summary line.

Usage: python3 scripts/shexli_gate.py <extension-dir-or-zip> [...]
"""

import json
import os
import subprocess
import sys


def check(target: str) -> bool:
    path = os.path.abspath(target)  # shexli needs an absolute path
    result = subprocess.run(
        ["shexli", "--format", "json", path],
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    summary = report["summary"]
    findings = report["findings"]
    for finding in findings:
        print(json.dumps(finding, indent=2))
    clean = summary["status"] == "clean" and summary["finding_count"] == 0 and not findings
    print(f"shexli {path}: status={summary['status']} findings={summary['finding_count']}")
    return clean


def main(targets: list[str]) -> int:
    if not targets:
        print(__doc__, file=sys.stderr)
        return 2
    results = [check(target) for target in targets]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
