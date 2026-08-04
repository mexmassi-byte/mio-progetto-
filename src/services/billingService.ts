/**
 * billingService — placeholder checkout for the ONE-TIME purchase.
 *
 * ThePaddockView is sold once: there is no subscription, no renewal and no
 * cancellation flow. This service is the single seam a real payment provider
 * (Stripe, Paddle, Lemon Squeezy…) plugs into — the UI only calls
 * `getProduct()` and `createCheckout()`.
 *
 * To go live:
 *   1. `getProduct()` → fetch the product/price from the backend (or keep it
 *      as config and let the backend validate the amount at checkout).
 *   2. `createCheckout()` → POST to the backend, which creates a one-time
 *      payment session and returns its hosted-checkout URL:
 *
 *        const { redirectUrl } = await api.post('/billing/checkout', { productId })
 *        return { status: 'completed', redirectUrl }
 *
 *      The page then does `window.location.assign(redirectUrl)`.
 *   3. The provider's webhook (`payment_intent.succeeded` /
 *      `checkout.completed`) marks the account as purchased server-side, so
 *      `account.access` comes back as 'Full' on the next profile read.
 *
 * No card data ever touches the frontend (hosted checkout keeps PCI scope out).
 */
import type { CheckoutResult, Product } from '@/domain/models'

/** The single product. Amount is in cents to stay exact through checkout. */
const PRODUCT: Product = {
  id: 'tpv-full-access',
  name: 'ThePaddockView — Accesso completo',
  amount: 2999,
  currency: 'EUR',
  priceDisplay: '€29,99',
  includes: [
    'Dashboard e classifiche di sessione',
    'Driver Comparison — confronto giro e settori',
    'Driver DNA — profilo dello stile di guida',
    'Race Replay — mappa circuito e telemetria',
    'Battle Mode — duelli a categorie',
    'Predict — simulazioni di gara',
    'AI Race Engineer e AI Coach',
    'Aggiornamenti futuri inclusi',
  ],
}

function delay<T>(value: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export const billingService = {
  getProduct: (): Product => PRODUCT,

  /**
   * Placeholder checkout: simulates a successful one-time payment. A real
   * implementation returns `redirectUrl` and the caller redirects instead of
   * completing locally.
   */
  createCheckout: async (): Promise<CheckoutResult> => delay({ status: 'completed' as const }),
}
