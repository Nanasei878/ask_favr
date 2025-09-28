import OpenAI from "openai";
import { moderationReporter } from "./moderationReports";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ModerationResult {
  isAppropriate: boolean;
  severity: 'low' | 'medium' | 'high';
  issues: string[];
  suggestion?: string;
  confidence: number;
}

export interface DisputeAnalysis {
  recommendation: 'complete' | 'cancel' | 'needs_human_review';
  reasoning: string;
  confidence: number;
  evidence: string[];
}

export class AIModerationService {
  // Content moderation for chat messages
  async moderateMessage(message: string, context?: { senderName?: string; favorTitle?: string }): Promise<ModerationResult> {
    try {
      // First use OpenAI's built-in moderation
      const moderation = await openai.moderations.create({
        input: message
      });

      const flagged = moderation.results[0].flagged;
      const categories = moderation.results[0].categories;

      // If OpenAI flags it, it's definitely inappropriate
      if (flagged) {
        const issues = Object.entries(categories)
          .filter(([_, value]) => value)
          .map(([key, _]) => key);

        // Log to moderation reporter
        moderationReporter.logEvent({
          type: 'chat_blocked',
          severity: 'high',
          content: message,
          issues,
          action: 'blocked_by_openai_moderation',
          confidence: 0.95
        });

        return {
          isAppropriate: false,
          severity: 'high',
          issues,
          confidence: 0.95
        };
      }

      // Use GPT for context-aware analysis
      const contextPrompt = context
        ? `Context: Message about favor "${context.favorTitle}" from user "${context.senderName}"`
        : "General chat message";

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a content moderator for a community favor exchange platform. Analyze messages for:
- Inappropriate content (scams, harassment, explicit content)
- Spam or repetitive messaging
- Attempts to move conversations off-platform
- Unreasonable requests or pricing
- Safety concerns

Respond with JSON: { "isAppropriate": boolean, "severity": "low"|"medium"|"high", "issues": string[], "suggestion": string, "confidence": number }`
          },
          {
            role: "user",
            content: `${contextPrompt}\n\nMessage to analyze: "${message}"`
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        isAppropriate: analysis.isAppropriate ?? true,
        severity: analysis.severity ?? 'low',
        issues: analysis.issues ?? [],
        suggestion: analysis.suggestion,
        confidence: analysis.confidence ?? 0.7
      };

    } catch (error) {
      console.error("AI moderation error:", error);
      // Fail open - allow message but log for review
      return {
        isAppropriate: true,
        severity: 'low',
        issues: ['moderation_system_error'],
        confidence: 0.1
      };
    }
  }

  // Content validation for favor posts
  async validateFavorPost(title: string, description: string, category: string, price: string): Promise<ModerationResult> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are validating favor posts for a community exchange platform. Check for:
- Legitimate service requests vs scams
- Appropriate pricing (not extremely low/high)
- Clear, actionable descriptions
- Safety concerns (illegal activities, dangerous requests)
- Spam or duplicate content patterns

Respond with JSON: { "isAppropriate": boolean, "severity": "low"|"medium"|"high", "issues": string[], "suggestion": string, "confidence": number }`
          },
          {
            role: "user",
            content: `Title: "${title}"\nDescription: "${description}"\nCategory: ${category}\nPrice: ${price}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        isAppropriate: analysis.isAppropriate ?? true,
        severity: analysis.severity ?? 'low',
        issues: analysis.issues ?? [],
        suggestion: analysis.suggestion,
        confidence: analysis.confidence ?? 0.7
      };

    } catch (error) {
      console.error("Favor validation error:", error);
      return {
        isAppropriate: true,
        severity: 'low',
        issues: ['validation_system_error'],
        confidence: 0.1
      };
    }
  }

  // Analyze chat history for dispute resolution
  async analyzeDispute(
    favorTitle: string,
    chatHistory: Array<{ sender: string, message: string, timestamp: Date }>,
    disputeReason?: string
  ): Promise<DisputeAnalysis> {
    try {
      const chatText = chatHistory
        .map(msg => `[${msg.timestamp.toISOString()}] ${msg.sender}: ${msg.message}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are mediating disputes in a favor exchange platform. Analyze the conversation to determine if the favor was actually completed satisfactorily.

Look for:
- Clear agreement on terms and completion
- Evidence of work being done
- Both parties' satisfaction levels
- Miscommunications or unmet expectations
- Signs of completion vs incomplete work

Recommend:
- "complete": Clear evidence favor was completed satisfactorily
- "cancel": Clear evidence favor was not completed or poorly done
- "needs_human_review": Ambiguous case requiring human judgment

Respond with JSON: { "recommendation": string, "reasoning": string, "confidence": number, "evidence": string[] }`
          },
          {
            role: "user",
            content: `Favor: "${favorTitle}"
${disputeReason ? `Dispute reason: ${disputeReason}\n` : ''}
Chat history:
${chatText}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        recommendation: analysis.recommendation ?? 'needs_human_review',
        reasoning: analysis.reasoning ?? 'Unable to analyze conversation',
        confidence: analysis.confidence ?? 0.5,
        evidence: analysis.evidence ?? []
      };

    } catch (error) {
      console.error("Dispute analysis error:", error);
      return {
        recommendation: 'needs_human_review',
        reasoning: 'AI analysis system error - requires human review',
        confidence: 0.1,
        evidence: ['system_error']
      };
    }
  }

  // Suggest improved communication
  async suggestBetterMessage(originalMessage: string, context: string): Promise<string | null> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You help users communicate more effectively in a favor exchange platform. Suggest improvements for unclear, rude, or ineffective messages. Keep suggestions brief and friendly. Return only the improved message, or "null" if no improvement needed.`
          },
          {
            role: "user",
            content: `Context: ${context}\nOriginal message: "${originalMessage}"\n\nSuggest a better version:`
          }
        ]
      });

      const suggestion = response.choices[0].message.content?.trim();
      return (suggestion && suggestion !== "null") ? suggestion : null;

    } catch (error) {
      console.error("Message suggestion error:", error);
      return null;
    }
  }
}

export const aiModerationService = new AIModerationService();