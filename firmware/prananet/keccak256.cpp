// Keccak-f[1600] with rate 136 bytes (Keccak-256). Lanes are little-endian; byte-wise
// absorb/squeeze below makes this endian-independent.
#include "keccak256.h"

#include <string.h>

static const uint64_t RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL, 0x8000000080008000ULL,
    0x000000000000808bULL, 0x0000000080000001ULL, 0x8000000080008081ULL, 0x8000000000008009ULL,
    0x000000000000008aULL, 0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL, 0x8000000000008003ULL,
    0x8000000000008002ULL, 0x8000000000000080ULL, 0x000000000000800aULL, 0x800000008000000aULL,
    0x8000000080008081ULL, 0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL};
static const uint8_t ROTC[24] = {1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
                                 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44};
static const uint8_t PILN[24] = {10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
                                 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1};

static inline uint64_t rotl(uint64_t x, unsigned n) { return (x << n) | (x >> (64 - n)); }

static void keccakf(uint64_t st[25]) {
  uint64_t bc[5], t;
  for (int round = 0; round < 24; ++round) {
    for (int i = 0; i < 5; ++i) bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
    for (int i = 0; i < 5; ++i) {
      t = bc[(i + 4) % 5] ^ rotl(bc[(i + 1) % 5], 1);
      for (int j = 0; j < 25; j += 5) st[j + i] ^= t;
    }
    t = st[1];
    for (int i = 0; i < 24; ++i) {
      int j = PILN[i];
      bc[0] = st[j];
      st[j] = rotl(t, ROTC[i]);
      t = bc[0];
    }
    for (int j = 0; j < 25; j += 5) {
      for (int i = 0; i < 5; ++i) bc[i] = st[j + i];
      for (int i = 0; i < 5; ++i) st[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
    }
    st[0] ^= RC[round];
  }
}

static const size_t RATE = 136;

static inline void xor_byte(uint64_t st[25], size_t i, uint8_t b) {
  st[i / 8] ^= (uint64_t)b << (8 * (i % 8));
}

void keccak256_init(Keccak256 *k) {
  memset(k->st, 0, sizeof(k->st));
  k->pos = 0;
}

void keccak256_update(Keccak256 *k, const uint8_t *data, size_t len) {
  for (size_t n = 0; n < len; ++n) {
    xor_byte(k->st, k->pos++, data[n]);
    if (k->pos == RATE) {
      keccakf(k->st);
      k->pos = 0;
    }
  }
}

void keccak256_final(Keccak256 *k, uint8_t out[32]) {
  xor_byte(k->st, k->pos, 0x01);
  xor_byte(k->st, RATE - 1, 0x80);
  keccakf(k->st);
  for (size_t i = 0; i < 32; ++i) out[i] = (uint8_t)(k->st[i / 8] >> (8 * (i % 8)));
}

void keccak256(const uint8_t *data, size_t len, uint8_t out[32]) {
  Keccak256 k;
  keccak256_init(&k);
  keccak256_update(&k, data, len);
  keccak256_final(&k, out);
}
