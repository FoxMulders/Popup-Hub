# Build a debug APK for emulator/device testing.
param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Resolve-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        return $env:JAVA_HOME
    }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Android\Android Studio\jbr'),
        (Join-Path ${env:ProgramFiles} 'Android\Android Studio\jbr'),
        (Join-Path ${env:ProgramFiles(x86)} 'Android\Android Studio\jbr')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate 'bin\java.exe')) {
            return $candidate
        }
    }
    return $null
}

$javaHome = Resolve-JavaHome
if (-not $javaHome) {
    throw 'JAVA_HOME not set. Install Android Studio or set JAVA_HOME to a JDK 17+ path.'
}
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"
Write-Host "JAVA_HOME=$javaHome"

Push-Location $ProjectRoot
try {
    if (-not (Test-Path -LiteralPath 'android\local.properties')) {
        $defaultSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
        if (Test-Path -LiteralPath $defaultSdk) {
            $escaped = $defaultSdk -replace '\\', '\\'
            "sdk.dir=$escaped" | Set-Content -Path 'android\local.properties' -Encoding ASCII
            Write-Host "Wrote android/local.properties -> $defaultSdk"
        } else {
            throw 'Android SDK not found. Install Android Studio and copy android/local.properties.example'
        }
    }

    npm run mobile:sync
    if ($LASTEXITCODE -ne 0) { throw 'mobile:sync failed' }

    Push-Location android
    if ($Install) {
        .\gradlew.bat installDebug
    } else {
        .\gradlew.bat assembleDebug
    }
    if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
    Pop-Location

    $apk = Join-Path $ProjectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (Test-Path -LiteralPath $apk) {
        Write-Host ''
        Write-Host "Debug APK: $apk"
        Write-Host 'Install on a connected device: adb install -r android\app\build\outputs\apk\debug\app-debug.apk'
    }
}
finally {
    Pop-Location
}
