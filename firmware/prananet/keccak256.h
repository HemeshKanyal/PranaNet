// Keccak-256 as used by Ethereum (original Keccak padding 0x01, not FIPS SHA3-256's 0x06).
// Written for PranaNet from the Keccak reference (keccak.team); MIT, see repo LICENSE.
#pragma once
#include <stddef.h>
#include <stdint.h>

void keccak256(const uint8_t *data, size_t len, uint8_t out[32]);

// Incremental interface.
struct Keccak256 {
  uint64_t st[25];
  size_t pos;
};
void keccak256_init(Keccak256 *k);
void keccak256_update(Keccak256 *k, const uint8_t *data, size_t len);
void keccak256_final(Keccak256 *k, uint8_t out[32]);
