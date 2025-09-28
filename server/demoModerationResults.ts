// Demo AI Moderation Results (to test the system without OpenAI API costs)
import { moderationReporter } from "./moderationReports";

export function getDemoModerationResults() {
  // Simulate AI moderation events that would happen in real usage
  
  // Example: Inappropriate chat message blocked
  moderationReporter.logEvent({
    type: 'chat_blocked',
    severity: 'high',
    userId: '27',
    favorId: 30,
    content: 'Hey stupid, this is a scam!!',
    issues: ['harassment', 'hate_speech'],
    action: 'blocked_inappropriate_language',
    confidence: 0.92
  });

  // Example: Scam favor post blocked
  moderationReporter.logEvent({
    type: 'favor_blocked',
    severity: 'high',
    userId: '27',
    content: 'Get rich quick! Send $100 get back $500 guaranteed!',
    issues: ['financial_scam', 'misleading_content'],
    action: 'blocked_scam_favor',
    confidence: 0.95
  });

  // Example: Mild suggestion given
  moderationReporter.logEvent({
    type: 'suggestion_given',
    severity: 'low',
    userId: '15',
    favorId: 28,
    content: 'can u do this?',
    issues: ['unclear_communication'],
    action: 'suggested_improvement',
    confidence: 0.73
  });

  // Example: Dispute analyzed 
  moderationReporter.logEvent({
    type: 'dispute_analyzed',
    severity: 'medium',
    favorId: 31,
    content: 'Analyzed chat history for completion dispute',
    issues: ['incomplete_work'],
    action: 'recommended_cancellation',
    confidence: 0.84
  });

  // Example: Another blocked inappropriate message
  moderationReporter.logEvent({
    type: 'chat_blocked',
    severity: 'medium',
    userId: '27',
    favorId: 32,
    content: 'Meet me at my place alone at night for this favor',
    issues: ['safety_concern', 'inappropriate_request'],
    action: 'blocked_safety_risk',
    confidence: 0.88
  });

  return true;
}

// Test scenarios for the moderation system
export const testScenarios = {
  inappropriateMessages: [
    "You're an idiot, this favor is stupid",
    "Send me nude photos as payment",
    "Meet me alone in a dark alley",
    "This is definitely a scam, don't trust them"
  ],
  appropriateMessages: [
    "Hi! I'd be happy to help with your favor",
    "When would be a good time to meet?",
    "I have experience with this type of work",
    "Let me know if you have any questions"
  ],
  scamFavors: [
    {
      title: "Get Rich Quick",
      description: "Send me $50 and I'll send you back $200 guaranteed!",
      category: "Other",
      price: "50"
    },
    {
      title: "Free iPhone Giveaway", 
      description: "Just give me your credit card info for shipping",
      category: "Other",
      price: "0"
    }
  ],
  legitimateFavors: [
    {
      title: "Dog Walking Service",
      description: "I can walk your dog daily for 30 minutes",
      category: "Pet Care", 
      price: "15"
    },
    {
      title: "Furniture Assembly",
      description: "Experienced with IKEA and other furniture assembly",
      category: "Home Improvement",
      price: "25"
    }
  ]
};