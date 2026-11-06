// secp256k1 Ethereum signing on top of mbedTLS (bundled with the Arduino-ESP32 core).
// Deterministic RFC 6979 nonces (HMAC-SHA256), low-s, 65-byte r || s || v with v = 27/28.
#pragma once
#include <stddef.h>
#include <stdint.h>

// RNG used only for mbedTLS side-channel blinding (not for nonces). Must be set before use.
typedef int (*eth_rng_t)(void *ctx, unsigned char *out, size_t len);
void eth_set_rng(eth_rng_t rng, void *ctx);

// 1 <= priv < n
bool eth_priv_valid(const uint8_t priv[32]);
// pub = 64-byte X || Y, addr = last 20 bytes of keccak256(pub).
bool eth_derive(const uint8_t priv[32], uint8_t pub[64], uint8_t addr[20]);
// keccak256("\x19Ethereum Signed Message:\n32" || hash)
void eth_personal_digest(const uint8_t hash[32], uint8_t out[32]);
// Sign a 32-byte digest. pub is the key's 64-byte public key (used to compute v).
bool eth_sign_digest(const uint8_t priv[32], const uint8_t pub[64], const uint8_t digest[32],
                     uint8_t sig[65]);

// Packed reading message, matching contracts/src/Readings.sol messageOf(): 264 bytes.
struct EthReading {
  uint8_t device[20];
  uint64_t epoch;
  uint64_t pm25_x10;
  uint64_t pm10_x10;
  int64_t temp_x10;  // sign-extended to int256
  uint64_t hum_x10;
  uint64_t nonce;
  uint64_t chain_id;
  uint8_t contract[20];
};
static const size_t ETH_READING_PACKED_LEN = 264;
void eth_pack_reading(const EthReading *r, uint8_t out[ETH_READING_PACKED_LEN]);
// message = keccak256(packed); digest = EIP-191 of message.
void eth_reading_digest(const EthReading *r, uint8_t message[32], uint8_t digest[32]);

void eth_hex(const uint8_t *data, size_t len, char *out);  // out: 2*len + 1, lowercase, no 0x
bool eth_unhex(const char *hex, uint8_t *out, size_t len);  // accepts optional 0x
