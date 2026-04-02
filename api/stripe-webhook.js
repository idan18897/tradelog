import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = { api: { bodyParser: false } }

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.client_reference_id || session.metadata?.userId
        const plan = session.metadata?.plan
        const customerId = session.customer

        if (!userId) break

        await supabase.from('user_settings').upsert(
          { user_id: userId, plan, stripe_customer_id: customerId, subscription_status: 'active' },
          { onConflict: 'user_id' }
        )
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data } = await supabase
          .from('user_settings')
          .select('user_id')
          .eq('stripe_customer_id', sub.customer)
          .single()

        if (data) {
          await supabase.from('user_settings')
            .update({ plan: 'free', subscription_status: 'canceled' })
            .eq('user_id', data.user_id)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { data } = await supabase
          .from('user_settings')
          .select('user_id')
          .eq('stripe_customer_id', sub.customer)
          .single()

        if (data) {
          const isActive = sub.status === 'active'
          await supabase.from('user_settings')
            .update({
              subscription_status: sub.status,
              plan: isActive ? (data.plan || 'monthly') : 'free',
            })
            .eq('user_id', data.user_id)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  res.json({ received: true })
}
