cd jebi-coffee
git config core.autocrlf input
if (-not (Test-Path .git)) { git init -b main 2>&1 | Out-Null }
git add -A
Write-Host '=== staged file count ==='
(git diff --cached --name-only | Measure-Object -Line).Lines
Write-Host '=== suspicious files (should be 0) ==='
git diff --cached --name-only | Where-Object { $_ -match '\.venv|node_modules|jebi\.db|\.env$|__pycache__|artifacts|cache|deployment\.json' }
Write-Host '=== top-level staged ==='
git diff --cached --name-only | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique
Write-Host '=== staged bytes ==='
$files = git diff --cached --name-only
$sum = 0
foreach ($f in $files) { $item = Get-Item -LiteralPath $f -ErrorAction SilentlyContinue; if ($item) { $sum += $item.Length } }
Write-Host $sum