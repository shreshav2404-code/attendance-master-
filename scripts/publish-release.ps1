# Publishes a built APK to the AttendX release server (Azure VM, Caddy serving
# /srv/attendx at https://attendx.centralindia.cloudapp.azure.com).
#
#   .\scripts\publish-release.ps1 -Notes "Timetable scan, new Settings"
#
# Bump the version first (see README "In-App APK Update Flow"). This builds the
# signed APK (scripts\build-release.ps1) unless -SkipBuild is given. The APK goes
# up first and release.json last, so the in-app update button never points at a
# file that isn't there yet.
param(
    [string]$Apk = "android\app\build\outputs\apk\release\app-release.apk",
    [string]$Notes = "",
    # Versions below this are forced to update. Defaults to the current release.json value.
    [string]$MinimumVersion = "",
    [string]$Server = "azureuser@attendx.centralindia.cloudapp.azure.com",
    [string]$Key = "$HOME\.ssh\keshav.pem",
    [string]$BaseUrl = "https://attendx.centralindia.cloudapp.azure.com",
    [string]$RemoteDir = "/srv/attendx",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Invoke-Native([string]$Label, [scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (exit code $LASTEXITCODE)"
    }
}

if (-not $SkipBuild) {
    & "$PSScriptRoot\build-release.ps1"
}

if (-not (Test-Path -LiteralPath $Apk)) {
    throw "APK not found: $Apk. Build it first (see README)."
}

$version = (Get-Content -LiteralPath "app.json" -Raw | ConvertFrom-Json).expo.version
$previous = Get-Content -LiteralPath "release.json" -Raw | ConvertFrom-Json
if (-not $MinimumVersion) {
    $MinimumVersion = $previous.minimumVersion
}
if ($previous.latestVersion -eq $version) {
    Write-Warning "release.json already lists $version. Bump the version first if this is a new build."
}

$apkName = "AttendX-$version.apk"
$sha256 = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    latestVersion  = $version
    minimumVersion = $MinimumVersion
    apkUrl         = "$BaseUrl/$apkName"
    iosStoreUrl    = ""
    notes          = if ($Notes) { "AttendX $version - $Notes" } else { "AttendX $version" }
    publishedAt    = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    sha256         = $sha256
}
$json = ($manifest | ConvertTo-Json) + "`n"
# UTF-8 without a BOM: a BOM breaks JSON parsing in the app.
[IO.File]::WriteAllText((Resolve-Path "release.json"), $json, (New-Object Text.UTF8Encoding $false))

$sshOptions = @("-i", $Key, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")

Write-Output "Uploading $apkName ..."
Invoke-Native "APK upload" { scp @sshOptions $Apk "${Server}:$RemoteDir/$apkName.part" }
Invoke-Native "APK publish" {
    ssh @sshOptions $Server "mv -f '$RemoteDir/$apkName.part' '$RemoteDir/$apkName' && cp -f '$RemoteDir/$apkName' '$RemoteDir/AttendX-latest.apk.part' && mv -f '$RemoteDir/AttendX-latest.apk.part' '$RemoteDir/AttendX-latest.apk'"
}

Write-Output "Uploading release.json ..."
Invoke-Native "Manifest upload" { scp @sshOptions "release.json" "${Server}:$RemoteDir/release.json.part" }
Invoke-Native "Manifest publish" { ssh @sshOptions $Server "mv -f '$RemoteDir/release.json.part' '$RemoteDir/release.json'" }

$live = Invoke-RestMethod -Uri "$BaseUrl/release.json" -Headers @{ "Cache-Control" = "no-cache" }
if ($live.latestVersion -ne $version) {
    throw "Server still reports $($live.latestVersion), expected $version"
}
Write-Output "Published AttendX $version"
Write-Output "  Update manifest: $BaseUrl/release.json"
Write-Output "  Download link:   $BaseUrl/$apkName  (always-latest: $BaseUrl/AttendX-latest.apk)"
