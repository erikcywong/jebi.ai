$base = 'http://127.0.0.1:8000'
$tests = @(
  @{ n='GET /'; u=$base + '/' },
  @{ n='GET /demo.html'; u=$base + '/demo.html' },
  @{ n='GET /assets/js/i18n-shared.js'; u=$base + '/assets/js/i18n-shared.js' },
  @{ n='GET /assets/css/style.css'; u=$base + '/assets/css/style.css' },
  @{ n='POST topup u_1'; u=$base + '/api/v1/users/u_1/topup'; m='POST'; b='{"user_id":"u_1","amount_jbp":1000}'; h=@{'X-Jebi-User'='u_1'} },
  @{ n='POST topup u_2'; u=$base + '/api/v1/users/u_2/topup'; m='POST'; b='{"user_id":"u_2","amount_jbp":1000}'; h=@{'X-Jebi-User'='u_2'} },
  @{ n='POST recommend lang=en'; u=$base + '/api/v1/recommend/personalized'; m='POST'; b='{"user_id":"u_1","store_id":"s_1","history":["Latte"],"lang":"en"}'; h=@{'X-Jebi-User'='u_1';'X-Jebi-Role'='business'} },
  @{ n='POST recommend lang=ar'; u=$base + '/api/v1/recommend/personalized'; m='POST'; b='{"user_id":"u_2","store_id":"s_1","history":["Latte"],"lang":"ar"}'; h=@{'X-Jebi-User'='u_2';'X-Jebi-Role'='business'} }
)
foreach ($t in $tests) {
  try {
    if ($t.m -eq 'POST') {
      $r = Invoke-RestMethod -Uri $t.u -Method POST -Body ([System.Text.Encoding]::UTF8.GetBytes($t.b)) -ContentType 'application/json' -Headers $t.h -ErrorAction Stop
      $j = $r | ConvertTo-Json -Compress -Depth 4
      $msg = $j.Substring(0, [Math]::Min(170, $j.Length))
    } else {
      $r = Invoke-WebRequest -Uri $t.u -UseBasicParsing -ErrorAction Stop
      $msg = 'HTTP ' + $r.StatusCode + ' len=' + $r.Content.Length
    }
    Write-Host ('PASS  ' + $t.n + '  ' + $msg)
  } catch {
    Write-Host ('FAIL  ' + $t.n + '  ' + $_.Exception.Message.Substring(0, [Math]::Min(170, $_.Exception.Message.Length)))
  }
}