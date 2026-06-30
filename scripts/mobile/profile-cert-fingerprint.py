#!/usr/bin/env python3
"""Print SHA-1 fingerprint of the signing cert embedded in an iOS .mobileprovision."""
import os
import plistlib
import subprocess
import sys
import tempfile


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: profile-cert-fingerprint.py <profile.mobileprovision>", file=sys.stderr)
        return 1

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
        fp = out.split("=", 1)[1].strip().replace(":", "").upper()
        print(fp)
        return 0
    finally:
        os.unlink(cert_path)


if __name__ == "__main__":
    raise SystemExit(main())
