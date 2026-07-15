$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:4100"
$healthUrl = "$url/api/workspace"

function Test-StoryStudio {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match '"project"'
  } catch {
    return $false
  }
}

try {
  if (-not (Test-StoryStudio)) {
    $npm = Get-Command npm.cmd -ErrorAction Stop
    $logDir = Join-Path $projectDir "data\launcher-logs"
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $stdout = Join-Path $logDir "story-studio.out.log"
    $stderr = Join-Path $logDir "story-studio.err.log"
    Start-Process -FilePath $npm.Source -ArgumentList @("run", "dev", "--", "-p", "4100") -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null

    $ready = $false
    foreach ($attempt in 1..90) {
      Start-Sleep -Milliseconds 500
      if (Test-StoryStudio) { $ready = $true; break }
    }
    if (-not $ready) {
      $details = if (Test-Path $stderr) { (Get-Content $stderr -Tail 12) -join "`n" } else { "No error log was created." }
      throw "Story Studio did not start within 45 seconds.`n`n$details`n`nLog: $stderr"
    }
  }

  Start-Process $url
} catch {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($_.Exception.Message, "Story Studio startup failed", "OK", "Error") | Out-Null
  exit 1
}
