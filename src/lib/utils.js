/**
 * Compute P&L (as % of account) for a single trade.
 * Used in Dashboard and Journal.
 */
export function computePnL(trade) {
  const rr = Number(trade.rr_potential) || 0
  const risk = Number(trade.risk_pct) || 0.5
  if (trade.outcome === 'SL') return -risk
  if (trade.outcome !== 'TP' && trade.outcome !== 'Partial TP') return 0
  const isPartial = trade.outcome === 'Partial TP'
  if (trade.sl_to_be && trade.exit_levels?.length) {
    let rem = 100, gain = 0
    for (const lv of trade.exit_levels) {
      gain += (lv.pct / 100) * lv.rr * risk
      rem -= lv.pct
    }
    if (!isPartial) gain += (rem / 100) * rr * risk
    return gain
  }
  return isPartial ? rr * risk * 0.5 : rr * risk
}

/**
 * Compute potential gain for a missed trade.
 * Prefers rr_potential (price-based) over pot_rr (manual).
 */
export function computeMissedPotGain(trade) {
  // If the missed trade resulted in SL, it represents a potential loss avoided
  if (trade.outcome === 'SL') return -(Number(trade.risk_pct) || 0.5)
  const fullRR = Number(trade.rr_potential) || Number(trade.pot_rr) || 0
  const risk = Number(trade.risk_pct) || 0.5
  if (!fullRR) return 0
  const isPartial = trade.outcome === 'Partial TP'
  if (trade.sl_to_be && trade.exit_levels?.length) {
    let rem = 100, gain = 0
    for (const lv of trade.exit_levels) {
      gain += (lv.pct / 100) * lv.rr * risk
      rem -= lv.pct
    }
    if (!isPartial) gain += (rem / 100) * fullRR * risk
    return gain
  }
  return isPartial ? fullRR * risk * 0.5 : fullRR * risk
}
