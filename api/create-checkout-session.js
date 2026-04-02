import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  yearly: process.env.STRIPE_YEARLY_PRICE_ID,
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { plan, userId, email } = req.body

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Invalid plan' })
  }

  const origin = req.headers.origin || `https://${req.headers.host}`
  const isOneTime = plan === 'lifetime'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isOneTime ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/landing`,
      client_reference_id: userId || undefined,
      customer_email: email || undefined,
      metadata: { userId: userId || '', plan },
    })

    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
