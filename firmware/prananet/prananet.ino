// PranaNet sensor firmware (milestone 0: read sensors, print status; no signing/networking yet).
// One sketch for both devices: set DEVICE to 1 or 2 below. Pins and divider from docs/SPEC.md.
//
// Sharp GP2Y1014AU0F is a PM proxy, not a calibrated PM2.5 counter. Clean-air output differs per
// unit, so we measure a baseline over the first ~10 s after boot and report the rise above it.

#ifndef DEVICE
#define DEVICE 2
#endif

#if DEVICE == 1
// ESP32 DevKit 30-pin (CP2102)
constexpr uint8_t PIN_SHARP_LED = 25;  // active LOW
constexpr uint8_t PIN_SHARP_VO = 34;   // ADC1, via divider
constexpr uint8_t PIN_DHT = 4;
#define HAS_DHT 1
#elif DEVICE == 2
// ESP32-S3-N16R8 (CH343 port, CDC On Boot disabled)
constexpr uint8_t PIN_SHARP_LED = 6;   // active LOW
constexpr uint8_t PIN_SHARP_VO = 4;    // ADC1, via divider
#define HAS_DHT 0
#else
#error "DEVICE must be 1 or 2"
#endif

#if HAS_DHT
#include <DHT.h>
DHT dht(PIN_DHT, DHT22);
#endif

// Divider: 10k top, 22k bottom -> sensor Vo = Vadc * (10 + 22) / 22 (~x1.45)
constexpr float DIVIDER = (10.0f + 22.0f) / 22.0f;
// Datasheet typical sensitivity: 0.5 V per 0.1 mg/m3 -> 1 mV = 0.2 ug/m3.
constexpr float UG_PER_MV = 0.2f;

constexpr int SAMPLES = 100;              // 100 x 10 ms = ~1 s per averaged reading
constexpr uint32_t SAMPLE_DELAY_US = 280;   // read Vo 280 us after LED on
constexpr uint32_t PULSE_US = 320;          // total LED on time
constexpr uint32_t PERIOD_US = 10000;       // 10 ms sampling period
constexpr uint32_t BASELINE_MS = 10000;     // clean-air baseline window after boot

float baselineMv = NAN;   // sensor-side Vo (after undoing the divider), in mV
double baselineSum = 0;
uint32_t baselineCount = 0;
uint32_t bootMs = 0;
float lastTempC = NAN, lastHum = NAN;
uint32_t lastDhtMs = 0;

// One Sharp sample: LED on (LOW), sample at 280 us, LED off, wait out the 10 ms period.
// Returns ADC-pin millivolts (calibrated by the ESP32 core).
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

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_SHARP_LED, OUTPUT);
  digitalWrite(PIN_SHARP_LED, HIGH);  // LED off
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_SHARP_VO, ADC_11db);  // full ~0-3.1 V range

#if HAS_DHT
  dht.begin();
#endif

  bootMs = millis();
  Serial.printf("\nPranaNet device %d booted. Measuring clean-air baseline for %lu s...\n", DEVICE,
                (unsigned long)(BASELINE_MS / 1000));
}

void loop() {
  float voMv = sharpAverageMv();  // takes ~1 s, paces the loop
  uint32_t upS = (millis() - bootMs) / 1000;

#if HAS_DHT
  // DHT22 needs >= 2 s between reads.
  if (lastDhtMs == 0 || millis() - lastDhtMs >= 2000) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    lastDhtMs = millis();
    if (!isnan(t)) lastTempC = t;
    if (!isnan(h)) lastHum = h;
  }
#endif

  if (millis() - bootMs < BASELINE_MS) {
    baselineSum += voMv;
    baselineCount++;
    Serial.printf("dev=%d up=%lus phase=CAL vo=%.0fmV n=%lu", DEVICE, (unsigned long)upS, voMv,
                  (unsigned long)baselineCount);
  } else {
    if (isnan(baselineMv)) {
      baselineMv = baselineCount ? (float)(baselineSum / baselineCount) : voMv;
      Serial.printf("Baseline set: %.0f mV (%lu samples)\n", baselineMv, (unsigned long)baselineCount);
    }
    float dust = (voMv - baselineMv) * UG_PER_MV;
    if (dust < 0) dust = 0;
    Serial.printf("dev=%d up=%lus phase=RUN vo=%.0fmV base=%.0fmV dust=%.1fug/m3", DEVICE,
                  (unsigned long)upS, voMv, baselineMv, dust);
  }

#if HAS_DHT
  Serial.printf(" temp=%.1fC hum=%.1f%%", lastTempC, lastHum);
#endif
  Serial.println();
}
