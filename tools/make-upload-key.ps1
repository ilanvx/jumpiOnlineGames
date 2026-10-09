# JUMPI: makes the app's UPLOAD KEY for Google Play on this computer (Windows, no Java needed).
# Run: right-click this file → "Run with PowerShell".
# It asks you for a password (choose a strong one and WRITE IT DOWN somewhere safe), then:
#   - saves the key as  jumpi-upload-key.p12  on your Desktop  (keep it safe, back it up, never send it to anyone)
#   - copies the key as text to the clipboard, ready to paste into GitHub as the secret ANDROID_KEYSTORE_BASE64
# Then in GitHub: the repo → Settings → Secrets and variables → Actions → New repository secret:
#   ANDROID_KEYSTORE_BASE64  = paste (Ctrl+V)
#   ANDROID_KEYSTORE_PASSWORD = the password you chose
$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "JUMPI - Google Play upload key" -ForegroundColor Yellow
$out = Join-Path ([Environment]::GetFolderPath("Desktop")) "jumpi-upload-key.p12"
if (Test-Path $out) { Write-Host "There is already a key on your Desktop: $out" -ForegroundColor Red; Write-Host "Keep using that one. (Delete or rename it first only if you really want a new key.)"; Read-Host "Press Enter to close"; exit }
$p1 = Read-Host -AsSecureString "Choose a password for the key (at least 8 characters)"
$p2 = Read-Host -AsSecureString "Type it again"
$a = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
$b = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
if ($a -ne $b) { Write-Host "The two passwords are not the same. Run it again." -ForegroundColor Red; Read-Host "Press Enter to close"; exit }
if ($a.Length -lt 8) { Write-Host "At least 8 characters, please. Run it again." -ForegroundColor Red; Read-Host "Press Enter to close"; exit }
$a = $null; $b = $null
$cert = New-SelfSignedCertificate -Subject "CN=Jumpi Games, O=Jumpi Games, C=IL" -FriendlyName "upload" -Type Custom `
  -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyUsage DigitalSignature -KeySpec Signature -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(30) -CertStoreLocation "Cert:\CurrentUser\My"
try {
  Export-PfxCertificate -Cert $cert -FilePath $out -Password $p1 -CryptoAlgorithmOption AES256_SHA256 | Out-Null
} catch {
  Export-PfxCertificate -Cert $cert -FilePath $out -Password $p1 | Out-Null
}
Remove-Item -Path ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -DeleteKey
[Convert]::ToBase64String([IO.File]::ReadAllBytes($out)) | Set-Clipboard
Write-Host ""
Write-Host "Done! The key is saved here: $out" -ForegroundColor Green
Write-Host "Back it up (a USB stick / your Google Drive). Without it you can't update the app until Google resets it."
Write-Host ""
Write-Host "The key is now copied (as text). In GitHub add two secrets:" -ForegroundColor Yellow
Write-Host "  ANDROID_KEYSTORE_BASE64   = paste with Ctrl+V"
Write-Host "  ANDROID_KEYSTORE_PASSWORD = the password you just chose"
Write-Host ""
Read-Host "Press Enter to close"
