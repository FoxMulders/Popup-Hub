import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', '..')
const resourcesDir = path.join(root, 'mobile', 'resources')
const wwwDir = path.join(root, 'mobile', 'www')
const iosAppDir = path.join(root, 'ios', 'App', 'App')
const androidResDir = path.join(root, 'android', 'app', 'src', 'main', 'res')
const iconSource = path.join(root, 'public', 'icons', 'icon-512x512.png')
const brandSource = path.join(root, 'public', 'popup-hub-brand.png')
const cream = { r: 250, g: 248, b: 245, alpha: 1 }

const ANDROID_LAUNCHER_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

async function ensureBrandAssets() {
  await mkdir(resourcesDir, { recursive: true })
  await mkdir(wwwDir, { recursive: true })

  await copyFile(iconSource, path.join(resourcesDir, 'icon-only.png'))
  await copyFile(brandSource, path.join(wwwDir, 'popup-hub-brand.png'))

  // iOS requires a launch image asset; keep it a plain cream canvas with
  // no logo. Capacitor SplashScreen is disabled at runtime (duration 0).
  const splash = await sharp({
    create: {
      width: 1080,
      height: 1800,
      channels: 4,
      background: cream,
    },
  })
    .png()
    .toBuffer()

  await sharp(splash).toFile(path.join(resourcesDir, 'splash.png'))
  console.log('Wrote mobile/resources/icon-only.png + plain cream splash.png (no logo)')
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
  // Icon Composer .icon crashes Xcode 26.6 actool during archive; use classic appiconset only.
  await rm(path.join(iosAppDir, 'AppIcon.icon'), { recursive: true, force: true })

  const iconSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]

  for (const size of iconSizes) {
    const filename = `AppIcon-${size}.png`
    const out = path.join(appIconDir, filename)
    await sharp(iconSource)
      .resize(size, size, {
        fit: 'contain',
        background: cream,
      })
      .flatten({ background: cream })
      .png()
      .toFile(out)
  }

  const contents = {
    images: [
      { filename: 'AppIcon-40.png', idiom: 'iphone', scale: '2x', size: '20x20' },
      { filename: 'AppIcon-60.png', idiom: 'iphone', scale: '3x', size: '20x20' },
      { filename: 'AppIcon-58.png', idiom: 'iphone', scale: '2x', size: '29x29' },
      { filename: 'AppIcon-87.png', idiom: 'iphone', scale: '3x', size: '29x29' },
      { filename: 'AppIcon-80.png', idiom: 'iphone', scale: '2x', size: '40x40' },
      { filename: 'AppIcon-120.png', idiom: 'iphone', scale: '3x', size: '40x40' },
      { filename: 'AppIcon-120.png', idiom: 'iphone', scale: '2x', size: '60x60' },
      { filename: 'AppIcon-180.png', idiom: 'iphone', scale: '3x', size: '60x60' },
      { filename: 'AppIcon-20.png', idiom: 'ipad', scale: '1x', size: '20x20' },
      { filename: 'AppIcon-40.png', idiom: 'ipad', scale: '2x', size: '20x20' },
      { filename: 'AppIcon-29.png', idiom: 'ipad', scale: '1x', size: '29x29' },
      { filename: 'AppIcon-58.png', idiom: 'ipad', scale: '2x', size: '29x29' },
      { filename: 'AppIcon-40.png', idiom: 'ipad', scale: '1x', size: '40x40' },
      { filename: 'AppIcon-80.png', idiom: 'ipad', scale: '2x', size: '40x40' },
      { filename: 'AppIcon-76.png', idiom: 'ipad', scale: '1x', size: '76x76' },
      { filename: 'AppIcon-152.png', idiom: 'ipad', scale: '2x', size: '76x76' },
      { filename: 'AppIcon-167.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5' },
      { filename: 'AppIcon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
    ],
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

async function writeAndroidAssets() {
  if (!(await pathExists(androidResDir))) {
    console.log('Skip Android assets — android/ not generated yet (run: npx cap add android)')
    return
  }

  for (const [folder, size] of Object.entries(ANDROID_LAUNCHER_SIZES)) {
    const dir = path.join(androidResDir, folder)
    await mkdir(dir, { recursive: true })
    const iconBuffer = await sharp(iconSource)
      .resize(size, size, { fit: 'contain', background: cream })
      .flatten({ background: cream })
      .png()
      .toBuffer()
    await sharp(iconBuffer).toFile(path.join(dir, 'ic_launcher.png'))
    await sharp(iconBuffer).toFile(path.join(dir, 'ic_launcher_round.png'))
  }

  const drawableDir = path.join(androidResDir, 'drawable')
  await mkdir(drawableDir, { recursive: true })
  await copyFile(path.join(resourcesDir, 'splash.png'), path.join(drawableDir, 'splash.png'))

  const drawableNightDir = path.join(androidResDir, 'drawable-night')
  await mkdir(drawableNightDir, { recursive: true })
  await copyFile(path.join(resourcesDir, 'splash.png'), path.join(drawableNightDir, 'splash.png'))

  console.log('Updated Android launcher icons + splash drawable')
}

function parseVersionMeta() {
  const pkg = JSON.parse(readFileSyncSafe(path.join(root, 'package.json'), '{}'))
  const buildMeta = JSON.parse(readFileSyncSafe(path.join(root, 'build-number.json'), '{}'))
  const version = String(pkg.version ?? '1.0.0')
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  const major = match ? Number(match[1]) : 1
  const minor = match ? Number(match[2]) : 0
  const patch = match ? Number(match[3]) : 0
  const build = Number(buildMeta.build ?? 1)
  const iosBuild = Number(buildMeta.iosBuild ?? build)
  const versionCode = major * 100_000 + minor * 1_000 + patch * 10 + build
  return { version, versionCode, build, iosBuild }
}

function readFileSyncSafe(target, fallback) {
  try {
    return readFileSync(target, 'utf8')
  } catch {
    return fallback
  }
}

async function syncNativeVersions() {
  const { version, versionCode, build, iosBuild } = parseVersionMeta()

  const androidGradle = path.join(root, 'android', 'app', 'build.gradle')
  if (await pathExists(androidGradle)) {
    let gradle = await readFile(androidGradle, 'utf8')
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
    await writeFile(androidGradle, gradle)
    console.log(`Android versionName=${version} versionCode=${versionCode}`)
  }

  const pbxproj = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
  if (await pathExists(pbxproj)) {
    let project = await readFile(pbxproj, 'utf8')
    project = project.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    project = project.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${iosBuild};`)
    await writeFile(pbxproj, project)
    console.log(`iOS MARKETING_VERSION=${version} CURRENT_PROJECT_VERSION=${iosBuild}`)
  }
}

async function patchInfoPlist() {
  const infoPlistPath = path.join(iosAppDir, 'Info.plist')
  if (!(await pathExists(infoPlistPath))) return

  let xml = await readFile(infoPlistPath, 'utf8')

  if (!xml.includes('ca.popuphub.app')) {
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
    xml = xml.replace('</dict>\n</plist>', `${insertion}\n</dict>\n</plist>`)
    console.log('Patched Info.plist with OAuth URL scheme ca.popuphub.app')
  }

  const privacyKeys = {
    NSLocationWhenInUseUsageDescription:
      'Popup Hub uses your location to show nearby markets and optional vendor market alerts.',
    NSCameraUsageDescription:
      'Popup Hub uses the camera to scan QR codes at markets and coordinator check-in.',
  }

  for (const [key, value] of Object.entries(privacyKeys)) {
    if (xml.includes(`<key>${key}</key>`)) continue
    const insertion = `\n\t<key>${key}</key>\n\t<string>${value}</string>`
    xml = xml.replace('</dict>\n</plist>', `${insertion}\n</dict>\n</plist>`)
    console.log(`Patched Info.plist with ${key}`)
  }

  await writeFile(infoPlistPath, xml)
}

async function ensureIosEntitlements() {
  const entitlementsPath = path.join(iosAppDir, 'App.entitlements')
  const defaultEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.security.application-groups</key>
\t<array>
\t\t<string>group.ca.popuphub.app</string>
\t</array>
</dict>
</plist>
`

  if (!(await pathExists(entitlementsPath))) {
    await writeFile(entitlementsPath, defaultEntitlements)
    console.log('Created ios/App/App/App.entitlements (App Group only; no aps-environment)')
  } else {
    let xml = await readFile(entitlementsPath, 'utf8')
    if (xml.includes('aps-environment')) {
      xml = xml.replace(/\n?\t<key>aps-environment<\/key>\n?\t<string>[^<]+<\/string>/g, '')
      await writeFile(entitlementsPath, xml)
      console.log('Removed aps-environment from App.entitlements (forces Development signing)')
    }
  }

  const pbxproj = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
  if (!(await pathExists(pbxproj))) return

  let project = await readFile(pbxproj, 'utf8')
  if (!project.includes('App.entitlements')) {
    project = project.replace(
      '504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference;',
      '504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference;',
    )
    if (!project.includes('App.entitlements */ = {isa = PBXFileReference')) {
      project = project.replace(
        '504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };',
        '504EC3131FED79650016851F /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };\n\t\tE1A2B3C4D5E6F708192A3B4C /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };',
      )
      project = project.replace(
        '504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\t2FAD9762203C412B000D30F8 /* config.xml */,',
        '504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tE1A2B3C4D5E6F708192A3B4C /* App.entitlements */,\n\t\t\t\t2FAD9762203C412B000D30F8 /* config.xml */,',
      )
    }
  }

  if (!project.includes('CODE_SIGN_ENTITLEMENTS')) {
    project = project.replace(
      /INFOPLIST_FILE = App\/Info.plist;\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET/g,
      'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET',
    )
  }

  await writeFile(pbxproj, project)
  console.log('Ensured ios/App/App/App.entitlements + Xcode project reference')
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
await writeAndroidAssets()
await patchInfoPlist()
await ensureIosEntitlements()
await syncNativeVersions()
