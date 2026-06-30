#!/usr/bin/env bash
# Audit local Apple signing assets before updating GitHub secrets.
# Run on macOS after downloading profiles from developer.apple.com.
#
# Usage:
#   ./scripts/mobile/audit-apple-signing-assets.sh dist.p12 PopupHub_App_Store.mobileprovision PopupHub_Widget_App_Store.mobileprovision
#
# Exits 0 when all checks pass; prints SHA-1 fingerprint to align cert + profiles.

set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <distribution.p12> <app.mobileprovision> <widget.mobileprovision> [p12_password]" >&2
  exit 1
fi

P12_PATH="$1"
APP_PROFILE="$2"
WIDGET_PROFILE="$3"
P12_PASSWORD="${4:-}"

if [ ! -f "$P12_PATH" ]; then
  echo "::error::Missing .p12: $P12_PATH" >&2
  exit 1
fi

cert_fingerprint() {
  local p12="$1" pass="$2"
  if [ -n "$pass" ]; then
    openssl pkcs12 -in "$p12" -clcerts -nokeys -passin "pass:$pass" 2>/dev/null \
      | openssl x509 -noout -fingerprint -sha1
  else
    openssl pkcs12 -in "$p12" -clcerts -nokeys -nodes 2>/dev/null \
      | openssl x509 -noout -fingerprint -sha1
  fi | sed 's/SHA1 Fingerprint=//;s/://g' | tr '[:lower:]' '[:upper:]'
}

profile_fingerprint() {
  local profile="$1"
  python3 - "$profile" <<'PY'
import plistlib, subprocess, sys, tempfile, os

profile_path = sys.argv[1]
plist_xml = subprocess.check_output(["security", "cms", "-D", "-i", profile_path])
plist = plistlib.loads(plist_xml)
cert_der = plist["DeveloperCertificates"][0]
with tempfile.NamedTemporaryFile(suffix=".der", delete=False) as tf:
    tf.write(cert_der)
    cert_path = tf.name
try:
    out = subprocess.check_output(
        ["openssl", "x509", "-inform", "DER", "-in", cert_path, "-noout", "-fingerprint", "-sha1"],
        text=True,
    )
    print(out.split("=", 1)[1].strip().replace(":", "").upper())
finally:
    os.unlink(cert_path)
PY
}

audit_profile() {
  local profile="$1" label="$2" expected_fp="$3"
  local plist name fp

  if [ ! -f "$profile" ]; then
    echo "::error::Missing profile: $profile" >&2
    exit 1
  fi

  plist="$(mktemp)"
  security cms -D -i "$profile" > "$plist"

  name=$(/usr/libexec/PlistBuddy -c 'Print :Name' "$plist")
  echo "[$label] name=$name"

  if /usr/libexec/PlistBuddy -c 'Print :ProvisionedDevices' "$plist" >/dev/null 2>&1; then
    echo "::error::[$label] profile '$name' is Development or Ad Hoc (has ProvisionedDevices). Create an App Store profile instead." >&2
    rm -f "$plist"
    exit 1
  fi

  if /usr/libexec/PlistBuddy -c 'Print :Entitlements:get-task-allow' "$plist" 2>/dev/null | grep -q true; then
    echo "::error::[$label] profile '$name' has get-task-allow=true (Development signing)." >&2
    rm -f "$plist"
    exit 1
  fi

  fp=$(profile_fingerprint "$profile")
  echo "[$label] cert SHA-1: $fp"

  if [ "$fp" != "$expected_fp" ]; then
    echo "::error::[$label] profile cert SHA-1 ($fp) does not match .p12 ($expected_fp). Regenerate the profile in the Apple portal against the same Distribution certificate." >&2
    rm -f "$plist"
    exit 1
  fi

  rm -f "$plist"
  echo "[$label] OK — App Store profile, cert aligned"
}

echo "Checking Distribution .p12 subject..."
SUBJECT=$(openssl pkcs12 -in "$P12_PATH" -clcerts -nokeys -passin "pass:${P12_PASSWORD}" 2>/dev/null \
  | openssl x509 -noout -subject 2>/dev/null || true)
if echo "$SUBJECT" | grep -qi 'Apple Development'; then
  echo "::error::.p12 is an Apple Development certificate, not Apple Distribution. Export the Distribution identity from Keychain Access." >&2
  exit 1
fi
if ! echo "$SUBJECT" | grep -qi 'Apple Distribution'; then
  echo "::warning::Could not confirm Apple Distribution in subject: $SUBJECT"
fi

P12_FP=$(cert_fingerprint "$P12_PATH" "$P12_PASSWORD")
echo "Distribution .p12 SHA-1: $P12_FP"
echo ""

audit_profile "$APP_PROFILE" "App" "$P12_FP"
audit_profile "$WIDGET_PROFILE" "Widget" "$P12_FP"

echo ""
echo "All signing assets OK. Update GitHub secrets:"
echo "  base64 -i $P12_PATH | pbcopy  → BUILD_CERTIFICATE_BASE64"
echo "  base64 -i $APP_PROFILE | pbcopy  → BUILD_PROVISION_PROFILE_BASE64"
echo "  base64 -i $WIDGET_PROFILE | pbcopy  → BUILD_WIDGET_PROVISION_PROFILE_BASE64"
