import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Star, Users, Shield, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToastNotifications } from "@/hooks/use-toast-notifications";
import { ToastNotificationManager } from "@/components/toast-notification";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToastNotifications();
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Store user ID for notifications
        localStorage.setItem('currentUserId', userData.id.toString());
        
        // Initialize notifications for the new user
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          import('../lib/notifications').then(({ notificationService }) => {
            notificationService.setUserId(userData.id.toString());
          });
        }
        
        login(userData);
        showSuccess(`Account created successfully! Welcome ${firstName}!`);
        setTimeout(() => setLocation('/onboarding'), 1500);
      } else {
        const error = await response.json();
        showError(error.message || 'Failed to create account');
      }
    } catch (error) {
      showError('Failed to create account. Please try again.');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signInEmail, password: signInPassword })
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Store user ID for notifications
        localStorage.setItem('currentUserId', userData.id.toString());
        
        // Initialize notifications for the signed-in user
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          import('../lib/notifications').then(({ notificationService }) => {
            notificationService.setUserId(userData.id.toString());
          });
        }
        
        login(userData);
        showSuccess(`Welcome back, ${userData.firstName}!`);
        setTimeout(() => {
          setLocation('/');
        }, 1000);
      } else {
        const error = await response.json();
        showError(error.message || 'Invalid credentials');
      }
    } catch (error) {
      showError('Failed to sign in. Please try again.');
    }
  };

  if (showSignIn) {
    return (
      <div className="w-full bg-slate-900 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowSignIn(false)}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/attached_assets/A6E6772A-1A83-435C-9131-8C494656D116_1750518078054.PNG"
                alt="Favr Logo" 
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              required
            />
            
            <Button 
              type="submit" 
              className="w-full bg-favr-blue hover:bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Sign In
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-slate-400 text-sm">
              Don't have an account?{" "}
              <button 
                onClick={() => {
                  setShowSignIn(false);
                  setShowSignUp(true);
                }}
                className="text-favr-blue hover:underline"
              >
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showSignUp) {
    return (
      <div className="w-full bg-slate-900 min-h-screen flex flex-col">
        {/* Back Button */}
        <div className="px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowSignUp(false)}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/attached_assets/A6E6772A-1A83-435C-9131-8C494656D116_1750518078054.PNG"
                alt="Favr Logo" 
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-400">Ask and do favrs</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                required
              />
              <Input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                required
              />
            </div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              required
            />
            <Input
              type="password"
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              required
            />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              required
            />

            <Button 
              type="submit" 
              className="w-full bg-favr-blue hover:bg-blue-600 text-white py-3 rounded-lg font-medium mt-6"
            >
              Create Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Sign In Link */}
          <div className="text-center mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowSignUp(false)}
              className="text-slate-400 hover:text-white"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 min-h-screen flex flex-col">
      {/* Back Button */}
      <div className="px-4 py-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setLocation('/')}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto w-full md:max-w-lg lg:max-w-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/attached_assets/A6E6772A-1A83-435C-9131-8C494656D116_1750518078054.PNG"
              alt="Favr Logo" 
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Get Started</h1>
          <p className="text-slate-400 text-lg">Find help wherever you are</p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center space-x-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <div className="w-10 h-10 bg-favr-blue rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Get help instantly</h3>
              <p className="text-sm text-slate-400">Connect with skilled people nearby, wherever you are</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Safe & secure</h3>
              <p className="text-sm text-slate-400">Protected payments with verified community members</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Build reputation</h3>
              <p className="text-sm text-slate-400">Earn rewards and create lasting connections</p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => setShowSignUp(true)}
            className="w-full bg-favr-blue hover:bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Create Account
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          
          <Button 
            onClick={() => setShowSignIn(true)}
            variant="outline"
            className="w-full border-2 border-favr-blue text-favr-blue hover:bg-favr-blue hover:text-white py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Sign In
          </Button>

          <div className="pt-2">
            <Button 
              onClick={() => setLocation('/how-it-works')}
              variant="ghost"
              className="w-full text-slate-400 hover:text-white py-3 font-medium transition-colors"
            >
              How It Works
            </Button>
          </div>
        </div>
      </div>
      <ToastNotificationManager toasts={toasts} removeToast={removeToast} />
    </div>
  );
}