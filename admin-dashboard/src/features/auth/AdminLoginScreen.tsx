import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldCheck, Phone, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAdminAuth } from './AdminAuthContext';

export const AdminLoginScreen: React.FC = () => {
  const { isAuthenticated, isAdmin, requestOtp, verifyOtp, loginWithGoogle, isLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/overview" replace />;
  }

  if (isAuthenticated && !isAdmin) {
    return <Navigate to="/access-denied" replace />;
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError(null);
    if (!credentialResponse?.credential) {
      setError('Google Sign-In failed to return credentials.');
      return;
    }
    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate('/overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Google authentication failed.');
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await requestOtp(phone.trim());
      setStep('otp');
      setCooldown(res.cooldownSeconds);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp(phone.trim(), otp.trim());
      navigate('/overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired OTP.');
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white/10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-forest text-white rounded-2xl mx-auto flex items-center justify-center font-black shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-charcoal tracking-tight">Fleet24 Super Admin</h1>
          <p className="text-xs text-muted-foreground">
            Platform governance, logistics control, and financial settlement console
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google One-Click Login & Sign-Up */}
        <div className="space-y-3">
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In was cancelled or failed.')}
              useOneTap
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              width="100%"
            />
          </div>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-border w-full" />
            <span className="bg-white px-3 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              Or with phone OTP
            </span>
            <div className="border-t border-border w-full" />
          </div>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Admin Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter your authorized 10-digit platform administrator mobile number.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-forest hover:bg-forest/90 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Admin Verification Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-charcoal">
                  Enter 6-Digit OTP
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-[11px] text-forest hover:underline font-semibold"
                >
                  Change Number
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest font-mono tracking-widest text-center"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Sent to <span className="font-semibold text-charcoal">{phone}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length < 6}
              className="w-full py-2.5 bg-forest hover:bg-forest/90 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & Enter Console
            </button>

            {cooldown > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                Resend code in <span className="font-bold">{cooldown}s</span>
              </p>
            )}
          </form>
        )}

        <div className="p-3 bg-ivory rounded-xl border border-border text-center text-[11px] text-muted-foreground">
          Restricted system. Access logged and strictly restricted to authorized Fleet24 administrators.
        </div>
      </div>
    </div>
  );
};

