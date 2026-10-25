$ErrorActionPreference = 'Continue'
Write-Host '=== YourCustomWaifu post-change checks ==='
$root = (git rev-parse --show-toplevel 2>$null)
if (-not $root) { Write-Error 'Not inside a Git repository.'; exit 1 }
Set-Location $root
$pkgPath = Join-Path $root 'package.json'
if (-not (Test-Path $pkgPath)) {
  Write-Host 'No root package.json; inspect workspace manifests and run the documented project checks manually.'
  exit 0
}
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$scripts = $pkg.scripts
foreach ($name in @('typecheck','lint','test','build')) {
  if ($scripts -and $scripts.PSObject.Properties.Name -contains $name) {
    Write-Host "Run: npm run $name (use the package manager defined by lockfile/project docs)"
  } else {
    Write-Host "Skip: no root '$name' script defined."
  }
}
Write-Host 'This helper reports available checks; it does not execute them.'
