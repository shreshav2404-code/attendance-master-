# Builds the release APK signed with AttendX's own key (not the debug key), for
# the update server. Run from the repo root:
#
#   .\scripts\build-release.ps1
#
# The key settings live outside the repo in a properties file (storeFile,
# storePassword, keyAlias, keyPassword); see README "In-App APK Update Flow".
param(
    [string]$KeystoreProperties = "D:\attendx-keys\keystore.properties",
    # arm64 for most phones, armeabi-v7a for 32-bit Android (Go edition) phones.
    [string]$Architectures = "arm64-v8a,armeabi-v7a",
    # This PC's Gradle workarounds (see CLAUDE.local.md); skipped where the folders don't exist.
    [string]$TempDir = "D:\Android\tmp",
    [string]$ProjectCacheDir = "D:\Android\gpc-attendx"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeystoreProperties)) {
    throw "Signing settings not found: $KeystoreProperties"
}
$settings = Get-Content -LiteralPath $KeystoreProperties | Where-Object { $_ -match "^\s*\w+\s*=" }
$missing = @("storeFile", "storePassword", "keyAlias", "keyPassword") | Where-Object {
    $name = $_
    -not ($settings | Where-Object { $_ -match "^\s*$name\s*=\s*\S" })
}
if ($missing) {
    throw "Fill in $($missing -join ', ') in $KeystoreProperties"
}

$gradleArgs = @(
    "assembleRelease",
    "-PreactNativeArchitectures=$Architectures",
    "-PreleaseKeystoreProperties=$KeystoreProperties",
    "--console=plain"
)
if (Test-Path -LiteralPath $TempDir) {
    $env:TMP = $TempDir
    $env:TEMP = $TempDir
}
if ($ProjectCacheDir -and (Test-Path -LiteralPath (Split-Path $ProjectCacheDir))) {
    $gradleArgs += @("--project-cache-dir", $ProjectCacheDir)
}

Push-Location android
try {
    & .\gradlew.bat @gradleArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed (exit code $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

$apk = "android\app\build\outputs\apk\release\app-release.apk"
$sizeMb = [math]::Round((Get-Item -LiteralPath $apk).Length / 1MB, 1)
Write-Output "Built $apk ($sizeMb MB), signed with $KeystoreProperties"
