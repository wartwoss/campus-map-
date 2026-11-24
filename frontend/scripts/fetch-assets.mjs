// Downloads the CC0 assets used by the campus map, keeps the untouched
// originals, copies the served files into public/assets, and writes a
// manifest with licence, source, format, size and checksum for each file.
//
//   node scripts/fetch-assets.mjs
//
// Source: Kenney Nature Kit (CC0 1.0), used for the planted trees only.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

const ORIGINAL_DIR = 'assets-src/original'
const SERVED_DIR = 'public/assets'
const UA = 'Mozilla/5.0 (campusmap-demo asset fetch)'

const KENNEY = [
  { slug: 'nature-kit', title: 'Nature Kit', used_for: 'Trees for the two-building campus site' },
]

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function download(url, dest, headers = {}) {
  mkdirSync(join(dest, '..'), { recursive: true })
  const response = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' })
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(dest, buffer)
  return dest
}

async function fetchKenney(pack) {
  const hex = Buffer.from(`assets/${pack.slug}`).toString('hex')
  const referer = `https://kenney.nl/assets/${pack.slug}`
  const link = await fetch(`https://kenney.nl/download-link/${hex}`, {
    headers: { Referer: referer, Origin: 'https://kenney.nl', Accept: 'application/json', 'User-Agent': UA },
  })
  const json = await link.json()
  if (!json.url) throw new Error(`Kenney ${pack.slug}: ${JSON.stringify(json)}`)
  const zip = join(ORIGINAL_DIR, 'kenney', `${pack.slug}.zip`)
  await download(json.url, zip, { Referer: referer })
  const extractDir = join(ORIGINAL_DIR, 'kenney', pack.slug)
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  execFileSync('tar', ['-xf', zip, '-C', extractDir])
  return { zip, extractDir }
}

function listFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) listFiles(full, out)
    else out.push(full)
  }
  return out
}

async function main() {
  const manifest = { generated_at: new Date().toISOString(), entries: [] }
  mkdirSync(ORIGINAL_DIR, { recursive: true })

  // Kenney packs: keep the zip and the extracted original, serve only the GLB models.
  for (const pack of KENNEY) {
    const { zip, extractDir } = await fetchKenney(pack)
    const glbDir = listFiles(extractDir).filter((f) => f.toLowerCase().endsWith('.glb'))
    const licenceFile = listFiles(extractDir).find((f) => /license/i.test(f))
    const licenceText = licenceFile ? readFileSync(licenceFile, 'utf8') : ''
    const served = []
    for (const file of glbDir) {
      const dest = join(SERVED_DIR, 'models', 'kenney', pack.slug, file.split(/[\\\\/]/).pop())
      mkdirSync(join(dest, '..'), { recursive: true })
      copyFileSync(file, dest)
      served.push(relative('public', dest).replace(/\\/g, '/'))
    }
    const textures = listFiles(extractDir).filter((f) => /GLB format[\\/]Textures[\\/]/i.test(f))
    for (const tex of textures) {
      const dest = join(SERVED_DIR, 'models', 'kenney', pack.slug, 'Textures', tex.split(/[\\/]/).pop())
      mkdirSync(join(dest, '..'), { recursive: true })
      copyFileSync(tex, dest)
      served.push(relative('public', dest).replace(/\\/g, '/'))
    }
    manifest.entries.push({
      id: `kenney-${pack.slug}`,
      title: pack.title,
      source_url: `https://kenney.nl/assets/${pack.slug}`,
      licence: 'CC0 1.0 Universal',
      licence_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      licence_evidence: licenceText.split('\n').find((l) => /License:/i.test(l))?.trim() ?? 'Asset page: Creative Commons CC0',
      attribution_required: false,
      format: 'glb',
      glb_count: glbDir.length,
      original_zip: relative('.', zip).replace(/\\/g, '/'),
      original_sha256: sha256(zip),
      original_bytes: statSync(zip).size,
      served_files: served.length,
      used_for: pack.used_for,
    })
  }

  mkdirSync(SERVED_DIR, { recursive: true })
  writeFileSync(join(SERVED_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  const lines = [
    '# Asset inventory',
    '',
    `Generated ${manifest.generated_at} by frontend/scripts/fetch-assets.mjs. Every file below is CC0 1.0 (public domain dedication). No attribution is required; credits are listed anyway.`,
    '',
    '| Asset | Source | Licence | Format | Used for |',
    '| --- | --- | --- | --- | --- |',
    ...manifest.entries.map((e) => `| ${e.title} | ${e.source_url} | ${e.licence} | ${e.format} | ${e.used_for} |`),
    '',
    'Originals (unmodified downloads) are in assets-src/original. Served copies are in public/assets. No compression or other edits have been applied to any file.',
    '',
  ]
  writeFileSync(join('assets-src', 'INVENTORY.md'), lines.join('\n'))

  console.log(`Fetched ${manifest.entries.length} assets. Manifest: public/assets/manifest.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
