export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { stats } = req.body || {}
  if (!stats) return res.status(400).json({ error: 'No stats provided' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `You are an expert trading coach. Analyze this trader's performance data and give 5 concise, actionable insights. Be specific, data-driven, and direct. Each insight should be 2-3 sentences maximum.

Performance Data:
${JSON.stringify(stats, null, 2)}

Format your response as exactly 5 numbered insights. Use **bold** for key numbers or key terms. Focus on: what's working, what to fix, session/time patterns, risk management, and one actionable improvement for next week.`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(502).json({ error: 'Claude API error: ' + err })
    }

    const data = await response.json()
    res.json({ insights: data.content[0].text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
