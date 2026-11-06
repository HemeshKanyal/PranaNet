// PranaNet sensor firmware: read the Sharp dust sensor (+ DHT22 on device 1), average over an
// epoch, sign the reading with the device's secp256k1 key and POST it to the relayer.
// One sketch for both devices: set DEVICE to 1 or 2 (or pass -DDEVICE=n). Pins from docs/SPEC.md.
//
// The Sharp GP2Y1014AU0F is a PM proxy, not a calibrated PM2.5 counter. Its sensitivity is known
// (datasheet: 0.5 V per 0.1 mg/m3) but its zero is not, and indoor Mumbai air at boot is not clean.
// So we use a one-point field calibration: the output voltage averaged over the first ~10 s after
// boot is taken to mean CAL µg/m3, where CAL is the nearest reference station's PM2.5 at that time
// (set with `cal <ug>`, kept in NVS; default CAL_AMBIENT_UG from secrets.h). Reported value =
// CAL + (Vo - Vo_boot) x sensitivity, as both pm25_x10 and pm10_x10.
//
// Serial commands (115200, newline): help | addr | selftest | status | cal [ug] | newkey
// (newkey: fresh device key + nonce 0, for re-registering a slashed board in the demo)

#ifndef DEVICE
#define DEVICE 2
#endif

#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Preferences.h>
#include <WiFi.h>
#include <time.h>

#include "bootloader_random.h"
#include "esp_random.h"
#include "eth_sign.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#warning "firmware/prananet/secrets.h missing: using secrets.example.h placeholders (no Wi-Fi)"
#include "secrets.example.h"
#endif

// Board profiles. Both devices are classic ESP32 DevKit 30-pin boards (CP2102), FQBN
// esp32:esp32:esp32, wired D25 = Sharp LED (active LOW), D34 = Vo via 10k/22k divider (ADC1).
//   DEVICE 1: classic + DHT22 on D4
//   DEVICE 2: classic, no DHT22 (temp_x10 = hum_x10 = 0, never NaN)
// (Device 2 was an ESP32-S3 until Fri 6 Nov; that profile is gone.)
constexpr uint8_t PIN_SHARP_LED = 25;  // active LOW
constexpr uint8_t PIN_SHARP_VO = 34;   // ADC1 (input-only pin), via divider
#if DEVICE == 1
constexpr uint8_t PIN_DHT = 4;
#define HAS_DHT 1
#define DEVICE_ENS DEVICE1_ENS
#define DEVICE_GEOHASH DEVICE1_GEOHASH
#elif DEVICE == 2
#define HAS_DHT 0
#define DEVICE_ENS DEVICE2_ENS
#define DEVICE_GEOHASH DEVICE2_GEOHASH
#else
#error "DEVICE must be 1 or 2"
#endif
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "Both device profiles are for the classic ESP32 (FQBN esp32:esp32:esp32)"
#endif
// GPIO 6-11 drive the SPI flash on the classic ESP32: touching them crashes the board.
static_assert(!(PIN_SHARP_LED >= 6 && PIN_SHARP_LED <= 11) && !(PIN_SHARP_VO >= 6 && PIN_SHARP_VO <= 11), "GPIO 6-11 are the SPI flash");
#if HAS_DHT
static_assert(!(PIN_DHT >= 6 && PIN_DHT <= 11), "GPIO 6-11 are the SPI flash");
#endif

#if HAS_DHT
#include <DHT.h>
DHT dht(PIN_DHT, DHT22);
#endif

// ---------------------------------------------------------------- sensor
// Divider: 10k top, 22k bottom -> sensor Vo = Vadc * (10 + 22) / 22 (~x1.45)
constexpr float DIVIDER = (10.0f + 22.0f) / 22.0f;
// Datasheet typical sensitivity: 0.5 V per 0.1 mg/m3 -> 1 mV = 0.2 ug/m3.
constexpr float UG_PER_MV = 0.2f;
constexpr int SAMPLES = 100;               // 100 x 10 ms = ~1 s per averaged sample
constexpr uint32_t SAMPLE_DELAY_US = 280;  // read Vo 280 us after LED on
constexpr uint32_t PULSE_US = 320;         // total LED on time
constexpr uint32_t PERIOD_US = 10000;      // 10 ms sampling period
constexpr uint32_t BASELINE_MS = 10000;    // clean-air baseline window after boot

#ifndef CAL_AMBIENT_UG
#define CAL_AMBIENT_UG 0.0f
#endif
float baselineMv = NAN;
float calUg = CAL_AMBIENT_UG;  // PM2.5 (ug/m3) that the boot baseline stands for
double baselineSum = 0;
uint32_t baselineCount = 0;
uint32_t bootMs = 0;

// ---------------------------------------------------------------- identity
Preferences prefs;
uint8_t devPriv[32], devPub[64], devAddr[20];
char devAddrHex[43];  // 0x + 40
uint64_t lastNonce = 0;
uint8_t readingsContract[20];

// ---------------------------------------------------------------- epoch accumulator
uint64_t epochStart = 0;  // unix start of the current epoch window
double epSumMv = 0;
uint32_t epCount = 0;
double epSumT = 0, epSumH = 0;
uint32_t epCountTH = 0;
uint32_t lastDhtMs = 0;

static int hwRng(void *, unsigned char *out, size_t len) {
  esp_fill_random(out, len);
  return 0;
}

static void printAddress() {
  Serial.printf("DEVICE %d address %s\n", DEVICE, devAddrHex);
}

// First boot: generate the key from the hardware RNG with the internal entropy source enabled
// (RF and ADC are not running yet), store it in NVS. Later boots: load it.
static void setAddressFromKey() {
  if (!eth_derive(devPriv, devPub, devAddr)) {
    Serial.println("FATAL: key derivation failed");
    while (true) delay(1000);
  }
  devAddrHex[0] = '0';
  devAddrHex[1] = 'x';
  eth_hex(devAddr, 20, devAddrHex + 2);
}

// Demo reset (`newkey`): a fresh device identity so a slashed board can be re-registered under a
// new label. Wi-Fi/RF is running here, so esp_fill_random draws from the hardware TRNG.
static void newKey() {
  uint8_t k[32];
  do {
    esp_fill_random(k, 32);
  } while (!eth_priv_valid(k));
  memcpy(devPriv, k, 32);
  memset(k, 0, sizeof k);
  prefs.putBytes("priv", devPriv, 32);
  lastNonce = 0;
  prefs.putULong64("nonce", 0);
  setAddressFromKey();
  Serial.printf("NEWKEY DEVICE %d address %s nonce=0 (old key erased; register this address)\n", DEVICE, devAddrHex);
}

static void loadOrCreateKey() {
  prefs.begin("prananet", false);
  bool have = prefs.getBytesLength("priv") == 32 && prefs.getBytes("priv", devPriv, 32) == 32 && eth_priv_valid(devPriv);
  if (!have) {
    bootloader_random_enable();
    do {
      esp_fill_random(devPriv, 32);
    } while (!eth_priv_valid(devPriv));
    bootloader_random_disable();
    prefs.putBytes("priv", devPriv, 32);
    prefs.putULong64("nonce", 0);
    Serial.println("Generated new device key (stored in NVS).");
  }
  lastNonce = prefs.getULong64("nonce", 0);
  calUg = prefs.getFloat("cal", CAL_AMBIENT_UG);
  setAddressFromKey();
}

// One Sharp sample: LED on (LOW), sample at 280 us, LED off, wait out the 10 ms period.
static uint32_t sharpSample() {
  uint32_t t0 = micros();
  digitalWrite(PIN_SHARP_LED, LOW);
  while (micros() - t0 < SAMPLE_DELAY_US) {}
  uint32_t mv = analogReadMilliVolts(PIN_SHARP_VO);
  while (micros() - t0 < PULSE_US) {}
  digitalWrite(PIN_SHARP_LED, HIGH);
  while (micros() - t0 < PERIOD_US) { yield(); }
  return mv;
}

// Average SAMPLES pulses; returns sensor-side Vo in mV.
static float sharpAverageMv() {
  uint32_t sum = 0;
  for (int i = 0; i < SAMPLES; ++i) sum += sharpSample();
  return (float)sum / SAMPLES * DIVIDER;
}

static bool timeValid() { return time(nullptr) > 1700000000; }

// Fixed cross-implementation vector (relayer/test/vector.json); Hardhat test key #0 is public.
static void selftest() {
  uint8_t priv[32], pub[64], addr[20], msg[32], dig[32], sig[65];
  eth_unhex("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", priv, 32);
  uint32_t t0 = millis();
  bool ok = eth_derive(priv, pub, addr);
  EthReading r{};
  memcpy(r.device, addr, 20);
  r.epoch = 1762360200;
  r.pm25_x10 = 423;
  r.pm10_x10 = 610;
  r.temp_x10 = -15;
  r.hum_x10 = 640;
  r.nonce = 17;
  r.chain_id = 11155111;
  eth_unhex("5FbDB2315678afecb367f032d93F642f64180aa3", r.contract, 20);
  eth_reading_digest(&r, msg, dig);
  uint32_t t1 = millis();
  ok = ok && eth_sign_digest(priv, pub, dig, sig);
  uint32_t t2 = millis();
  char a[41], m[65], d[65], s[131];
  eth_hex(addr, 20, a);
  eth_hex(msg, 32, m);
  eth_hex(dig, 32, d);
  eth_hex(sig, 65, s);
  Serial.printf("{\"selftest\":true,\"ok\":%s,\"address\":\"0x%s\",\"message\":\"0x%s\",\"digest\":\"0x%s\",\"signature\":\"0x%s\",\"sign_ms\":%lu}\n",
                ok ? "true" : "false", a, m, d, s, (unsigned long)(t2 - t1));
}

static void status() {
  Serial.printf("dev=%d addr=%s wifi=%s ip=%s time=%s nonce=%llu base=%.0fmV cal=%.1fug/m3 epoch=%us\n", DEVICE, devAddrHex,
                WiFi.isConnected() ? "up" : "down", WiFi.localIP().toString().c_str(), timeValid() ? "ok" : "unsynced",
                (unsigned long long)lastNonce, baselineMv, calUg, (unsigned)EPOCH_SECONDS);
}

static void handleSerial() {
  static String line;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c != '\n') {
      if (line.length() < 64) line += c;
      continue;
    }
    line.trim();
    if (line == "addr") printAddress();
    else if (line == "selftest") selftest();
    else if (line == "status") status();
    else if (line == "newkey") newKey();
    else if (line == "cal") Serial.printf("cal=%.1fug/m3 (boot baseline %.0f mV stands for this)\n", calUg, baselineMv);
    else if (line.startsWith("cal ")) {
      float v = line.substring(4).toFloat();
      if (v >= 0 && v < 1000) {
        calUg = v;
        prefs.putFloat("cal", calUg);
        Serial.printf("cal set to %.1fug/m3 (saved)\n", calUg);
      } else Serial.println("cal: expected 0..999 ug/m3");
    }
    else if (line.length()) Serial.println("commands: addr | selftest | status | cal [ug] | newkey");
    line = "";
  }
}

static int postReading(const char *json, String &resp) {
  if (!WiFi.isConnected()) return -100;
  HTTPClient http;
  NetworkClientSecure tls;
  NetworkClient plain;
  bool https = strncmp(RELAYER_URL, "https://", 8) == 0;
  // The payload is signed end to end, so TLS only protects transport: certificate checks are
  // skipped to keep the firmware independent of the tunnel's CA. The relayer can't alter values.
  if (https) tls.setInsecure();
  if (!http.begin(https ? (NetworkClient &)tls : plain, RELAYER_URL)) return -101;
  http.setTimeout(10000);
  http.addHeader("content-type", "application/json");
  int code = http.POST(String(json));
  resp = code > 0 ? http.getString() : http.errorToString(code);
  http.end();
  return code;
}

static void finishEpoch(uint64_t epoch) {
  if (epCount == 0) return;
  float avgMv = epSumMv / epCount;
  float dust = calUg + (avgMv - baselineMv) * UG_PER_MV;
  if (dust < 0) dust = 0;

  EthReading r{};
  memcpy(r.device, devAddr, 20);
  r.epoch = epoch;
  r.pm25_x10 = (uint64_t)lroundf(dust * 10);  // PM proxy, same value for both fields
  r.pm10_x10 = r.pm25_x10;
#if HAS_DHT
  r.temp_x10 = epCountTH ? (int64_t)llround(epSumT / epCountTH * 10) : 0;
  r.hum_x10 = epCountTH ? (uint64_t)llround(epSumH / epCountTH * 10) : 0;
#else
  r.temp_x10 = 0;
  r.hum_x10 = 0;
#endif
  r.nonce = lastNonce + 1;
  r.chain_id = CHAIN_ID;
  memcpy(r.contract, readingsContract, 20);

  // Persist the nonce before it leaves the device so a reboot never reuses it.
  lastNonce = r.nonce;
  prefs.putULong64("nonce", lastNonce);

  uint8_t msg[32], dig[32], sig[65];
  eth_reading_digest(&r, msg, dig);
  if (!eth_sign_digest(devPriv, devPub, dig, sig)) {
    Serial.println("EPOCH sign failed");
    return;
  }
  char sigHex[131];
  eth_hex(sig, 65, sigHex);

  char json[640];
  snprintf(json, sizeof json,
           "{\"device\":\"%s\",\"ens\":\"%s\",\"geohash\":\"%s\",\"epoch\":%llu,\"pm25_x10\":%llu,\"pm10_x10\":%llu,"
           "\"temp_x10\":%lld,\"hum_x10\":%llu,\"nonce\":%llu,\"signature\":\"0x%s\",\"simulated\":false,\"baseline_mv\":%ld}",
           devAddrHex, DEVICE_ENS, DEVICE_GEOHASH, (unsigned long long)r.epoch, (unsigned long long)r.pm25_x10,
           (unsigned long long)r.pm10_x10, (long long)r.temp_x10, (unsigned long long)r.hum_x10,
           (unsigned long long)r.nonce, sigHex, isnan(baselineMv) ? 0L : (long)lroundf(baselineMv));

  String resp;
  int code = postReading(json, resp);
  Serial.printf("EPOCH %llu nonce=%llu vo=%.0fmV base=%.0fmV pm_proxy=%.1fug/m3 temp_x10=%lld hum_x10=%llu n=%lu sig=0x%.10s… http=%d %s\n",
                (unsigned long long)epoch, (unsigned long long)r.nonce, avgMv, baselineMv, dust, (long long)r.temp_x10,
                (unsigned long long)r.hum_x10, (unsigned long)epCount, sigHex, code, resp.substring(0, 120).c_str());
  Serial.printf("READING %s\n", json);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.printf("\nPranaNet device %d booting\n", DEVICE);

  eth_set_rng(hwRng, nullptr);
  loadOrCreateKey();  // before ADC/Wi-Fi: uses the internal entropy source on first boot
  printAddress();
  if (!eth_unhex(READINGS_ADDRESS, readingsContract, 20)) Serial.println("WARN: READINGS_ADDRESS invalid");

  pinMode(PIN_SHARP_LED, OUTPUT);
  digitalWrite(PIN_SHARP_LED, HIGH);  // LED off
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_SHARP_VO, ADC_11db);
#if HAS_DHT
  dht.begin();
#endif

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  bootMs = millis();
  Serial.printf("Measuring clean-air baseline for %lu s, epoch %u s. Type 'help' for commands.\n",
                (unsigned long)(BASELINE_MS / 1000), (unsigned)EPOCH_SECONDS);
}

void loop() {
  handleSerial();
  float voMv = sharpAverageMv();  // ~1 s, paces the loop
  handleSerial();

#if HAS_DHT
  if (lastDhtMs == 0 || millis() - lastDhtMs >= 2000) {  // DHT22 needs >= 2 s between reads
    float t = dht.readTemperature(), h = dht.readHumidity();
    lastDhtMs = millis();
    if (!isnan(t) && !isnan(h)) {
      epSumT += t;
      epSumH += h;
      epCountTH++;
    }
  }
#endif

  if (millis() - bootMs < BASELINE_MS) {
    baselineSum += voMv;
    baselineCount++;
    Serial.printf("CAL vo=%.0fmV n=%lu\n", voMv, (unsigned long)baselineCount);
    return;
  }
  if (isnan(baselineMv)) {
    baselineMv = baselineCount ? (float)(baselineSum / baselineCount) : voMv;
    Serial.printf("Baseline set: %.0f mV (%lu samples)\n", baselineMv, (unsigned long)baselineCount);
  }

  if (!timeValid()) {
    static uint32_t lastWarn = 0;
    if (millis() - lastWarn > 5000) {
      lastWarn = millis();
      Serial.printf("waiting for Wi-Fi/NTP (wifi=%s) vo=%.0fmV\n", WiFi.isConnected() ? "up" : "down", voMv);
    }
    return;
  }

  uint64_t now = (uint64_t)time(nullptr);
  uint64_t window = now - now % EPOCH_SECONDS;
  if (epochStart == 0) epochStart = window;  // first (partial) window
  if (window != epochStart) {
    finishEpoch(epochStart);  // epoch id = window start (unix seconds)
    epochStart = window;
    epSumMv = 0;
    epCount = 0;
    epSumT = epSumH = 0;
    epCountTH = 0;
  }
  epSumMv += voMv;
  epCount++;
}
