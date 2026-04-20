$ErrorActionPreference = "Stop"

$baseUrl = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights"
$files = @(
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1"
)

$dest = Join-Path $PSScriptRoot "..\\public\\models"
New-Item -ItemType Directory -Path $dest -Force | Out-Null

foreach ($file in $files) {
  $url = "$baseUrl/$file"
  $out = Join-Path $dest $file
  Write-Host "Downloading $file..."
  Invoke-WebRequest -Uri $url -OutFile $out
}

Write-Host "Done. Files saved to $dest"
