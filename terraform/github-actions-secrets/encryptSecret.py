#!/usr/bin/env python3

import base64
import sys

from nacl.public import PublicKey, SealedBox


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: encryptSecret.py <base64-public-key>")

    public_key = PublicKey(base64.b64decode(sys.argv[1]))
    plaintext = sys.stdin.buffer.read()
    if not plaintext:
        raise SystemExit("refusing to encrypt an empty secret")

    ciphertext = SealedBox(public_key).encrypt(plaintext)
    print(base64.b64encode(ciphertext).decode("ascii"))


if __name__ == "__main__":
    main()
