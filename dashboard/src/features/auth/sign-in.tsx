import { useState } from 'react'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')


  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/' },
    })
    setLoading(false)
    if (otpError) { setError(otpError.message || 'Something went wrong. Try again.'); return }
    setStep('code')
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (verifyError) { setError('Invalid code. Please try again.'); return }
    window.location.href = '/'
  }

  if (step === 'code') {
    return (
      <div data-auth='1' className='flex min-h-svh items-center justify-center p-4'><style>{`@supports not (color: oklch(1 0 0)){[data-auth]{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box}
[data-auth]{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem;background-color:#ffffff}[data-auth] *{box-sizing:border-box}[data-auth] label{display:block;font-size:.875rem;font-weight:500;line-height:1.25rem;color:#0d0d12;margin-bottom:.5rem}[data-auth] .text-destructive{color:#dc2626}
[data-auth] .flex{display:flex}
[data-auth] .inline-flex{display:inline-flex}
[data-auth] .min-h-svh{min-height:100vh}
[data-auth] .items-center{align-items:center}
[data-auth] .justify-center{justify-content:center}
[data-auth] .p-4{padding:1rem}
[data-auth] .w-full{width:100%}
[data-auth] .max-w-sm{max-width:24rem}
[data-auth] .space-y-6>*+*{margin-top:1.5rem}
[data-auth] .space-y-4>*+*{margin-top:1rem}
[data-auth] .space-y-2>*+*{margin-top:.5rem}
[data-auth] .space-y-1>*+*{margin-top:.25rem}
[data-auth] .text-center{text-align:center}
[data-auth] .text-2xl{font-size:1.5rem;line-height:2rem}
[data-auth] .text-sm{font-size:.875rem;line-height:1.25rem}
[data-auth] .text-xs{font-size:.75rem;line-height:1rem}
[data-auth] .text-base{font-size:1rem;line-height:1.5rem}
[data-auth] .font-semibold{font-weight:600}
[data-auth] .font-medium{font-weight:500}
[data-auth] .text-muted-foreground{color:#6e7380}
[data-auth] .text-foreground{color:#0d0d12}
[data-auth] .relative{position:relative}
[data-auth] .absolute{position:absolute}
[data-auth] .inset-0{top:0;right:0;bottom:0;left:0}
[data-auth] .border-t{border-top:1px solid #d0d5dd}
[data-auth] .border{border:1px solid #d0d5dd}
[data-auth] .border-input{border-color:#d0d5dd}
[data-auth] .bg-background{background-color:#fff}
[data-auth] .bg-primary{background-color:#14151f}
[data-auth] .text-primary-foreground{color:#fafbfc}
[data-auth] .rounded-md{border-radius:.375rem}
[data-auth] .h-9{height:2.25rem}
[data-auth] .h-4{height:1rem}
[data-auth] .w-4{width:1rem}
[data-auth] .px-3{padding-left:.75rem;padding-right:.75rem}
[data-auth] .px-2{padding-left:.5rem;padding-right:.5rem}
[data-auth] .py-2{padding-top:.5rem;padding-bottom:.5rem}
[data-auth] .py-1{padding-top:.25rem;padding-bottom:.25rem}
[data-auth] .mr-2{margin-right:.5rem}
[data-auth] .uppercase{text-transform:uppercase}
[data-auth] .underline{text-decoration:underline}
[data-auth] .gap-2{gap:.5rem}
[data-auth] .shadow-xs{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}
[data-auth] .whitespace-nowrap{white-space:nowrap}
[data-auth] .shrink-0{flex-shrink:0}
[data-auth] input[type='email'],[data-auth] input[type='text']{display:block;width:100%;height:2.25rem;border:1px solid #d0d5dd;border-radius:.375rem;padding:.25rem .75rem;font-size:.875rem;line-height:1.25rem;background:#fff;color:#0d0d12}
[data-auth] button{cursor:pointer;font:inherit;color:inherit}
[data-auth] form button[type='submit']{display:inline-flex;align-items:center;justify-content:center;width:100%;height:2.25rem;padding:0 1rem;border:1px solid #14151f;border-radius:.375rem;background-color:#14151f;color:#fafbfc;font-size:.875rem;font-weight:500}
[data-auth] button[type='button']{display:inline-flex;align-items:center;justify-content:center;width:100%;height:2.25rem;padding:0 1rem;border:1px solid #d0d5dd;border-radius:.375rem;background-color:#fff;color:#0d0d12;font-size:.875rem;font-weight:500}}}`}</style>
        <div className='w-full max-w-sm space-y-6'>
          <div className='space-y-1 text-center'>
            <h1 className='text-2xl font-semibold'>Check your email</h1>
            <p className='text-sm text-muted-foreground'>We sent a 6-digit code to <strong>{email}</strong></p>
          </div>
          <form onSubmit={handleVerifyCode} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='code'>Verification code</Label>
              <Input
                id='code'
                type='text'
                inputMode='numeric'
                placeholder='123456'
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </div>
            {error && <p className='text-sm text-destructive'>{error}</p>}
            <Button type='submit' className='w-full' disabled={loading}>
              {loading ? 'Verifying...' : 'Continue'}
            </Button>
          </form>
          <button onClick={() => { setStep('email'); setCode(''); setError('') }} className='w-full text-center text-sm text-muted-foreground underline'>
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-auth='1' className='flex min-h-svh items-center justify-center p-4'><style>{`@supports not (color: oklch(1 0 0)){[data-auth]{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box}
[data-auth]{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem;background-color:#ffffff}[data-auth] *{box-sizing:border-box}[data-auth] label{display:block;font-size:.875rem;font-weight:500;line-height:1.25rem;color:#0d0d12;margin-bottom:.5rem}[data-auth] .text-destructive{color:#dc2626}
[data-auth] .flex{display:flex}
[data-auth] .inline-flex{display:inline-flex}
[data-auth] .min-h-svh{min-height:100vh}
[data-auth] .items-center{align-items:center}
[data-auth] .justify-center{justify-content:center}
[data-auth] .p-4{padding:1rem}
[data-auth] .w-full{width:100%}
[data-auth] .max-w-sm{max-width:24rem}
[data-auth] .space-y-6>*+*{margin-top:1.5rem}
[data-auth] .space-y-4>*+*{margin-top:1rem}
[data-auth] .space-y-2>*+*{margin-top:.5rem}
[data-auth] .space-y-1>*+*{margin-top:.25rem}
[data-auth] .text-center{text-align:center}
[data-auth] .text-2xl{font-size:1.5rem;line-height:2rem}
[data-auth] .text-sm{font-size:.875rem;line-height:1.25rem}
[data-auth] .text-xs{font-size:.75rem;line-height:1rem}
[data-auth] .text-base{font-size:1rem;line-height:1.5rem}
[data-auth] .font-semibold{font-weight:600}
[data-auth] .font-medium{font-weight:500}
[data-auth] .text-muted-foreground{color:#6e7380}
[data-auth] .text-foreground{color:#0d0d12}
[data-auth] .relative{position:relative}
[data-auth] .absolute{position:absolute}
[data-auth] .inset-0{top:0;right:0;bottom:0;left:0}
[data-auth] .border-t{border-top:1px solid #d0d5dd}
[data-auth] .border{border:1px solid #d0d5dd}
[data-auth] .border-input{border-color:#d0d5dd}
[data-auth] .bg-background{background-color:#fff}
[data-auth] .bg-primary{background-color:#14151f}
[data-auth] .text-primary-foreground{color:#fafbfc}
[data-auth] .rounded-md{border-radius:.375rem}
[data-auth] .h-9{height:2.25rem}
[data-auth] .h-4{height:1rem}
[data-auth] .w-4{width:1rem}
[data-auth] .px-3{padding-left:.75rem;padding-right:.75rem}
[data-auth] .px-2{padding-left:.5rem;padding-right:.5rem}
[data-auth] .py-2{padding-top:.5rem;padding-bottom:.5rem}
[data-auth] .py-1{padding-top:.25rem;padding-bottom:.25rem}
[data-auth] .mr-2{margin-right:.5rem}
[data-auth] .uppercase{text-transform:uppercase}
[data-auth] .underline{text-decoration:underline}
[data-auth] .gap-2{gap:.5rem}
[data-auth] .shadow-xs{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}
[data-auth] .whitespace-nowrap{white-space:nowrap}
[data-auth] .shrink-0{flex-shrink:0}
[data-auth] input[type='email'],[data-auth] input[type='text']{display:block;width:100%;height:2.25rem;border:1px solid #d0d5dd;border-radius:.375rem;padding:.25rem .75rem;font-size:.875rem;line-height:1.25rem;background:#fff;color:#0d0d12}
[data-auth] button{cursor:pointer;font:inherit;color:inherit}
[data-auth] form button[type='submit']{display:inline-flex;align-items:center;justify-content:center;width:100%;height:2.25rem;padding:0 1rem;border:1px solid #14151f;border-radius:.375rem;background-color:#14151f;color:#fafbfc;font-size:.875rem;font-weight:500}
[data-auth] button[type='button']{display:inline-flex;align-items:center;justify-content:center;width:100%;height:2.25rem;padding:0 1rem;border:1px solid #d0d5dd;border-radius:.375rem;background-color:#fff;color:#0d0d12;font-size:.875rem;font-weight:500}}}`}</style>
      <div className='w-full max-w-sm space-y-6'>
        <div className='space-y-1 text-center'>
          <h1 className='text-2xl font-semibold'>{(import.meta.env.VITE_PRODUCT_NAME as string) || 'Get started'}</h1>
          <p className='text-sm text-muted-foreground'>{(import.meta.env.VITE_PRODUCT_DESCRIPTION as string) || 'Free for your first 3 — no credit card needed.'}</p>
        </div>
        <Button variant='outline' className='w-full' onClick={handleGoogle} type='button'>
          <svg className='mr-2 h-4 w-4' viewBox='0 0 24 24'>
            <path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' fill='#4285F4'/>
            <path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853'/>
            <path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z' fill='#FBBC05'/>
            <path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335'/>
          </svg>
          Continue with Google
        </Button>
        <div className='relative'>
          <div className='absolute inset-0 flex items-center'><span className='w-full border-t' /></div>
          <div className='relative flex justify-center text-xs uppercase'><span className='bg-background px-2 text-muted-foreground'>or</span></div>
        </div>
        <form onSubmit={handleSendCode} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input id='email' type='email' value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className='text-sm text-destructive'>{error}</p>}
          <Button type='submit' className='w-full' disabled={loading}>
            {loading ? 'Sending code...' : 'Start free trial'}
          </Button>
        </form>
      </div>
    </div>
  )
}
