/**
 * Genera src/assets/licenses.json con las licencias de todo el código de terceros
 * que se distribuye con la app: paquetes npm de producción, crates de Rust
 * (Android y Windows) y librerías Android de Gradle.
 *
 *   npm run licenses
 *
 * Volver a ejecutarlo cuando cambien las dependencias.
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LICENSE_FILE_RE = /^(licen[cs]e|copying|notice)/i
// Dependencias opcionales que solo se usan en Node (no van dentro de la app)
const NODE_ONLY = /^@napi-rs\//

// Texto estándar para paquetes que declaran licencia pero no incluyen el archivo
const mitText = (name) => `MIT License

Copyright (c) The ${name} authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

const bsd3Text = (name) => `BSD 3-Clause License

Copyright (c) The ${name} authors

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`

const texts = {}
const packages = []

function addText(text) {
  if (!text) return null
  const clean = text.replace(/\r\n/g, '\n').trim()
  const id = createHash('sha1').update(clean).digest('hex').slice(0, 10)
  texts[id] = clean
  return id
}

/** Lee el archivo de licencia más adecuado de una carpeta (prefiere MIT si hay varias). */
function readLicense(dir, license = '') {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => LICENSE_FILE_RE.test(f)).sort()
  if (!files.length) return null
  const prefer = /\bMIT\b/.test(license) ? files.find((f) => /mit/i.test(f)) : null
  const main = prefer ?? files.find((f) => !/notice/i.test(f)) ?? files[0]
  let text = readFileSync(join(dir, main), 'utf8')
  const notice = files.find((f) => /notice/i.test(f) && f !== main)
  if (notice) text += '\n\n' + readFileSync(join(dir, notice), 'utf8')
  return text
}

// ─── npm (solo dependencias de producción) ──────────────────────────────────
const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString())
const seenNpm = new Set()
;(function walk(deps = {}) {
  for (const [name, info] of Object.entries(deps)) {
    const key = `${name}@${info.version}`
    if (!info.version || seenNpm.has(key) || NODE_ONLY.test(name)) continue
    seenNpm.add(key)
    const dir = join(root, 'node_modules', name)
    const pkg = existsSync(join(dir, 'package.json')) ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) : {}
    const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'Desconocida'
    packages.push({ name, version: info.version, license, source: 'npm', text: addText(readLicense(dir, license)) })
    walk(info.dependencies)
  }
})(tree.dependencies)

// ─── Rust (crates que acaban en los binarios de Android y Windows) ──────────
const seenRust = new Set()
for (const target of ['aarch64-linux-android', 'x86_64-pc-windows-msvc']) {
  let meta
  try {
    meta = JSON.parse(execSync(`cargo metadata --format-version 1 --filter-platform ${target}`, { cwd: join(root, 'src-tauri'), maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString())
  } catch {
    console.warn(`cargo no disponible: se omiten los crates de ${target}`)
    continue
  }
  const nodes = Object.fromEntries(meta.resolve.nodes.map((n) => [n.id, n]))
  const reachable = new Set()
  const stack = [meta.resolve.root]
  while (stack.length) {
    const id = stack.pop()
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const d of nodes[id].deps) if (d.dep_kinds.some((k) => k.kind === null)) stack.push(d.pkg)
  }
  for (const p of meta.packages) {
    if (!reachable.has(p.id) || !p.source) continue // solo dependencias externas
    const key = `${p.name}@${p.version}`
    if (seenRust.has(key)) continue
    seenRust.add(key)
    const license = p.license ?? (p.license_file ? 'Ver texto' : 'Desconocida')
    packages.push({ name: p.name, version: p.version, license, source: 'rust', text: addText(readLicense(dirname(p.manifest_path), license)) })
  }
}

// ─── Android (Gradle: app/build.gradle.kts) ─────────────────────────────────
const apache = Object.entries(texts).find(([, t]) => /Apache License\s+Version 2\.0/.test(t) && t.length > 9000)?.[0] ?? null
const gradle = readFileSync(join(root, 'src-tauri/gen/android/app/build.gradle.kts'), 'utf8')
for (const [, coord] of gradle.matchAll(/^\s*implementation\("([^"]+)"\)/gm)) {
  const [group, artifact, version] = coord.split(':')
  packages.push({ name: `${group}:${artifact}`, version, license: 'Apache-2.0', source: 'android', text: apache })
}

// Paquetes sin archivo de licencia: texto estándar de la licencia que declaran
const findText = (re) => Object.entries(texts).find(([, t]) => re.test(t))?.[0] ?? null
const mplId = findText(/Mozilla Public License Version 2\.0/)
for (const p of packages) {
  if (p.text) continue
  if (/\bMIT\b/.test(p.license)) p.text = addText(mitText(p.name))
  else if (/BSD-3-Clause/.test(p.license)) p.text = addText(bsd3Text(p.name))
  else if (/MPL-2\.0/.test(p.license)) p.text = mplId
  else if (/Apache-2\.0/.test(p.license)) p.text = apache
}

packages.sort((a, b) => a.name.localeCompare(b.name))
const out = { generated: new Date().toISOString().slice(0, 10), packages, texts }
writeFileSync(join(root, 'src/assets/licenses.json'), JSON.stringify(out))

const missing = packages.filter((p) => !p.text)
const bySource = (s) => packages.filter((p) => p.source === s).length
console.log(`licenses.json: ${packages.length} paquetes (npm ${bySource('npm')}, rust ${bySource('rust')}, android ${bySource('android')}), ${Object.keys(texts).length} textos distintos`)
if (missing.length) console.log(`Sin archivo de licencia (${missing.length}): ${missing.map((p) => `${p.name} (${p.license})`).join(', ')}`)
