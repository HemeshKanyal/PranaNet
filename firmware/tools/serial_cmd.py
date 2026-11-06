#!/usr/bin/env python3
"""Send serial commands to a PranaNet board and print everything it says.

  serial_cmd.py --find 2            print the port of the board that reports DEVICE 2
  serial_cmd.py PORT SECONDS [AT:CMD ...]   e.g. /dev/ttyUSB0 16 12:newkey

Opening the port resets a classic ESP32 (auto-reset circuit), so commands are sent after a
delay (boot + 10 s baseline). Identify boards by `addr`, never by port number: the two CP2102s
share a serial number and ttyUSB0/1 can swap.
"""
import glob, sys, time
import serial  # pyserial


def run(port, secs, cmds):
    s = serial.Serial(port, 115200, timeout=0.1)
    t0, out, pend = time.time(), b"", [(float(c.split(":", 1)[0]), c.split(":", 1)[1]) for c in cmds]
    while time.time() - t0 < secs:
        for p in list(pend):
            if time.time() - t0 >= p[0]:
                s.write((p[1] + "\n").encode()); pend.remove(p)
        out += s.read(4096)
    return out.decode("utf-8", "replace")


if __name__ == "__main__":
    if sys.argv[1] == "--find":
        want = f"DEVICE {sys.argv[2]} address"
        for port in sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")):
            if want in run(port, 16, ["12:addr"]):
                print(port); sys.exit(0)
        sys.exit(1)
    print(run(sys.argv[1], float(sys.argv[2]), sys.argv[3:]))
