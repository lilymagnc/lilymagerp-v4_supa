$source = "C:\"
$dest = "D:\"
$currentProject = "C:\lilymagerp-v3"

Write-Host "Checking for lilymagerp folders in C:\ to move to D:\ ..." -ForegroundColor Cyan

# Check if D: exists
if (-not (Test-Path $dest)) {
    Write-Host "Error: Destination drive D:\ does not exist." -ForegroundColor Red
    exit
}

# Get folders matching 'lilymagerp*' in C:\ root, excluding the current project
$folders = Get-ChildItem -Path $source -Directory -Filter "*lilymagerp*" | Where-Object { 
    $_.FullName.TrimEnd('\') -ne $currentProject.TrimEnd('\') 
}

if ($folders.Count -eq 0) {
    Write-Host "No other 'lilymagerp' folders found in C:\." -ForegroundColor Yellow
    exit
}

foreach ($folder in $folders) {
    $destPath = Join-Path -Path $dest -ChildPath $folder.Name
    
    if (Test-Path $destPath) {
         Write-Host "Skipping $($folder.Name): Destination folder already exists in D:\" -ForegroundColor Yellow
         continue
    }

    Write-Host "Moving $($folder.FullName) to $dest..."
    try {
        Move-Item -Path $folder.FullName -Destination $dest -Force -ErrorAction Stop
        Write-Host "Successfully moved $($folder.Name)" -ForegroundColor Green
    } catch {
        Write-Host "Failed to move $($folder.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Operation completed." -ForegroundColor Cyan
import { Timestamp } from 'firebase/firestore';
