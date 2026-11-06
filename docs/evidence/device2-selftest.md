# Device 2 (ESP32-S3) boot + selftest, Fri 6 Nov ~15:20 IST
```
ESP-ROM:esp32s3-20210327
Build:Mar 27 2021
rst:0x1 (POWERON),boot:0x8 (SPI_FAST_FLASH_BOOT)
SPIWP:0xee
mode:DIO, clock div:1
load:0x3fce2820,len:0x10cc
load:0x403c8700,len:0xc2c
load:0x403cb700,len:0x30b0
entry 0x403c88b8
PranaNet device 2 booting
DEVICE 2 address 0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32
Measuring clean-air baseline for 10 s, epoch 60 s. Type 'help' for commands.
CAL vo=102mV n=1
CAL vo=177mV n=2
CAL vo=178mV n=3
CAL vo=179mV n=4
CAL vo=177mV n=5
CAL vo=179mV n=6
CAL vo=177mV n=7
CAL vo=178mV n=8
CAL vo=180mV n=9
Baseline set: 170 mV (9 samples)
EPOCH 1793956920 nonce=1 vo=179mV base=170mV pm_proxy=1.8ug/m3 temp_x10=0 hum_x10=0 n=4 sig=0x5577f15dec… http=-1 connection refused
READING {"device":"0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32","ens":"device2.prananet.eth","geohash":"te7ud2","epoch":1793956920,"pm25_x10":18,"pm10_x10":18,"temp_x10":0,"hum_x10":0,"nonce":1,"signature":"0x5577f15decabf9cbebf0534350a2319deee2daafcdc640592d047d5936e5b4ee7210aee11a74e7642812c5b1fc442e514bf1badcd9786f1ceb08991a449876e01c","simulated":false}
{"selftest":true,"ok":true,"address":"0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266","message":"0xf920ce88124f7e4845796eb90f81329a74f4ae9753291650afba2a1bf3e09a9c","digest":"0x7e91e0a7eeaf999f31609c6496bbb71875af5668734189b88143fcc21a38dbc5","signature":"0x8bf0d72d56d07cd5a48285abc17b6362eb62f327463446840fa6e8fc989607af1628f6b9f14af9b7a2cb62d26cb1e234d4467455f2559e5114e851aa15b27a6a1b","sign_ms":550}
DEVICE 2 address 0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32
dev=2 addr=0xab29ec5df28b9fbc4804ab4d5f4ecae4833c4e32 wifi=up ip=<lan> time=ok nonce=1 base=170mV epoch=60s
```

## relayer/scripts/verify-vector.ts on that output
```
== device selftest vs fixed vector
OK   address
OK   message
OK   digest
OK   signature (byte-identical to viem)
OK   recovered signer

all checks passed
== device reading nonce=1 (chainId 11155111, contract 0x0000000000000000000000000000000000000000)
OK   recovered 0xAb29EC5dF28B9fBc4804AB4d5F4EcaE4833C4E32 == device 0xAb29EC5dF28B9fBc4804AB4d5F4EcaE4833C4E32

all checks passed
```
