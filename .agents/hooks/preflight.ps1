$ErrorActionPreference = 'Stop'
Write-Host '=== YourCustomWaifu preflight (read-only) ==='
$root = (git rev-parse --show-toplevel 2>$null)
if (-not $root) { throw 'Not inside a Git repository. No changes made.' }
Set-Location $root
Write-Host "Root: $root"
Write-Host "Branch: $(git branch --show-current)"
Write-Host "HEAD: $(git rev-parse --short HEAD)"
Write-Host '--- Working tree ---'
git status --short
Write-Host '--- Root manifests ---'
Get-ChildItem -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('package.json','pnpm-workspace.yaml','yarn.lock','pnpm-lock.yaml','package-lock.json','AGENTS.md') } | Select-Object Name,Length
Write-Host 'Read-only preflight complete. Review user changes before editing.'
