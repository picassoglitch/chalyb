// The coins Señales offers (first activation, Ajustes). Shared by the mock
// and the engine adapter; every one is an open contract on the engine's
// price source (Bitunix <SYMBOL>USDT).

import type { Coin } from './adapters/tools';

export const SENALES_COINS: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'LTC', name: 'Litecoin' },
];

/** The market pair for a coin ("BTC" → "BTCUSDT"). */
export const pairForCoin = (symbol: string) => `${symbol}USDT`;
