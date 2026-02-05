
$jsOutputPath = ".\get_video_moc.js"

# Compile TypeScript to JavaScript
$tscResult = tsc

if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript compilation failed"
    exit 1
}

Write-Host "TypeScript compiled successfully to $jsOutputPath"
Write-Host $tscResult

# Remove __esModule export
$jsContent = Get-Content -Path $jsOutputPath -Raw
$jsContent = $jsContent -replace 'Object\.defineProperty\(exports,\s*"__esModule",\s*\{\s*value:\s*true\s*\}\);?', ''
Set-Content -Path $jsOutputPath -Value $jsContent

Write-Host "Build completed successfully" 