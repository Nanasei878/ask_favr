import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, MapPin, MessageCircle, Euro, Shield, Star, Clock, Users, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";

interface StepExample {
  title?: string;
  category?: string;
  price?: string;
  timeframe?: string;
  address?: string;
  helper?: string;
  message?: string;
  rating?: number;
  completedFavors?: number;
  conversation?: Array<{ sender: string; message: string; }>;
  completed?: boolean;
  review?: string;
  earning?: string;
}

interface Step {
  id: number;
  title: string;
  description: string;
  icon: any;
  color: string;
  example: StepExample;
  tip: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Post Your Favr",
    description: "Need help with something? Post your request and set your price.",
    icon: MapPin,
    color: "bg-blue-500",
    example: {
      title: "Walk my dog while I'm at work",
      category: "Pet Care",
      price: "€15",
      timeframe: "This afternoon",
      address: "Bonnevoie area"
    },
    tip: "Be specific about what you need and when you need it done."
  },
  {
    id: 2,
    title: "Get Connected",
    description: "Nearby helpers see your request and can message you directly.",
    icon: Users,
    color: "bg-green-500",
    example: {
      helper: "Sarah M.",
      message: "Hi! I live nearby and love dogs. I can walk yours this afternoon around 2 PM. Would that work?",
      rating: 4.9,
      completedFavors: 23
    },
    tip: "You'll get notifications when someone wants to help you."
  },
  {
    id: 3,
    title: "Chat & Negotiate",
    description: "Discuss details, negotiate price if needed, and confirm the arrangement.",
    icon: MessageCircle,
    color: "bg-purple-500",
    example: {
      conversation: [
        { sender: "you", message: "Perfect! Can you do it for €12?" },
        { sender: "helper", message: "Sure, that works for me!" },
        { sender: "you", message: "Great! See you at 2 PM" }
      ]
    },
    tip: "Use the chat to work out all the details before meeting."
  },
  {
    id: 4,
    title: "Get Help & Rate",
    description: "Your helper completes the favor, and you both rate the experience.",
    icon: Star,
    color: "bg-orange-500",
    example: {
      completed: true,
      rating: 5,
      review: "Sarah was amazing! My dog loved her and she sent me photos during the walk.",
      earning: "+€12"
    },
    tip: "Good ratings help build trust in the community."
  }
];

const benefits = [
  {
    icon: Clock,
    title: "Quick Help",
    description: "Get things done faster with people nearby"
  },
  {
    icon: Euro,
    title: "Fair Pricing",
    description: "Set your own price or negotiate what works"
  },
  {
    icon: Shield,
    title: "Safe & Secure",
    description: "Verified users and secure payment protection"
  },
  {
    icon: Heart,
    title: "Build Community",
    description: "Connect with neighbors and help each other"
  }
];

export default function HowItWorks() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);

  const handleGetStarted = () => {
    trackEvent('how_it_works_get_started', 'conversion', 'onboarding_complete');
    setLocation('/auth');
  };

  const handleStepNavigation = (direction: 'next' | 'prev') => {
    trackEvent('how_it_works_navigation', 'engagement', direction, currentStep + 1);
    if (direction === 'next' && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (direction === 'prev' && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 bg-slate-800/95 backdrop-blur-lg border-b border-slate-700 px-4 py-3 z-40">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              trackEvent('how_it_works_back', 'navigation', 'back_to_home');
              setLocation('/');
            }}
            className="text-favr-blue hover:bg-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">How Favr Works</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-md mx-auto">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  index <= currentStep 
                    ? 'bg-favr-blue text-white' 
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`w-12 h-0.5 mx-2 transition-colors ${
                    index < currentStep ? 'bg-favr-blue' : 'bg-slate-700'
                  }`} 
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Step */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full ${currentStepData.color} flex items-center justify-center mx-auto mb-4`}>
            <IconComponent className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{currentStepData.title}</h2>
          <p className="text-slate-400 text-lg">{currentStepData.description}</p>
        </div>

        {/* Step Content */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold text-favr-blue mb-2">{currentStepData.example.title}</h3>
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      {currentStepData.example.category}
                    </Badge>
                    <span className="text-xl font-bold text-green-400">{currentStepData.example.price}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {currentStepData.example.timeframe}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {currentStepData.example.address}
                    </div>
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-sm text-blue-400">💡 {currentStepData.tip}</p>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                      {currentStepData.example.helper ? currentStepData.example.helper.split(' ')[0][0] : 'S'}
                    </div>
                    <div>
                      <div className="font-semibold">{currentStepData.example.helper || 'Sarah M.'}</div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span>{currentStepData.example.rating || 4.9}</span>
                        <span>•</span>
                        <span>{currentStepData.example.completedFavors || 23} favors completed</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-sm text-white font-medium">{currentStepData.example.message || 'Hi! I live nearby and love dogs.'}</p>
                  </div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-sm text-green-400">💡 {currentStepData.tip}</p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                  {(currentStepData.example.conversation || []).map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'you' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs rounded-lg p-3 text-sm ${
                        msg.sender === 'you' 
                          ? 'bg-favr-blue text-white' 
                          : 'bg-slate-800 text-slate-200'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-sm text-purple-400">💡 {currentStepData.tip}</p>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2">
                      <Star className="w-8 h-8 text-white fill-current" />
                    </div>
                    <h3 className="font-semibold text-green-400 mb-1">Favor Completed!</h3>
                    <div className="text-2xl font-bold text-green-400">{currentStepData.example.earning}</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-300">"{currentStepData.example.review}"</p>
                  </div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-sm text-orange-400">💡 {currentStepData.tip}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button 
            onClick={() => handleStepNavigation('prev')}
            disabled={currentStep === 0}
            className="bg-favr-blue hover:bg-blue-600 disabled:bg-slate-600 disabled:text-slate-400"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button 
              onClick={() => handleStepNavigation('next')}
              className="bg-favr-blue hover:bg-blue-600"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleGetStarted}
              className="bg-green-500 hover:bg-green-600"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Benefits Section */}
        {currentStep === steps.length - 1 && (
          <div className="mt-12 space-y-6">
            <h3 className="text-xl font-bold text-center">Why Choose Favr?</h3>
            <div className="grid grid-cols-2 gap-4">
              {benefits.map((benefit, index) => {
                const BenefitIcon = benefit.icon;
                return (
                  <Card key={index} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 text-center">
                      <BenefitIcon className="w-8 h-8 text-favr-blue mx-auto mb-2" />
                      <h4 className="font-semibold text-sm mb-1">{benefit.title}</h4>
                      <p className="text-xs text-slate-400">{benefit.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}