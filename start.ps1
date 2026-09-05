<#
.SYNOPSIS
Launcher for the Virtual Patient Simulator (Express API + Vite SPA).

.DESCRIPTION
Same flags as start.sh. Run from anywhere -- the script switches to the repo
root itself, because .env is read via dotenv from the process cwd and only
exists at the root (this is why `pnpm backend`, which cds into backend/, dies
with a missing MONGODB_URI).

MongoDB is required: backend/db.js exits non-zero without MONGODB_URI.
Redis is optional: without it the server boots but the OTP endpoints refuse.
Ctrl-C stops every process this script started.

.PARAMETER BackendOnly
Express API only (node backend/index.js).

.PARAMETER FrontendOnly
Vite dev server only.

.PARAMETER Redis
Also start a local redis-server (OTP + login lockout).

.PARAMETER Build
Production build (vite build), then exit.

.PARAMETER Preview
vite build, then serve the build with vite preview.

.PARAMETER Prod
-Preview with APP_ENV/NODE_ENV=production for the API.

.PARAMETER Lint
eslint . , then exit.

.PARAMETER Install
Force `pnpm install` before starting.

.PARAMETER NoInstall
Never install, even if node_modules/ is missing.

.PARAMETER Port
Backend port (default 5001, sets PORT).

.PARAMETER FrontendPort
Vite port (default 5173 for dev, 4173 for preview).

.PARAMETER ExposeHost
Expose Vite on 0.0.0.0 (LAN / tunnel access).

.PARAMETER Open
Open the app in a browser once Vite is up.

.EXAMPLE
.\start.ps1
Backend + Vite dev server.

.EXAMPLE
.\start.ps1 -Redis -Port 5002 -ExposeHost
Everything, API on 5002, Vite reachable from the LAN.

.EXAMPLE
.\start.ps1 -BackendOnly
API only.
#>
[CmdletBinding()]
param(
    [Alias('b')][switch] $BackendOnly,
    [Alias('f')][switch] $FrontendOnly,

    [Alias('r')][switch] $Redis,

    [switch] $Build,
    [switch] $Preview,
    [switch] $Prod,
    [switch] $Lint,

    [Alias('i')][switch] $Install,
    [switch] $NoInstall,

    [Alias('p')][int] $Port,
    [int] $FrontendPort,
    [Alias('host')][switch] $ExposeHost,
    [Alias('o')][switch] $Open
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# ---- mode -----------------------------------------------------------------
if ($Prod) { $Preview = $true }

$modes = @('Build', 'Preview', 'Lint') | Where-Object { Get-Variable $_ -ValueOnly }
if ($modes.Count -gt 1) {
    Write-Host "start.ps1: -$($modes -join ', -') are mutually exclusive" -ForegroundColor Red
    exit 2
}

if ($BackendOnly -and $FrontendOnly) {
    Write-Host 'start.ps1: -BackendOnly and -FrontendOnly are mutually exclusive' -ForegroundColor Red
    exit 2
}

$runBackend  = -not $FrontendOnly
$runFrontend = -not $BackendOnly

$pm = if (Get-Command pnpm -ErrorAction SilentlyContinue) { 'pnpm' } else { 'npx' }
$pmPrefix = if ($pm -eq 'npx') { @('--yes', 'pnpm') } else { @() }

function Invoke-Pm {
    param([string[]] $PmArgs)
    & $pm @($pmPrefix + $PmArgs)
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# ---- install --------------------------------------------------------------
if ($Install -or (-not $NoInstall -and -not (Test-Path 'node_modules'))) {
    Write-Host '==> installing dependencies' -ForegroundColor Cyan
    Invoke-Pm @('install')
}

# ---- preflight ------------------------------------------------------------
if (Test-Path '.env') {
    Write-Host "==> using .env at $(Join-Path (Get-Location) '.env')" -ForegroundColor Cyan
} else {
    Write-Warning 'no .env at repo root -- the backend will exit without MONGODB_URI'
}

# ---- one-shot modes -------------------------------------------------------
if ($Lint)  { Write-Host '==> eslint .'   -ForegroundColor Cyan; Invoke-Pm @('lint');  exit 0 }
if ($Build) { Write-Host '==> vite build' -ForegroundColor Cyan; Invoke-Pm @('build'); exit 0 }

# ---- process bookkeeping --------------------------------------------------
$script:procs = [System.Collections.Generic.List[object]]::new()

function Start-Child {
    param([string] $Label, [string] $File, [string[]] $ArgList)
    Write-Host "==> $Label`: $File $($ArgList -join ' ')" -ForegroundColor Cyan
    # Resolve the launcher ourselves. `Get-Command pnpm` returns pnpm.ps1 first
    # and there is also an extensionless bash shim on PATH; Start-Process can
    # launch neither ("%1 is not a valid Win32 application"). Take the .exe, or
    # the .cmd/.bat run through cmd.exe.
    $resolved = Get-Command $File -All -ErrorAction Stop |
        Where-Object { $_.CommandType -eq 'Application' -and $_.Source -match '\.(exe|cmd|bat)$' } |
        Select-Object -First 1 -ExpandProperty Source
    if (-not $resolved) { throw "start.ps1: cannot find a launchable '$File' on PATH" }
    if ($resolved -match '\.(cmd|bat)$') {
        $ArgList = @('/c', $resolved) + $ArgList
        $File = 'cmd.exe'
    } else {
        $File = $resolved
    }
    # -NoNewWindow keeps child stdout/stderr in this console so logs interleave
    # the way they do under start.sh.
    $p = if ($ArgList.Count) {
        Start-Process -FilePath $File -ArgumentList $ArgList -NoNewWindow -PassThru
    } else {
        Start-Process -FilePath $File -NoNewWindow -PassThru
    }
    $script:procs.Add($p)
}

function Stop-Children {
    Write-Host ''
    Write-Host '==> shutting down' -ForegroundColor Cyan
    foreach ($p in $script:procs) {
        if ($p -and -not $p.HasExited) {
            # Kill the whole tree: pnpm/vite spawn grandchildren that survive a
            # bare Stop-Process on the parent.
            taskkill /PID $p.Id /T /F *> $null
        }
    }
}

try {
    # ---- build before anything long-lived starts --------------------------
    if ($Preview -and $runFrontend) {
        # A production build bakes in the DEPLOYED api base url, so a local
        # preview would call vpsbackend.metawingsxr.com and get blocked by its
        # CORS policy. Point it at the local API instead.
        $apiPort = if ($PSBoundParameters.ContainsKey('Port')) { $Port } else { 5001 }
        if (-not $env:VITE_API_BASE_URL) { $env:VITE_API_BASE_URL = "http://localhost:$apiPort" }
        Write-Host "==> vite build (VITE_API_BASE_URL=$($env:VITE_API_BASE_URL))" -ForegroundColor Cyan
        Invoke-Pm @('build')

        # -Prod sets NODE_ENV=production, which turns off the local-origin
        # allowance in the API's CORS check; name the preview origin explicitly.
        $prevPort = if ($PSBoundParameters.ContainsKey('FrontendPort')) { $FrontendPort } else { 4173 }
        $origins = @("http://localhost:$prevPort", "http://127.0.0.1:$prevPort")
        $env:CORS_ORIGINS = (@($env:CORS_ORIGINS) + $origins | Where-Object { $_ }) -join ','
    }

    # ---- redis -----------------------------------------------------------
    if ($Redis) {
        if (Get-Command redis-server -ErrorAction SilentlyContinue) {
            Start-Child 'redis' 'redis-server' @()
            Start-Sleep -Seconds 1
        } else {
            Write-Warning '-Redis given but redis-server is not on PATH; skipping'
        }
    }

    # ---- backend ---------------------------------------------------------
    if ($runBackend) {
        if ($PSBoundParameters.ContainsKey('Port')) { $env:PORT = "$Port" }
        # APP_ENV drives the API's dev/prod behaviour (error detail, /debug/env, CORS).
        if ($Prod) {
            $env:NODE_ENV = 'production'
            $env:APP_ENV = 'production'
        } elseif (-not $env:APP_ENV) {
            $env:APP_ENV = 'development'
        }
        Start-Child 'backend' 'node' @('backend/index.js')
    }

    # ---- frontend --------------------------------------------------------
    if ($runFrontend) {
        $viteArgs = [System.Collections.Generic.List[string]]::new()
        $viteArgs.AddRange([string[]] ($pmPrefix + @('exec', 'vite')))
        if ($Preview) { $viteArgs.Add('preview') }
        if ($PSBoundParameters.ContainsKey('FrontendPort')) {
            $viteArgs.AddRange([string[]] @('--port', "$FrontendPort"))
        }
        if ($ExposeHost) { $viteArgs.AddRange([string[]] @('--host', '0.0.0.0')) }
        if ($Open)       { $viteArgs.Add('--open') }

        $label = if ($Preview) { 'vite preview' } else { 'vite' }
        Start-Child $label $pm $viteArgs.ToArray()
    }

    if ($script:procs.Count -eq 0) {
        Write-Warning 'nothing to run'
        exit 0
    }

    Write-Host '==> running; Ctrl-C to stop' -ForegroundColor Green

    # Exit as soon as any child dies, so a crashed backend does not leave a
    # half-running stack behind.
    while ($true) {
        Start-Sleep -Milliseconds 400
        $dead = $script:procs | Where-Object { $_.HasExited }
        if ($dead) {
            foreach ($d in $dead) {
                Write-Warning "process $($d.Id) exited with code $($d.ExitCode)"
            }
            break
        }
    }
} finally {
    Stop-Children
}
