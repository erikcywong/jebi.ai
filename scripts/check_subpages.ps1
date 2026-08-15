$base = 'http://127.0.0.1:8090'
$pages = @('index.html','franchise.html','demo.html','architecture.html','concept.html','token-economy.html','revenue.html','roadmap.html','compliance.html','franchise-models.html','ai-services.html','daily-sop.html','data-rewards.html','faq.html','system-layers.html','api-routes.html','smart-contracts.html','data-flow.html','price-quote.html','ai-recommendation.html','usage-audit.html','contact.html')
$fail = 0
foreach ($p in $pages) {
  try {
    $r = Invoke-WebRequest -Uri ($base + '/' + $p) -UseBasicParsing -TimeoutSec 8
    if ($r.StatusCode -ne 200 -or $r.Content.Length -lt 2000) { $fail++ }
    Write-Host ('PASS  ' + $p + '  len=' + $r.Content.Length)
  } catch { $fail++; Write-Host ('FAIL  ' + $p) }
}
Write-Host ('=== fail: ' + $fail + '/' + $pages.Count)