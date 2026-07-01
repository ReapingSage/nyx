# ============================================================
#  NYX Setup Installer
#  Run once on a new machine to go from zero to running.
#
#  Usage (from PowerShell):
#    powershell -ExecutionPolicy Bypass -File setup.ps1
#
#  Or just double-click setup.bat — it handles the rest.
# ============================================================

$NYX_REPO     = "https://github.com/ReapingSage/nyx.git"
$NYX_VERSION  = "v1.15"
$INSTALL_DIR  = "$env:USERPROFILE\NYX"

# ── Colours ──────────────────────────────────────────────────────────────────
function Write-Header  { param([string]$t) Write-Host "`n  $t" -ForegroundColor Cyan }
function Write-Step    { param([string]$t) Write-Host "  > $t" -ForegroundColor White }
function Write-OK      { param([string]$t) Write-Host "  [OK] $t" -ForegroundColor Green }
function Write-Warn    { param([string]$t) Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Write-Fail    { param([string]$t) Write-Host "  [X]  $t" -ForegroundColor Red }
function Write-Divider { Write-Host ("  " + ("-" * 58)) -ForegroundColor DarkGray }

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ███╗   ██╗██╗   ██╗██╗  ██╗" -ForegroundColor Magenta
Write-Host "  ████╗  ██║╚██╗ ██╔╝╚██╗██╔╝" -ForegroundColor Magenta
Write-Host "  ██╔██╗ ██║ ╚████╔╝  ╚███╔╝ " -ForegroundColor Magenta
Write-Host "  ██║╚██╗██║  ╚██╔╝   ██╔██╗ " -ForegroundColor Magenta
Write-Host "  ██║ ╚████║   ██║   ██╔╝ ██╗" -ForegroundColor Magenta
Write-Host "  ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Local AI Desktop Assistant  -  $NYX_VERSION" -ForegroundColor DarkGray
Write-Host "  Setup Installer for Windows 10/11" -ForegroundColor DarkGray
Write-Divider
Write-Host ""


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 0 — Figure out where we are                       ║
# ╚══════════════════════════════════════════════════════════╝
Write-Header "Locating NYX..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IsInsideRepo = Test-Path (Join-Path $ScriptDir "ui\server.py")

if ($IsInsideRepo) {
    $NYX_DIR = $ScriptDir
    Write-OK "Already inside the NYX repo at: $NYX_DIR"
} else {
    Write-Step "NYX not found here — will clone to: $INSTALL_DIR"
    $NYX_DIR = $INSTALL_DIR
}


# ╔══════════════════════════════════════════════════════════╗
# ║  HELPER — install a winget package if not on PATH       ║
# ╚══════════════════════════════════════════════════════════╝
function Install-Prereq {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WingetId,
        [string]$FallbackUrl
    )

    $found = Get-Command $Command -ErrorAction SilentlyContinue
    if ($found) {
        Write-OK "$Name found  ($($found.Source))"
        return $true
    }

    Write-Warn "$Name not found."
    $ans = Read-Host "  Install $Name automatically via winget? [Y/n]"
    if ($ans -match '^[Nn]') {
        Write-Warn "Skipped. Install manually from: $FallbackUrl"
        return $false
    }

    Write-Step "Installing $Name..."
    winget install --id $WingetId --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "$Name install may have failed. Try manually: $FallbackUrl"
        return $false
    }

    # Refresh PATH so the new command is visible in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")

    $found = Get-Command $Command -ErrorAction SilentlyContinue
    if ($found) {
        Write-OK "$Name installed successfully."
        return $true
    } else {
        Write-Warn "$Name installed but not on PATH yet. You may need to restart this terminal after setup."
        return $true
    }
}


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 1 — Prerequisites                                 ║
# ╚══════════════════════════════════════════════════════════╝
Write-Header "Checking prerequisites..."
Write-Divider

$hasGit    = Install-Prereq -Name "Git"    -Command "git"    -WingetId "Git.Git"              -FallbackUrl "https://git-scm.com/download/win"
$hasPython = Install-Prereq -Name "Python" -Command "python" -WingetId "Python.Python.3.11"   -FallbackUrl "https://www.python.org/downloads/"
$hasNode   = Install-Prereq -Name "Node.js"-Command "node"   -WingetId "OpenJS.NodeJS.LTS"    -FallbackUrl "https://nodejs.org"
$hasOllama = Install-Prereq -Name "Ollama" -Command "ollama" -WingetId "Ollama.Ollama"        -FallbackUrl "https://ollama.com/download"

if (-not $hasPython) {
    Write-Fail "Python is required and could not be installed. Exiting."
    pause; exit 1
}

# Verify Python is 3.9+
$pyVer = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
if ($pyVer) {
    $major, $minor = $pyVer -split '\.' | ForEach-Object { [int]$_ }
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 9)) {
        Write-Fail "Python $pyVer found but NYX requires 3.9+. Please upgrade."
        pause; exit 1
    }
    Write-OK "Python $pyVer"
}

if (-not $hasNode) {
    Write-Warn "Node.js missing — the dashboard UI cannot be built. NYX will still run but you won't see the interface."
}


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 2 — Clone the repo (if not already inside it)     ║
# ╚══════════════════════════════════════════════════════════╝
if (-not $IsInsideRepo) {
    Write-Header "Downloading NYX..."
    Write-Divider

    if (Test-Path $NYX_DIR) {
        Write-Warn "$NYX_DIR already exists."
        $ans = Read-Host "  Re-use it (update via git pull)? [Y/n]"
        if ($ans -notmatch '^[Nn]') {
            Write-Step "Pulling latest changes..."
            git -C $NYX_DIR pull
        }
    } else {
        if (-not $hasGit) {
            Write-Fail "Git is required to download NYX. Install Git and re-run setup."
            pause; exit 1
        }
        Write-Step "Cloning $NYX_REPO ..."
        git clone $NYX_REPO $NYX_DIR
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Clone failed. Check your internet connection and that the repo URL is accessible."
            pause; exit 1
        }
        Write-OK "Cloned to $NYX_DIR"
    }
}


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 3 — Python dependencies                           ║
# ╚══════════════════════════════════════════════════════════╝
Write-Header "Installing Python packages..."
Write-Divider

$ReqFile = Join-Path $NYX_DIR "requirements.txt"
Write-Step "pip install -r requirements.txt"
python -m pip install --upgrade pip --quiet
python -m pip install -r $ReqFile
if ($LASTEXITCODE -ne 0) {
    Write-Fail "pip install failed. See errors above."
    pause; exit 1
}
Write-OK "Python packages installed."


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 4 — Build the frontend                            ║
# ╚══════════════════════════════════════════════════════════╝
if ($hasNode) {
    Write-Header "Building dashboard UI..."
    Write-Divider

    $FrontendDir = Join-Path $NYX_DIR "nyx_frontend"
    Write-Step "npm install"
    npm --prefix $FrontendDir install --silent
    Write-Step "npm run build"
    npm --prefix $FrontendDir run build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Frontend build failed. The dashboard UI may not load correctly."
    } else {
        Write-OK "Frontend built successfully."
    }
} else {
    Write-Warn "Skipping frontend build (Node.js not available)."
}


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 5 — Ollama model selection                        ║
# ╚══════════════════════════════════════════════════════════╝
if ($hasOllama) {
    Write-Header "Setting up AI model..."
    Write-Divider
    Write-Host ""
    Write-Host "  NYX needs at least one Ollama model to talk to." -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] Lightweight  (llama3.2:3b   ~  2 GB) - Fast, any PC"    -ForegroundColor Cyan
    Write-Host "  [2] Standard     (qwen2.5:7b    ~  5 GB) - Balanced"         -ForegroundColor Cyan
    Write-Host "  [3] Full quality (qwen2.5:14b   ~ 10 GB) - Best, needs 16GB+ RAM" -ForegroundColor Cyan
    Write-Host "  [4] Skip         (I already have models installed)"            -ForegroundColor DarkGray
    Write-Host ""
    $modelChoice = Read-Host "  Choose [1/2/3/4]"

    $modelToPull = switch ($modelChoice.Trim()) {
        "1" { "llama3.2:3b" }
        "2" { "qwen2.5:7b" }
        "3" { "qwen2.5:14b" }
        default { $null }
    }

    if ($modelToPull) {
        Write-Step "Pulling $modelToPull — this may take several minutes..."
        Write-Host "  (Download progress will appear below)" -ForegroundColor DarkGray
        Write-Host ""
        ollama pull $modelToPull
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Model $modelToPull ready."
        } else {
            Write-Warn "Model pull may have failed. You can pull manually later: ollama pull $modelToPull"
        }
    } else {
        Write-OK "Skipped model download — using your existing models."
    }
} else {
    Write-Warn "Ollama not found — NYX cannot process AI requests until Ollama is installed and a model is pulled."
    Write-Warn "Install from: https://ollama.com/download  then run: ollama pull llama3.2:3b"
}


# ╔══════════════════════════════════════════════════════════╗
# ║  STEP 6 — Shortcuts                                     ║
# ╚══════════════════════════════════════════════════════════╝
Write-Header "Creating shortcuts..."
Write-Divider

$ShortcutScript = Join-Path $NYX_DIR "tray\install_shortcut.ps1"
if (Test-Path $ShortcutScript) {
    powershell -ExecutionPolicy Bypass -File $ShortcutScript
    Write-OK "Desktop and Start Menu shortcuts created."
} else {
    Write-Warn "Shortcut script not found at: $ShortcutScript"
}


# ╔══════════════════════════════════════════════════════════╗
# ║  DONE                                                   ║
# ╚══════════════════════════════════════════════════════════╝
Write-Host ""
Write-Divider
Write-Host ""
Write-Host "  NYX is ready." -ForegroundColor Green
Write-Host ""
Write-Host "  To launch:  Double-click the NYX shortcut on your Desktop" -ForegroundColor White
Write-Host "            or run:  pythonw $(Join-Path $NYX_DIR 'tray\tray_app.py')" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NYX will appear in your system tray (bottom-right corner)." -ForegroundColor White
Write-Host "  Right-click the tray icon to open the dashboard." -ForegroundColor White
Write-Host ""
Write-Divider
Write-Host ""

$launch = Read-Host "  Launch NYX now? [Y/n]"
if ($launch -notmatch '^[Nn]') {
    $TrayScript = Join-Path $NYX_DIR "tray\tray_app.py"
    $PythonW = (Get-Command python -ErrorAction SilentlyContinue).Source -replace "python\.exe$", "pythonw.exe"
    if (Test-Path $PythonW) {
        Start-Process $PythonW -ArgumentList "`"$TrayScript`"" -WorkingDirectory $NYX_DIR -WindowStyle Hidden
    } else {
        Start-Process python -ArgumentList "`"$TrayScript`"" -WorkingDirectory $NYX_DIR -WindowStyle Hidden
    }
    Write-Host ""
    Write-OK "NYX launched — check your system tray."
}

Write-Host ""
pause
