export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { question, trades } = req.body
  if (!question) return res.status(400).json({ error: 'Missing question' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Build a compact trade summary for context
  const liveTrades = (trades || []).filter(t => (t.trade_type || 'live') === 'live')
  const missedTrades = (trades || []).filter(t => t.trade_type === 'missed')

  const formatTrade = t => {
    const pnl = computePnL(t)
    return `${t.date} | ${t.pair} | ${t.direction} | ${t.outcome} | RR: ${t.rr_potential || t.pot_rr || '?'} | Risk: ${t.risk_pct || 0.5}% | P&L: ${pnl.toFixed(2)}%${t.time ? ` | Time: ${t.time}` : ''}${t.notes ? ` | Notes: ${t.notes}` : ''}`
  }

  function computePnL(trade) {
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

  const tradeLines = liveTrades.map(formatTrade).join('\n')
  const missedLines = missedTrades.length > 0
    ? `\nMissed trades (${missedTrades.length}):\n` + missedTrades.map(t => `${t.date} | ${t.pair} | ${t.direction} | Missed reason: ${t.missed_reason || '?'}`).join('\n')
    : ''

  const systemPrompt = `You are a trading performance analyst. The user has a trading journal with the following data.

Live trades (${liveTrades.length} total):
${tradeLines || 'No trades yet.'}
${missedLines}

Answer the user's questions about their trading performance concisely and in the same language they ask in. Use specific numbers from their data. If they ask in Hebrew, answer in Hebrew.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })

    res.json({ answer: data.content[0].text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
