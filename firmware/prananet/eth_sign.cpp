#include "eth_sign.h"

#include <string.h>

#include "keccak256.h"
#include "mbedtls/bignum.h"
#include "mbedtls/ecdsa.h"
#include "mbedtls/ecp.h"

static eth_rng_t g_rng = nullptr;
static void *g_rng_ctx = nullptr;

void eth_set_rng(eth_rng_t rng, void *ctx) {
  g_rng = rng;
  g_rng_ctx = ctx;
}

#define CHK(x)          \
  do {                  \
    if ((x) != 0) {     \
      ok = false;       \
      goto cleanup;     \
    }                   \
  } while (0)

bool eth_priv_valid(const uint8_t priv[32]) {
  mbedtls_ecp_group grp;
  mbedtls_mpi d;
  bool ok = true;
  mbedtls_ecp_group_init(&grp);
  mbedtls_mpi_init(&d);
  CHK(mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1));
  CHK(mbedtls_mpi_read_binary(&d, priv, 32));
  CHK(mbedtls_ecp_check_privkey(&grp, &d));
cleanup:
  mbedtls_mpi_free(&d);
  mbedtls_ecp_group_free(&grp);
  return ok;
}

static bool point_to_xy(const mbedtls_ecp_group *grp, const mbedtls_ecp_point *P, uint8_t xy[64]) {
  uint8_t buf[65];
  size_t olen = 0;
  if (mbedtls_ecp_point_write_binary(grp, P, MBEDTLS_ECP_PF_UNCOMPRESSED, &olen, buf, sizeof buf) != 0 ||
      olen != 65)
    return false;
  memcpy(xy, buf + 1, 64);
  return true;
}

bool eth_derive(const uint8_t priv[32], uint8_t pub[64], uint8_t addr[20]) {
  if (!g_rng) return false;
  mbedtls_ecp_group grp;
  mbedtls_mpi d;
  mbedtls_ecp_point Q;
  uint8_t h[32];
  bool ok = true;
  mbedtls_ecp_group_init(&grp);
  mbedtls_mpi_init(&d);
  mbedtls_ecp_point_init(&Q);
  CHK(mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1));
  CHK(mbedtls_mpi_read_binary(&d, priv, 32));
  CHK(mbedtls_ecp_check_privkey(&grp, &d));
  CHK(mbedtls_ecp_mul(&grp, &Q, &d, &grp.G, g_rng, g_rng_ctx));
  if (!point_to_xy(&grp, &Q, pub)) {
    ok = false;
    goto cleanup;
  }
  keccak256(pub, 64, h);
  memcpy(addr, h + 12, 20);
cleanup:
  mbedtls_ecp_point_free(&Q);
  mbedtls_mpi_free(&d);
  mbedtls_ecp_group_free(&grp);
  return ok;
}

void eth_personal_digest(const uint8_t hash[32], uint8_t out[32]) {
  static const char PREFIX[] = "\x19" "Ethereum Signed Message:\n32";
  Keccak256 k;
  keccak256_init(&k);
  keccak256_update(&k, (const uint8_t *)PREFIX, sizeof(PREFIX) - 1);
  keccak256_update(&k, hash, 32);
  keccak256_final(&k, out);
}

// Recover the public key for (r, s, recid) and compare with `pub`.
// R.x = r (recid 2/3, where R.x >= n, has probability ~2^-128 and is not handled).
// y = (x^3 + 7)^((p + 1) / 4) mod p since p = 3 mod 4; pick the parity given by recid.
// Q = r^-1 (s R - z G) = (s r^-1) R + (-z r^-1) G.
static bool recovers_to(mbedtls_ecp_group *grp, const mbedtls_mpi *r, const mbedtls_mpi *s,
                        const mbedtls_mpi *z, int recid, const uint8_t pub[64]) {
  mbedtls_mpi x3, y, e, rinv, u1, u2, tmp;
  mbedtls_ecp_point R, Q;
  uint8_t buf[65], got[64];
  bool ok = true;
  mbedtls_mpi_init(&x3);
  mbedtls_mpi_init(&y);
  mbedtls_mpi_init(&e);
  mbedtls_mpi_init(&rinv);
  mbedtls_mpi_init(&u1);
  mbedtls_mpi_init(&u2);
  mbedtls_mpi_init(&tmp);
  mbedtls_ecp_point_init(&R);
  mbedtls_ecp_point_init(&Q);

  // y^2 = x^3 + 7
  CHK(mbedtls_mpi_mul_mpi(&x3, r, r));
  CHK(mbedtls_mpi_mul_mpi(&x3, &x3, r));
  CHK(mbedtls_mpi_add_int(&x3, &x3, 7));
  CHK(mbedtls_mpi_mod_mpi(&x3, &x3, &grp->P));
  CHK(mbedtls_mpi_add_int(&e, &grp->P, 1));
  CHK(mbedtls_mpi_shift_r(&e, 2));
  CHK(mbedtls_mpi_exp_mod(&y, &x3, &e, &grp->P, nullptr));
  if (mbedtls_mpi_get_bit(&y, 0) != (size_t)(recid & 1)) CHK(mbedtls_mpi_sub_mpi(&y, &grp->P, &y));

  buf[0] = 0x04;
  CHK(mbedtls_mpi_write_binary(r, buf + 1, 32));
  CHK(mbedtls_mpi_write_binary(&y, buf + 33, 32));
  CHK(mbedtls_ecp_point_read_binary(grp, &R, buf, 65));
  CHK(mbedtls_ecp_check_pubkey(grp, &R));  // r is not a valid x: no point

  CHK(mbedtls_mpi_inv_mod(&rinv, r, &grp->N));
  CHK(mbedtls_mpi_mul_mpi(&u2, s, &rinv));
  CHK(mbedtls_mpi_mod_mpi(&u2, &u2, &grp->N));
  CHK(mbedtls_mpi_mul_mpi(&tmp, z, &rinv));
  CHK(mbedtls_mpi_mod_mpi(&tmp, &tmp, &grp->N));
  CHK(mbedtls_mpi_sub_mpi(&u1, &grp->N, &tmp));
  CHK(mbedtls_mpi_mod_mpi(&u1, &u1, &grp->N));
  CHK(mbedtls_ecp_muladd(grp, &Q, &u2, &R, &u1, &grp->G));
  if (!point_to_xy(grp, &Q, got) || memcmp(got, pub, 64) != 0) ok = false;

cleanup:
  mbedtls_ecp_point_free(&Q);
  mbedtls_ecp_point_free(&R);
  mbedtls_mpi_free(&tmp);
  mbedtls_mpi_free(&u2);
  mbedtls_mpi_free(&u1);
  mbedtls_mpi_free(&rinv);
  mbedtls_mpi_free(&e);
  mbedtls_mpi_free(&y);
  mbedtls_mpi_free(&x3);
  return ok;
}

bool eth_sign_digest(const uint8_t priv[32], const uint8_t pub[64], const uint8_t digest[32],
                     uint8_t sig[65]) {
  if (!g_rng) return false;
  mbedtls_ecp_group grp;
  mbedtls_mpi d, r, s, z, half;
  int recid = -1;
  bool ok = true;
  mbedtls_ecp_group_init(&grp);
  mbedtls_mpi_init(&d);
  mbedtls_mpi_init(&r);
  mbedtls_mpi_init(&s);
  mbedtls_mpi_init(&z);
  mbedtls_mpi_init(&half);

  CHK(mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1));
  CHK(mbedtls_mpi_read_binary(&d, priv, 32));
  CHK(mbedtls_ecp_check_privkey(&grp, &d));
  // RFC 6979 deterministic k with HMAC-SHA256 (same as viem / noble-secp256k1).
  CHK(mbedtls_ecdsa_sign_det_ext(&grp, &r, &s, &d, digest, 32, MBEDTLS_MD_SHA256, g_rng, g_rng_ctx));

  // Low-s (EIP-2): s > n/2 -> s = n - s.
  CHK(mbedtls_mpi_copy(&half, &grp.N));
  CHK(mbedtls_mpi_shift_r(&half, 1));
  if (mbedtls_mpi_cmp_mpi(&s, &half) > 0) CHK(mbedtls_mpi_sub_mpi(&s, &grp.N, &s));

  CHK(mbedtls_mpi_read_binary(&z, digest, 32));
  CHK(mbedtls_mpi_mod_mpi(&z, &z, &grp.N));
  for (int i = 0; i < 2 && recid < 0; ++i)
    if (recovers_to(&grp, &r, &s, &z, i, pub)) recid = i;
  if (recid < 0) {
    ok = false;
    goto cleanup;
  }

  CHK(mbedtls_mpi_write_binary(&r, sig, 32));
  CHK(mbedtls_mpi_write_binary(&s, sig + 32, 32));
  sig[64] = (uint8_t)(27 + recid);

cleanup:
  mbedtls_mpi_free(&half);
  mbedtls_mpi_free(&z);
  mbedtls_mpi_free(&s);
  mbedtls_mpi_free(&r);
  mbedtls_mpi_free(&d);
  mbedtls_ecp_group_free(&grp);
  return ok;
}

// Big-endian 32-byte word; negative values are sign-extended (two's complement int256).
static void put_word(uint8_t *out, uint64_t v, bool negative) {
  memset(out, negative ? 0xff : 0x00, 24);
  for (int i = 0; i < 8; ++i) out[31 - i] = (uint8_t)(v >> (8 * i));
}

void eth_pack_reading(const EthReading *r, uint8_t out[ETH_READING_PACKED_LEN]) {
  uint8_t *p = out;
  memcpy(p, r->device, 20);
  p += 20;
  put_word(p, r->epoch, false);
  p += 32;
  put_word(p, r->pm25_x10, false);
  p += 32;
  put_word(p, r->pm10_x10, false);
  p += 32;
  put_word(p, (uint64_t)r->temp_x10, r->temp_x10 < 0);
  p += 32;
  put_word(p, r->hum_x10, false);
  p += 32;
  put_word(p, r->nonce, false);
  p += 32;
  put_word(p, r->chain_id, false);
  p += 32;
  memcpy(p, r->contract, 20);
}

void eth_reading_digest(const EthReading *r, uint8_t message[32], uint8_t digest[32]) {
  uint8_t packed[ETH_READING_PACKED_LEN];
  eth_pack_reading(r, packed);
  keccak256(packed, sizeof packed, message);
  eth_personal_digest(message, digest);
}

void eth_hex(const uint8_t *data, size_t len, char *out) {
  static const char H[] = "0123456789abcdef";
  for (size_t i = 0; i < len; ++i) {
    out[2 * i] = H[data[i] >> 4];
    out[2 * i + 1] = H[data[i] & 15];
  }
  out[2 * len] = 0;
}

static int nib(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

bool eth_unhex(const char *hex, uint8_t *out, size_t len) {
  if (hex[0] == '0' && (hex[1] == 'x' || hex[1] == 'X')) hex += 2;
  if (strlen(hex) != 2 * len) return false;
  for (size_t i = 0; i < len; ++i) {
    int a = nib(hex[2 * i]), b = nib(hex[2 * i + 1]);
    if (a < 0 || b < 0) return false;
    out[i] = (uint8_t)(a << 4 | b);
  }
  return true;
}
