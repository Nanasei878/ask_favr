import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SmartFavorSuggestion {
  title: string;
  description: string;
  category: string;
  estimatedPrice: number;
  timeframe: string;
  isNegotiable: boolean;
}

export async function generateSmartFavorDetails(action: string, category: string): Promise<SmartFavorSuggestion> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates favor request details for a community marketplace app called Favrs. Generate realistic, helpful details for favor requests based on the action and category provided.

Respond with JSON in this exact format:
{
  "title": "Clear, specific title for the favor",
  "description": "Detailed, helpful description of what's needed",
  "category": "The category name",
  "estimatedPrice": "Reasonable price in dollars (number)",
  "timeframe": "When this is needed (e.g., 'Today', 'This weekend', 'Next week')",
  "isNegotiable": "Whether price should be negotiable (boolean)"
}

Make the details realistic and helpful. For rides, include common destinations. For pet care, mention specific needs. For handyman work, be specific about the task.`
        },
        {
          role: "user",
          content: `Generate favor details for: "${action}" in category: "${category}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    
    return {
      title: result.title,
      description: result.description,
      category: result.category,
      estimatedPrice: Number(result.estimatedPrice),
      timeframe: result.timeframe,
      isNegotiable: Boolean(result.isNegotiable)
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    
    // Fallback with smart defaults based on action
    const fallbacks: Record<string, SmartFavorSuggestion> = {
      "Need a Ride": {
        title: "Need a ride to destination",
        description: "Looking for someone to give me a ride to my destination. Happy to cover gas money!",
        category: "Ride",
        estimatedPrice: 15,
        timeframe: "Today",
        isNegotiable: true
      },
      "Walk my Dog": {
        title: "Dog walking needed",
        description: "My dog needs a good walk while I'm busy. They're friendly and well-behaved!",
        category: "Pet Care",
        estimatedPrice: 20,
        timeframe: "Today",
        isNegotiable: false
      },
      "Fix Something": {
        title: "Handyman help needed",
        description: "Need someone handy to help fix something around the house.",
        category: "Handyman",
        estimatedPrice: 40,
        timeframe: "This weekend",
        isNegotiable: true
      },
      "Pick up Package": {
        title: "Package pickup needed",
        description: "Need someone to pick up a package for me from a local store.",
        category: "Delivery",
        estimatedPrice: 10,
        timeframe: "Today",
        isNegotiable: false
      },
      "Coffee Run": {
        title: "Coffee delivery",
        description: "Could someone grab me a coffee from my favorite café? I'll cover costs plus tip!",
        category: "Food",
        estimatedPrice: 8,
        timeframe: "Next hour",
        isNegotiable: false
      },
      "Moving Help": {
        title: "Moving assistance needed",
        description: "Need help moving some furniture and boxes. Strong back appreciated!",
        category: "Moving",
        estimatedPrice: 60,
        timeframe: "This weekend",
        isNegotiable: true
      }
    };

    return fallbacks[action] || fallbacks["Fix Something"];
  }
}