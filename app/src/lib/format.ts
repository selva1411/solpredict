import BN from 'bn.js'

export function lamportsToSol(bn: BN | number): number {
  const n = BN.isBN(bn) ? bn.toNumber() : bn
  return n / 1_000_000_000
}

export function bnToNum(bn: BN | number): number {
  return BN.isBN(bn) ? bn.toNumber() : bn
}

export function formatSol(lamports: BN | number, decimals = 4): string {
  return lamportsToSol(lamports).toFixed(decimals) + ' SOL'
}

export function calcYesPct(
  yesPool: BN | number,
  noPool: BN | number
): number {
  const yes = bnToNum(yesPool)
  const no = bnToNum(noPool)
  const total = yes + no
  if (total === 0) return 50
  return (yes / total) * 100
}

export function formatTs(ts: BN | number): string {
  const n = bnToNum(ts)
  return new Date(n * 1000).toLocaleString()
}

export function shortAddr(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}
