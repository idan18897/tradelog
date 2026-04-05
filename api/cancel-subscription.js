import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  // Fetch stripe_customer_id from Supabase
  const { data: settings, error: fetchError } = await supabase
    .from('user_settings')
    .select('stripe_customer_id, plan')
    .eq('user_id', userId)
    .single()

  if (fetchError || !settings) {
    return res.status(404).json({ error: 'User settings not found' })
  }

  const { stripe_customer_id, plan } = settings

  if (plan === 'lifetime') {
    return res.status(400).json({ error: 'Lifetime plan cannot be canceled' })
  }

  if (!stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer found for this user' })
  }

  try {
    // Find active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      // No active subscription — just update DB to be safe
      await supabase.from('user_settings')
        .update({ plan: 'free', subscription_status: 'canceled' })
        .eq('user_id', userId)
      return res.json({ success: true })
    }

    const subscription = subscriptions.data[0]

    // Cancel at period end (graceful) — user keeps access until billing period ends
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })

    // Update Supabase
    await supabase.from('user_settings')
      .update({ subscription_status: 'canceled' })
      .eq('user_id', userId)

    return res.json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    return res.status(500).json({ error: err.message || 'Failed to cancel subscription' })
  }
}
