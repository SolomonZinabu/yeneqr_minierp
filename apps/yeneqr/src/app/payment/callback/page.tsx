// ============================================================
// Yene QR — Payment Callback Page
// Handles redirect from payment providers (Telebirr, Chapa, CBE Birr)
// after customer completes or cancels payment.
// ============================================================

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PaymentCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading')
  const [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    const callbackStatus = searchParams.get('status')
    const cbOrderId = searchParams.get('orderId')
    const provider = searchParams.get('provider') || 'payment provider'
    const errorMsg = searchParams.get('message')

    setOrderId(cbOrderId)

    if (callbackStatus === 'completed' || callbackStatus === 'success') {
      setStatus('success')
      setMessage(`Payment completed successfully via ${provider}!`)
    } else if (callbackStatus === 'failed') {
      setStatus('failed')
      setMessage(errorMsg || `Payment failed via ${provider}. Please try again.`)
    } else if (callbackStatus === 'cancelled') {
      setStatus('cancelled')
      setMessage('Payment was cancelled.')
    } else if (callbackStatus === 'error') {
      setStatus('failed')
      setMessage(errorMsg || 'An error occurred during payment processing.')
    } else {
      // No explicit status — try to verify payment via API
      if (cbOrderId) {
        verifyPayment(cbOrderId)
      } else {
        setStatus('failed')
        setMessage('No order information received from payment provider.')
      }
    }
  }, [searchParams])

  async function verifyPayment(oid: string) {
    try {
      // Try to find the restaurant from sessionStorage or localStorage (customer session)
      let restaurantId = ''
      
      // Try sessionStorage first (cart is stored there)
      if (typeof window !== 'undefined') {
        // Look through sessionStorage for cart keys (format: yeneqr_cart_{rid})
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key?.startsWith('yeneqr_cart_')) {
            restaurantId = key.replace('yeneqr_cart_', '')
            break
          }
        }
        // Fallback to localStorage (Zustand persist)
        if (!restaurantId) {
          const stored = localStorage.getItem('yeneqr-customer')
          if (stored) {
            try {
              const session = JSON.parse(stored)
              restaurantId = session?.state?.restaurant?.id || ''
            } catch {}
          }
        }
        // Another fallback
        if (!restaurantId) {
          const stored = localStorage.getItem('yeneqr-customer-session')
          if (stored) {
            try {
              const session = JSON.parse(stored)
              restaurantId = session?.state?.session?.restaurantId || session?.restaurantId || ''
            } catch {}
          }
        }
      }

      if (!restaurantId) {
        setStatus('failed')
        setMessage('Could not verify payment — session expired.')
        return
      }

      const res = await fetch(`/api/restaurants/${restaurantId}/payments/verify?orderId=${oid}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.data?.status === 'completed') {
          setStatus('success')
          setMessage('Payment verified successfully!')
        } else {
          setStatus('failed')
          setMessage('Payment has not been completed yet. Please try again.')
        }
      } else {
        setStatus('failed')
        setMessage('Could not verify payment status.')
      }
    } catch {
      setStatus('failed')
      setMessage('Network error while verifying payment.')
    }
  }

  function handleReturnToMenu() {
    // Navigate back to the restaurant menu
    if (typeof window !== 'undefined') {
      window.history.go(-3)
      setTimeout(() => {
        router.push('/')
      }, 500)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying Payment...</h1>
            <p className="text-gray-500">Please wait while we confirm your payment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-2">{message}</p>
            {orderId && (
              <p className="text-sm text-gray-400 mb-6">Order ID: {orderId}</p>
            )}
            <button
              onClick={handleReturnToMenu}
              className="w-full py-3 px-6 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              Return to Menu
            </button>
          </>
        )}

        {(status === 'failed' || status === 'cancelled') && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <button
                onClick={handleReturnToMenu}
                className="w-full py-3 px-6 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  )
}
