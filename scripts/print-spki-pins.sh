#!/usr/bin/env bash
# Prints the base64 SHA-256 SPKI hash of every certificate the API host sends, leaf first.
# Run on your own computer (needs openssl). Usage: scripts/print-spki-pins.sh [host]
#
# Pin the INTERMEDIATE (second line) and one backup, never only the leaf. Then:
#   npx eas-cli env:create --name API_PINS --value "<pin1>,<pin2>" --environment preview --visibility plaintext
# Build a preview, install it, and confirm sign-in works before you set it for production.
set -euo pipefail
host="${1:-wellirecordmobileapp.onrender.com}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
openssl s_client -showcerts -servername "$host" -connect "$host:443" </dev/null 2>/dev/null \
  | awk -v d="$tmp" '/BEGIN CERTIFICATE/{n++; f=sprintf("%s/c%d.pem", d, n)} n{print > f} /END CERTIFICATE/{close(f)}'
i=0
for f in "$tmp"/c*.pem; do
  i=$((i+1))
  subj="$(openssl x509 -in "$f" -noout -subject | sed 's/^subject= *//')"
  pin="$(openssl x509 -in "$f" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl base64)"
  printf '%d  %s  %s\n' "$i" "$pin" "$subj"
done
