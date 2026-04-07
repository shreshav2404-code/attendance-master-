param(
    [string]$ManifestUrl = "https://jsonblob.com/api/jsonBlob/019d6935-fb93-7d94-bda3-513846520df6",
    [string]$ReleaseFile = "release.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ReleaseFile)) {
    throw "Release file not found: $ReleaseFile"
}

$payload = Get-Content -LiteralPath $ReleaseFile -Raw

if ([string]::IsNullOrWhiteSpace($payload)) {
    throw "Release file is empty: $ReleaseFile"
}

Invoke-RestMethod `
    -Uri $ManifestUrl `
    -Method Put `
    -Headers @{ "User-Agent" = "AttendX-ReleaseBot/1.0" } `
    -ContentType "application/json" `
    -Body $payload `
    | Out-Null

Write-Output "Release manifest published: $ManifestUrl"
