import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Smartphone, Settings, Bell, Home, CheckCircle } from "lucide-react";

interface IOSSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSSetupGuide({ isOpen, onClose }: IOSSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isIOSStandalone, setIsIOSStandalone] = useState(false);

  useEffect(() => {
    // Check if running as PWA on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOSStandalone(isIOS && isStandalone);
  }, []);

  if (!isOpen) return null;

  const steps = [
    {
      icon: <Settings className="w-6 h-6" />,
      title: "Enable Safari Features",
      description: "Settings → Safari → Advanced → Experimental Features",
      details: [
        "Open iPhone Settings app",
        "Scroll down and tap 'Safari'",
        "Tap 'Advanced' at the bottom",
        "Tap 'Experimental Features'",
        "Turn ON 'Web Push' and 'Notifications'"
      ]
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Allow Safari Notifications",
      description: "Settings → Safari → Notifications",
      details: [
        "In Safari settings, tap 'Notifications'",
        "Turn ON 'Allow Websites to Ask'",
        "Also check Settings → Notifications → Safari",
        "Make sure Safari can send notifications"
      ]
    },
    {
      icon: <Home className="w-6 h-6" />,
      title: "Add Favr to Home Screen",
      description: "Tap Share button → Add to Home Screen",
      details: [
        "Open Favr in Safari (not Chrome/Firefox)",
        "Tap the Share button at the bottom",
        "Scroll down and tap 'Add to Home Screen'",
        "Tap 'Add' in the top right corner"
      ]
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: "Open from Home Screen",
      description: "Always use the Favr app icon, not Safari",
      details: [
        "Find the Favr icon on your home screen",
        "Tap it to open the app",
        "Don't use Safari bookmarks or tabs",
        "Notifications only work when opened this way"
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-favr-blue" />
              iPhone Setup Guide
            </CardTitle>
            <CardDescription className="text-slate-400">
              Get notifications working on your iPhone
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isIOSStandalone && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
              <p className="text-green-400 text-sm font-medium">
                ✅ Great! You're already using Favr as a home screen app
              </p>
            </div>
          )}

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  currentStep === index + 1
                    ? 'border-favr-blue bg-slate-700/50'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
                onClick={() => setCurrentStep(index + 1)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${
                    currentStep === index + 1 ? 'text-favr-blue' : 'text-slate-400'
                  }`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm">
                      {index + 1}. {step.title}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                      {step.description}
                    </p>
                    
                    {currentStep === index + 1 && (
                      <div className="mt-3 space-y-2">
                        {step.details.map((detail, detailIndex) => (
                          <div key={detailIndex} className="flex items-start gap-2">
                            <div className="w-1 h-1 bg-favr-blue rounded-full mt-2 flex-shrink-0" />
                            <p className="text-slate-300 text-xs">{detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-300 text-xs">
              <strong>Why these steps?</strong> Apple requires specific settings to be enabled 
              for web app notifications. These aren't turned on by default for security reasons.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Skip for Now
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 bg-favr-blue hover:bg-blue-600"
            >
              Got It!
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}