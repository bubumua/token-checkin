[CmdletBinding()]
param(
  [string]$EnvFile = ".dev.vars",
  [string]$TargetsFile = "src/targets.json",
  [switch]$LoginIfNeeded,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
  param(
    [string]$RawValue
  )

  $value = $RawValue.Trim()
  if ($value.Length -ge 2) {
    $first = $value[0]
    $last = $value[$value.Length - 1]
    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      return $value.Substring(1, $value.Length - 2)
    }
  }
  return $value
}

function Read-DotEnvFile {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path"
  }

  $values = @{}
  $lines = Get-Content -LiteralPath $Path
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $line = $lines[$index].Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    if ($line.StartsWith("export ")) {
      $line = $line.Substring(7).Trim()
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      throw "Invalid line in $Path at $($index + 1): $line"
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $rawValue = $line.Substring($separatorIndex + 1)
    $values[$name] = Get-DotEnvValue -RawValue $rawValue
  }

  return $values
}

function Get-RequiredSecretNames {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Targets file not found: $Path"
  }

  $targets = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if (-not $targets) {
    throw "No targets found in $Path"
  }

  $names = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($target in $targets) {
    if (-not $target.cookieSecret) {
      throw "Target '$($target.name)' is missing cookieSecret in $Path"
    }
    [void]$names.Add([string]$target.cookieSecret)
  }

  [void]$names.Add("TELEGRAM_BOT_TOKEN")
  [void]$names.Add("TELEGRAM_CHAT_ID")

  return @($names | Sort-Object)
}

function Test-WranglerLogin {
  & npx wrangler whoami *> $null
  return $LASTEXITCODE -eq 0
}

function Assert-WranglerReady {
  if (Test-WranglerLogin) {
    return
  }

  if (-not $LoginIfNeeded) {
    throw "Wrangler is not logged in. Run 'npx wrangler login' first, or rerun this script with -LoginIfNeeded."
  }

  Write-Host "Wrangler is not logged in. Starting 'npx wrangler login'..."
  & npx wrangler login
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler login failed."
  }

  if (-not (Test-WranglerLogin)) {
    throw "Wrangler login did not complete successfully."
  }
}

function Sync-Secret {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($DryRun) {
    Write-Host "[dry-run] Would sync $Name"
    return
  }

  Write-Host "Syncing $Name"
  $Value | & npx wrangler secret put $Name
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to sync secret: $Name"
  }
}

$envValues = Read-DotEnvFile -Path $EnvFile
$requiredSecrets = Get-RequiredSecretNames -Path $TargetsFile

$secretsToSync = New-Object System.Collections.Generic.List[string]
foreach ($secretName in $requiredSecrets) {
  if ($envValues.ContainsKey($secretName)) {
    $value = [string]$envValues[$secretName]
    if ($value.Length -gt 0) {
      [void]$secretsToSync.Add($secretName)
    }
  }
}

if ($secretsToSync.Count -eq 0) {
  throw "No matching secrets found in $EnvFile."
}

$missingSecrets = @()
foreach ($secretName in $requiredSecrets) {
  if (-not $envValues.ContainsKey($secretName) -or [string]::IsNullOrWhiteSpace([string]$envValues[$secretName])) {
    $missingSecrets += $secretName
  }
}

if ($missingSecrets.Count -gt 0) {
  Write-Warning ("Missing secrets in {0}: {1}" -f $EnvFile, ($missingSecrets -join ", "))
}

if (-not $DryRun) {
if (-not $DryRun) {
  Assert-WranglerReady
}
}

foreach ($secretName in $secretsToSync) {
  Sync-Secret -Name $secretName -Value ([string]$envValues[$secretName])
}

Write-Host ("Completed. Synced {0} secrets from {1}." -f $secretsToSync.Count, $EnvFile)
