
$skillsDir = "c:\lilymagerp-v4_supa\my-skills\skills"
$keepKeywords = @(
    "next", "react", "ui", "design", "tailwind", "css", 
    "typescript", "ts", "javascript", "js", "node",
    "supabase", "postgres", "sql", "db", "data", 
    "git", "github", "commit", "pr",
    "debug", "fix", "error", "console",
    "refactor", "clean", "lint", "optimize", "performance",
    "test", "qa",
    "architect", "pattern", "structure", "api", "rest", "graphql",
    "plan", "doc", "write", "readme", "guide",
    "web", "app", "browser", "frontend", "fullstack", "backend",
    "security", "auth",
    "essential", "fundamental", "master"
)

# Get list of skill folders
if (Test-Path $skillsDir) {
    $folders = Get-ChildItem -Path $skillsDir -Directory
    $deletedCount = 0
    $keptCount = 0

    foreach ($folder in $folders) {
        $shouldKeep = $false
        foreach ($keyword in $keepKeywords) {
            if ($folder.Name -match $keyword) {
                $shouldKeep = $true
                break
            }
        }

        if (-not $shouldKeep) {
            # Write-Host "Deleting: $($folder.Name)"
            Remove-Item -Path $folder.FullName -Recurse -Force
            $deletedCount++
        } else {
            # Write-Host "Keeping: $($folder.Name)"
            $keptCount++
        }
    }
    
    Write-Host "Cleanup Complete."
    Write-Host "Kept: $keptCount skills"
    Write-Host "Deleted: $deletedCount skills"
} else {
    Write-Host "Skills directory not found!"
}
