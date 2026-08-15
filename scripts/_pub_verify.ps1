cd jebi-coffee
Remove-Item scripts/_pub_prep.ps1, scripts/_pub_commit.ps1, scripts/_pub_push.ps1 -Force
git add -A
git commit -m "chore: remove publish helper scripts" 2>&1 | Select-Object -Last 1
git push origin main 2>&1 | Select-Object -Last 2
Write-Host '=== repo view ==='
gh repo view erikcywong/jebi.ai --json name,visibility,url,defaultBranchRef -q '.name + " | " + .visibility + " | " + .url + " | " + .defaultBranchRef.name'
Write-Host '=== file count on remote ==='
(git ls-tree -r --name-only HEAD | Measure-Object -Line).Lines
Write-Host '=== tracked top-level ==='
git ls-tree --name-only HEAD | Sort-Object