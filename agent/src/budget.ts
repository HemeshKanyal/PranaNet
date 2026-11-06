// Hard spending cap for the agent: total per run and per payment, HBAR only.
export class Budget {
  spent = 0n;
  lastAmount: bigint | null = null;
  private reserved = 0n;

  constructor(
    readonly cap: bigint,
    readonly perCall: bigint,
  ) {}

  /** Called before a payment is created. Approving reserves the amount until spend(). */
  check(asset: string, amount: string | bigint): { ok: true } | { ok: false; reason: string } {
    if (asset !== "0.0.0") return { ok: false, reason: `asset ${asset} not allowed (HBAR only)` };
    const a = BigInt(amount);
    if (a <= 0n) return { ok: false, reason: "non-positive amount" };
    if (a > this.perCall) return { ok: false, reason: `price ${a} > per-call cap ${this.perCall}` };
    if (this.spent + this.reserved + a > this.cap) return { ok: false, reason: `budget exhausted: ${this.spent} spent + ${a} > cap ${this.cap}` };
    this.reserved += a;
    this.lastAmount = a;
    return { ok: true };
  }

  spend(amount: bigint) {
    this.spent += amount;
    this.reserved = this.reserved > amount ? this.reserved - amount : 0n;
  }
}
