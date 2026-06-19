param (
    [string]$VpsIp = $(Read-Host -Prompt "Enter your VPS IP address"),
    [string]$Username = $(Read-Host -Prompt "Enter your VPS Username (e.g. root)"),
    [string]$KeyPath = $(Read-Host -Prompt "Enter the path to your SSH key (leave blank if using password)")
)

$SourceFolder = "C:\Users\misch\.gemini\antigravity\scratch\proautomation-store"
$DestFolder = "/home/$Username/proautomation-store"
if ($Username -eq "root") {
    $DestFolder = "/root/proautomation-store"
}

Write-Host "🚀 Starting deployment to $VpsIp..." -ForegroundColor Cyan

# 1. Copy files using SCP
Write-Host "📦 Copying files to VPS... (This may take a minute)" -ForegroundColor Yellow
$scpCommand = "scp -r"
if ($KeyPath) {
    $scpCommand += " -i $KeyPath"
}
$scpCommand += " $SourceFolder ${Username}@${VpsIp}:$DestFolder"
Invoke-Expression $scpCommand

# 2. SSH into VPS and deploy
Write-Host "🐳 Building and starting Docker containers on VPS..." -ForegroundColor Yellow
$sshCommand = "ssh"
if ($KeyPath) {
    $sshCommand += " -i $KeyPath"
}
$sshCommand += " ${Username}@${VpsIp} `"cd $DestFolder && echo 'DATABASE_URL=postgres://postgres:password@db:5432/proautomation?sslmode=disable' > .env && echo 'AUTH_SECRET=1b0d23c14a9c693a1e2b5e28a9b3d115e2193eab0b73c9db8d7c4b693e54b6d' >> .env && docker compose up -d --build`""
Invoke-Expression $sshCommand

Write-Host "✅ Deployment Complete! Your app should be live at http://$VpsIp:3000" -ForegroundColor Green
