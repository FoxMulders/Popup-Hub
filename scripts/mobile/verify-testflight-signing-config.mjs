#!/usr/bin/env node
/**
 * Validates that iOS TestFlight manual-signing profile names are consistent
 * across project.pbxproj, ExportOptions.plist, deploy.yml, and patch-ios-widget.
 * Run: node scripts/mobile/verify-testflight-signing-config.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const APP_PROFILE = 'PopupHub App Store'
const WIDGET_PROFILE = 'PopupHub Widget App Store'
const TEAM_ID = '6ACBDTX7T7'

const checks = []

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function expect(name, content, pattern, detail) {
  const ok = pattern.test(content)
  checks.push({ name, ok, detail })
  return ok
}

const pbxproj = read('ios/App/App.xcodeproj/project.pbxproj')
const exportPlist = read('ios/App/App/ExportOptions.plist')
const deployYml = read('.github/workflows/deploy.yml')
const buildMeta = JSON.parse(read('build-number.json'))

expect(
  'pbxproj App Release profile',
  pbxproj,
  new RegExp(`PROVISIONING_PROFILE_SPECIFIER = "${APP_PROFILE}"`),
  `App Release must use "${APP_PROFILE}"`
)
expect(
  'pbxproj Widget Release profile',
  pbxproj,
  new RegExp(`PROVISIONING_PROFILE_SPECIFIER = "${WIDGET_PROFILE}"`),
  `Widget Release must use "${WIDGET_PROFILE}"`
)
expect(
  'ExportOptions.plist App profile',
  exportPlist,
  new RegExp(`<string>${APP_PROFILE}</string>`),
  `ExportOptions must map ca.popuphub.app → "${APP_PROFILE}"`
)
expect(
  'ExportOptions.plist team',
  exportPlist,
  new RegExp(`<string>${TEAM_ID}</string>`),
  `teamID must be ${TEAM_ID}`
)
expect(
  'deploy.yml App profile secret validation',
  deployYml,
  /install_profile "\$APP_PROFILE_BASE64" "App" "PopupHub App Store"/,
  'CI must validate App profile name'
)
expect(
  'deploy.yml Widget profile secret validation',
  deployYml,
  /install_profile "\$WIDGET_PROFILE_BASE64" "Widget" "PopupHub Widget App Store"/,
  'CI must validate Widget profile name'
)
expect(
  'build-number.json iosBuild',
  String(buildMeta.iosBuild ?? ''),
  /^\d+$/,
  `iosBuild must be a positive integer (got ${buildMeta.iosBuild})`
)
expect(
  'pbxproj CURRENT_PROJECT_VERSION matches iosBuild',
  pbxproj,
  new RegExp(`CURRENT_PROJECT_VERSION = ${buildMeta.iosBuild};`),
  `All targets should use CURRENT_PROJECT_VERSION = ${buildMeta.iosBuild}`
)

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log('\nSigning config OK. GitHub secrets (manual):')
console.log('  BUILD_CERTIFICATE_BASE64, P12_PASSWORD')
console.log('  BUILD_PROVISION_PROFILE_BASE64, BUILD_WIDGET_PROVISION_PROFILE_BASE64')
console.log('  APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_API_KEY')
