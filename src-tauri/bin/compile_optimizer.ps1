# PowerShell Script to Compile ytd-optimizer.exe using dotnet CLI

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DllPath = Join-Path $ScriptDir "CodeWalker.Core.dll"
$ProjectFile = Join-Path $ScriptDir "..\ytd-optimizer\ytd-optimizer.csproj"
$OutputPath = $ScriptDir

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   YTD Texture Optimizer Compiler (dotnet)   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Check for CodeWalker.Core.dll
if (-not (Test-Path $DllPath)) {
    Write-Error "Error: CodeWalker.Core.dll was not found in: $ScriptDir"
    Write-Host "Please ensure 'CodeWalker.Core.dll' is copied into this folder before compiling." -ForegroundColor Yellow
    Exit 1
}

# 2. Check for Project File
if (-not (Test-Path $ProjectFile)) {
    Write-Error "Error: Project file not found at: $ProjectFile"
    Exit 1
}

Write-Host "Compiling ytd-optimizer.exe using dotnet CLI..." -ForegroundColor Yellow

# Run dotnet publish
dotnet publish "$ProjectFile" -c Release -o "$OutputPath" -r win-x64 --self-contained false -p:PublishSingleFile=true -p:PublishReadyToRun=true -p:PublishTrimmed=false

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nCompilation successful!" -ForegroundColor Green
    Write-Host "Executable generated at: $(Join-Path $OutputPath "ytd-optimizer.exe")" -ForegroundColor Green
    
    # Optional cleanup of extra publish artifacts
    $filesToCleanup = @("ytd-optimizer.pdb")
    foreach ($file in $filesToCleanup) {
        $filePath = Join-Path $OutputPath $file
        if (Test-Path $filePath) {
            Remove-Item $filePath -Force
        }
    }
} else {
    Write-Error "Compilation failed. Check the errors above."
}
