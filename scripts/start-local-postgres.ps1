$ErrorActionPreference = "Stop"

$pgBin = [Environment]::GetEnvironmentVariable("RENVIX_LOCAL_PG_BIN", "User")
$pgData = [Environment]::GetEnvironmentVariable("RENVIX_LOCAL_PG_DATA", "User")

if (-not $pgBin) { $pgBin = "C:\RenvixLocal\postgresql\pgsql\bin" }
if (-not $pgData) { $pgData = "C:\RenvixLocal\data" }

$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$logFile = "C:\RenvixLocal\postgresql.log"

if (-not (Test-Path -LiteralPath $pgCtl) -or -not (Test-Path -LiteralPath $pgData)) {
  throw "Local Renvix PostgreSQL files are missing."
}

& $pgCtl -D $pgData status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "Renvix PostgreSQL is already running."
  exit 0
}

& $pgCtl -D $pgData -l $logFile -o '"-p" "55432" "-h" "127.0.0.1"' -w start
if ($LASTEXITCODE -ne 0) { throw "Renvix PostgreSQL failed to start." }

Write-Output "Renvix PostgreSQL started on 127.0.0.1:55432."
