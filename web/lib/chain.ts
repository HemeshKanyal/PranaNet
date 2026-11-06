// Chain constants. Real values come from env once contracts are deployed; until then
// the mock values in mocks/chain.json (which the mock signatures were made against).
import mockChain from "@/mocks/chain.json";
import type { Address } from "./types";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || mockChain.chainId);
export const READINGS_CONTRACT = (process.env.NEXT_PUBLIC_READINGS_CONTRACT || mockChain.readingsContract) as Address;
export const REGISTRY_CONTRACT = (process.env.NEXT_PUBLIC_REGISTRY_CONTRACT || mockChain.registryContract) as Address;
export const CONTRACTS_ARE_MOCK = !process.env.NEXT_PUBLIC_READINGS_CONTRACT;

const ETHERSCAN = "https://sepolia.etherscan.io";
export const txUrl = (tx: string) => `${ETHERSCAN}/tx/${tx}`;
export const addressUrl = (a: string) => `${ETHERSCAN}/address/${a}`;
export const ensUrl = (name: string) => `https://sepolia.app.ens.domains/${name}`;
/** Arkiv explorer base, e.g. for an entity page. Empty until Hemesh confirms the URL. */
export const ARKIV_EXPLORER = process.env.NEXT_PUBLIC_ARKIV_EXPLORER || "";
