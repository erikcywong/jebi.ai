$base = 'http://127.0.0.1:8000'
$tests = @(
  @{ n='GET / (index.html)'; u=$base + '/' },
  @{ n='GET /demo.html'; u=$base + '/demo.html' },
  @{ n='GET /franchise.html'; u=$base + '/franchise.html' },
  @{ n='GET /architecture.html'; u=$base + '/architecture.html' },
  @{ n='GET /assets/css/style.css'; u=$base + '/assets/css/style.css' },
  @{ n='GET /assets/js/demo.js'; u=$base + '/assets/js/demo.js' },
  @{ n='GET /healthz'; u=$base + '/healthz' },
  @{ n='POST quote business'; u=$base + '/api/v1/billing/quote'; m='POST'; b='{"user_id":"u_1","store_id":"s_1","history":["Latte"]}'; h=@{'X-Jebi-Role'='business'} },
  @{ n='POST recommend bundle(未订阅)'; u=$base + '/api/v1/recommend/personalized'; m='POST'; b='{"user_id":"u_1","store_id":"s_1","history":["Latte"]}'; h=@{'X-Jebi-User'='u_1'} }
)
foreach ($t in $tests) {
  try {
    if ($t.m -eq 'POST') {
      $r = Invoke-RestMethod -Uri $t.u -Method POST -Body $t.b -ContentType 'application/json' -Headers $t.h -ErrorAction Stop
      $j = $r | ConvertTo-Json -Compress -Depth 4
      $msg = $j.Substring(0, [Math]::Min(150, $j.Length))
    } else {
      $r = Invoke-WebRequest -Uri $t.u -UseBasicParsing -ErrorAction Stop
      $msg = 'HTTP ' + $r.StatusCode + ' len=' + $r.Content.Length
    }
    Write-Host ('PASS  ' + $t.n + '  ' + $msg)
  } catch {
    Write-Host ('FAIL  ' + $t.n + '  ' + $_.Exception.Message.Substring(0, [Math]::Min(150, $_.Exception.Message.Length)))
  }
}