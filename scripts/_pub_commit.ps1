cd jebi-coffee
git config core.autocrlf false
git add -A
git -c user.name=erikcywong -c user.email=erik.cywong@outlook.com commit -m "JEBI - AI-native coffee platform: trilingual website, Jebi Brain API, Solidity contracts" 2>&1 | Select-Object -Last 3
Write-Host '=== log ==='
git log --oneline -1
git status -s | Select-Object -First 5