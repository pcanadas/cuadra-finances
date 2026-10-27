/**
 * Versión para Microsoft Store: compila Zenit sin el actualizador propio
 * (VITE_STORE=1 → las actualizaciones las da la Store) y la empaqueta como MSIX.
 *
 *   npm run store:build                  → src-tauri/target/msix/Zenit_<versión>_x64.msix
 *   npm run store:build -- --test        → además lo firma con un certificado de pruebas
 *                                          para instalarlo en este equipo
 *   npm run store:build -- --skip-build  → reempaqueta sin volver a compilar
 *
 * Para la Store se sube sin firmar: Microsoft firma el paquete. Los datos de identidad
 * (nombre, editor) están en src-tauri/msix/store.json.
 * Necesita el Windows SDK (makeappx, makepri, signtool).
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = join(root, 'src-tauri')
const outDir = join(tauriDir, 'target', 'msix')
const stage = join(outDir, 'stage')
const args = process.argv.slice(2)

const store = JSON.parse(readFileSync(join(tauriDir, 'msix', 'store.json'), 'utf8'))
const { productName, mainBinaryName } = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'))
const executable = `${mainBinaryName}.exe`
// MSIX exige cuatro números y la Store, que el último sea 0
const version = `${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version}.0`
const msixPath = join(outDir, `${productName}_${version}_x64.msix`)

/** Carpeta x64 del Windows SDK más reciente que tenga makeappx. */
function findSdkBin() {
  const base = 'C:/Program Files (x86)/Windows Kits/10/bin'
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^10\./.test(d)).sort().reverse() : []
  const dir = dirs.map((d) => join(base, d, 'x64')).find((d) => existsSync(join(d, 'makeappx.exe')))
  if (!dir) throw new Error('No se encuentra el Windows SDK (makeappx.exe). Instálalo desde https://developer.microsoft.com/windows/downloads/windows-sdk/')
  return dir
}

const run = (exe, exeArgs) => execFileSync(exe, exeArgs, { stdio: 'inherit' })
const powershell = (script) => execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim()
const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 1. Compilar (sin instalador NSIS: solo hace falta el .exe)
if (!args.includes('--skip-build')) {
  execSync('npx tauri build --no-bundle', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_STORE: '1' } })
}
const exe = join(tauriDir, 'target', 'release', executable)
if (!existsSync(exe)) throw new Error(`No existe ${exe}`)

// 2. Carpeta del paquete: ejecutable, iconos y manifiesto
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, 'Assets'), { recursive: true })
copyFileSync(exe, join(stage, executable))
for (const icon of ['StoreLogo', 'Square44x44Logo', 'Square71x71Logo', 'Square150x150Logo']) {
  copyFileSync(join(tauriDir, 'icons', `${icon}.png`), join(stage, 'Assets', `${icon}.png`))
}
// Barra de tareas y menú Inicio: iconos sin la placa de color de fondo
const sizes = [16, 24, 32, 48, 256]
powershell(`
  Add-Type -AssemblyName System.Drawing
  $src = [System.Drawing.Image]::FromFile('${join(tauriDir, 'icons', 'icon.png')}')
  foreach ($s in @(${sizes.join(',')})) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $s, $s)
    $bmp.Save('${join(stage, 'Assets')}\\Square44x44Logo.targetsize-' + $s + '_altform-unplated.png', [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
  }
  $src.Dispose()
`)

const fields = { ...store, version, executable }
const manifest = readFileSync(join(tauriDir, 'msix', 'AppxManifest.xml'), 'utf8')
  .replace(/{{(\w+)}}/g, (_, k) => {
    if (fields[k] == null) throw new Error(`Falta "${k}" en src-tauri/msix/store.json`)
    return xmlEscape(fields[k])
  })
writeFileSync(join(stage, 'AppxManifest.xml'), manifest)

// 3. resources.pri (para que Windows elija el icono del tamaño adecuado) y paquete
const sdk = findSdkBin()
const priConfig = join(outDir, 'priconfig.xml')
run(join(sdk, 'makepri.exe'), ['createconfig', '/cf', priConfig, '/dq', 'es-ES', '/pv', '10.0.0', '/o'])
run(join(sdk, 'makepri.exe'), ['new', '/pr', stage, '/cf', priConfig, '/mn', join(stage, 'AppxManifest.xml'), '/of', join(stage, 'resources.pri'), '/o'])
run(join(sdk, 'makeappx.exe'), ['pack', '/d', stage, '/p', msixPath, '/o'])

// 4. Opcional: firmar con un certificado de pruebas cuyo sujeto coincide con el Publisher
if (args.includes('--test')) {
  const pfx = join(outDir, 'zenit-pruebas.pfx')
  const cer = join(outDir, 'zenit-pruebas.cer')
  const password = 'zenit-pruebas'
  powershell(`
    $cert = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq '${store.publisher}' -and $_.FriendlyName -eq 'Zenit MSIX pruebas' } | Select-Object -First 1
    if (-not $cert) {
      $cert = New-SelfSignedCertificate -Type Custom -Subject '${store.publisher}' -KeyUsage DigitalSignature -FriendlyName 'Zenit MSIX pruebas' -CertStoreLocation Cert:\\CurrentUser\\My -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
    }
    $pwd = ConvertTo-SecureString -String '${password}' -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath '${pfx}' -Password $pwd | Out-Null
    Export-Certificate -Cert $cert -FilePath '${cer}' | Out-Null
  `)
  run(join(sdk, 'signtool.exe'), ['sign', '/fd', 'SHA256', '/f', pfx, '/p', password, msixPath])
  console.log(`
Firmado para pruebas. Para instalarlo en este equipo (una sola vez, PowerShell como administrador):
  Import-Certificate -FilePath "${cer}" -CertStoreLocation Cert:\\LocalMachine\\TrustedPeople
Después, doble clic en el .msix.`)
}

console.log(`\nMSIX: ${msixPath}`)
if (store.publisher.includes('Pendiente')) {
  console.log('Aviso: src-tauri/msix/store.json aún tiene la identidad PENDIENTE; la Store lo rechazará hasta copiar la de Partner Center.')
}
