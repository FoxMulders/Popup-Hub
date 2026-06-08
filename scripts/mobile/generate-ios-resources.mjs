import sharp from 'sharp'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', '..')
const resourcesDir = path.join(root, 'mobile', 'resources')
const wwwDir = path.join(root, 'mobile', 'www')
const iosAppDir = path.join(root, 'ios', 'App', 'App')
const iconSource = path.join(root, 'public', 'icons', 'icon-512x512.png')
const brandSource = path.join(root, 'public', 'popup-hub-brand.png')
const cream = { r: 250, g: 248, b: 245, alpha: 1 }

async function ensureBrandAssets() {
  await mkdir(resourcesDir, { recursive: true })
  await mkdir(wwwDir, { recursive: true })

  await copyFile(iconSource, path.join(resourcesDir, 'icon-only.png'))
  await copyFile(brandSource, path.join(wwwDir, 'popup-hub-brand.png'))

  const splash = await sharp(brandSource)
    .resize(960, 960, {
      fit: 'contain',
      background: cream,
    })
    .extend({
      top: 420,
      bottom: 420,
      left: 60,
      right: 60,
      background: cream,
    })
    .png()
    .toBuffer()

  await sharp(splash).toFile(path.join(resourcesDir, 'splash.png'))
  console.log('Wrote mobile/resources/icon-only.png + splash.png')
}

async function writeIosAppIcon() {
  if (!(await pathExists(iosAppDir))) {
    console.log('Skip iOS asset catalog — ios/ not generated yet (run: npx cap add ios)')
    return
  }

  const appIconDir = path.join(iosAppDir, 'Assets.xcassets', 'AppIcon.appiconset')
  const splashDir = path.join(iosAppDir, 'Assets.xcassets', 'Splash.imageset')
  await mkdir(appIconDir, { recursive: true })
  await mkdir(splashDir, { recursive: true })

  const iconSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]

  for (const size of iconSizes) {
    const filename = `AppIcon-${size}.png`
    const out = path.join(appIconDir, filename)
    await sharp(iconSource)
      .resize(size, size, {
        fit: 'contain',
        background: cream,
      })
      .png()
      .toFile(out)
  }

  const contents = {
    images: iconSizes.map((size) => {
      const filename = `AppIcon-${size}.png`
      if (size === 1024) {
        return {
          filename,
          idiom: 'ios-marketing',
          scale: '1x',
          size: '1024x1024',
        }
      }
      if (size === 76 || size === 152) {
        return {
          filename,
          idiom: 'ipad',
          scale: size === 76 ? '1x' : '2x',
          size: size === 76 ? '76x76' : '76x76',
        }
      }
      const scale = [20, 29, 40, 58, 60, 80, 87, 120, 167, 180].includes(size) ? '2x' : '3x'
      const base = size === 58 ? 29 : size === 87 ? 29 : size === 120 ? 60 : size === 167 ? 83.5 : size === 180 ? 60 : size
      return {
        filename,
        idiom: 'iphone',
        scale,
        size: `${Math.round(base)}x${Math.round(base)}`,
      }
    }),
    info: { author: 'xcode', version: 1 },
  }

  await writeFile(path.join(appIconDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`)

  const splashOut = path.join(splashDir, 'splash.png')
  await copyFile(path.join(resourcesDir, 'splash.png'), splashOut)
  await writeFile(
    path.join(splashDir, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [{ filename: 'splash.png', idiom: 'universal', scale: '1x' }],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    )}\n`,
  )

  console.log('Updated ios/App/App/Assets.xcassets AppIcon + Splash')
}

async function patchInfoPlistUrlScheme() {
  const infoPlistPath = path.join(iosAppDir, 'Info.plist')
  if (!(await pathExists(infoPlistPath))) return

  const xml = await readFile(infoPlistPath, 'utf8')
  if (xml.includes('ca.popuphub.app')) {
    console.log('Info.plist already contains ca.popuphub.app URL scheme')
    return
  }

  const insertion = `
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>ca.popuphub.app</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>ca.popuphub.app</string>
\t\t\t</array>
\t\t</dict>
\t</array>`

  const updated = xml.replace('</dict>\n</plist>', `${insertion}\n</dict>\n</plist>`)
  await writeFile(infoPlistPath, updated)
  console.log('Patched Info.plist with OAuth URL scheme ca.popuphub.app')
}

async function pathExists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

await ensureBrandAssets()
await writeIosAppIcon()
await patchInfoPlistUrlScheme()
