# RPG 2D - Les Terres Oubliees : serveur HTTP local (remplace python -m http.server)
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
# ou double-cliquer sur Jouer-PS.bat
$port = 8000
$listener = $null
foreach ($tryPort in @(8000, 8001, 8002)) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$tryPort/")
    try { $l.Start(); $listener = $l; $port = $tryPort; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host "Aucun port disponible (8000-8002)"; exit 1 }
Write-Host "Serveur HTTP demarre sur http://localhost:$port"
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    $path = $context.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path (Get-Location) $path.TrimStart('/')
    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = switch ($ext) {
            ".html" { "text/html" }
            ".js" { "text/javascript" }
            ".css" { "text/css" }
            ".png" { "image/png" }
            ".jpg" { "image/jpeg" }
            ".gif" { "image/gif" }
            ".svg" { "image/svg+xml" }
            ".json" { "application/json" }
            default { "application/octet-stream" }
        }
        $response.ContentType = $mime
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
