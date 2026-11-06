// Copy to secrets.h (gitignored) and fill in. Never commit secrets.h.
// The device private key is NOT here: it is generated on the device at first boot and kept in NVS.
#pragma once

// ---- Wi-Fi (2.4 GHz)
#define WIFI_SSID     "your-ssid"
#define WIFI_PASSWORD "your-password"

// ---- Relayer: full URL of POST /readings. http:// on a LAN or the https:// Cloudflare tunnel.
#define RELAYER_URL "https://example.trycloudflare.com/readings"

// ---- Chain binding (must match the deployed Readings contract, see contracts/deployments/sepolia.json)
#define CHAIN_ID         11155111ULL
#define READINGS_ADDRESS "0x0000000000000000000000000000000000000000"

// ---- Epoch length in seconds (60 for the demo)
#define EPOCH_SECONDS 60

// ---- Per-device metadata sent with each reading (not signed; the relayer uses on-chain values)
#define DEVICE1_ENS     "device1.prananet.eth"
#define DEVICE1_GEOHASH "te7ud2"
#define DEVICE2_ENS     "device2.prananet.eth"
#define DEVICE2_GEOHASH "te7ud2"
