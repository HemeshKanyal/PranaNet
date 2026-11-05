// ×10 integers → display strings.
export const x10 = (v: number, digits = 1) => (v / 10).toFixed(digits);

export const time = (epoch: number) =>
  new Date(epoch * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });

export const eth = (wei: string) => {
  const w = BigInt(wei);
  const ONE_ETH = BigInt("1000000000000000000"); // no bigint literals: tsconfig targets ES2017
  const whole = w / ONE_ETH;
  const frac = (w % ONE_ETH).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};

export const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
