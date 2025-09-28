// AI Moderation Reporting System
export interface ModerationEvent {
  id: string;
  timestamp: Date;
  type: 'chat_blocked' | 'favor_blocked' | 'dispute_analyzed' | 'suggestion_given';
  severity: 'low' | 'medium' | 'high';
  userId?: string;
  favorId?: number;
  content: string;
  issues: string[];
  action: string;
  confidence: number;
}

class ModerationReporter {
  private events: ModerationEvent[] = [];

  logEvent(event: Omit<ModerationEvent, 'id' | 'timestamp'>) {
    const moderationEvent: ModerationEvent = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event
    };

    this.events.push(moderationEvent);
    
    // Keep only last 1000 events to avoid memory issues
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log important events
    if (event.severity === 'high') {
      console.log('HIGH SEVERITY AI MODERATION EVENT:', moderationEvent);
    }
  }

  getReport(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentEvents: ModerationEvent[];
    topIssues: Array<{ issue: string; count: number }>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const issueCount: Record<string, number> = {};

    this.events.forEach(event => {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count issues
      event.issues.forEach(issue => {
        issueCount[issue] = (issueCount[issue] || 0) + 1;
      });
    });

    // Sort issues by frequency
    const topIssues = Object.entries(issueCount)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySeverity,
      recentEvents: this.events.slice(-50), // Last 50 events
      topIssues
    };
  }

  // Get events for a specific user
  getUserEvents(userId: string): ModerationEvent[] {
    return this.events.filter(event => event.userId === userId);
  }

  // Get events for a specific favor
  getFavorEvents(favorId: number): ModerationEvent[] {
    return this.events.filter(event => event.favorId === favorId);
  }

  // Clear old events
  cleanup(daysToKeep: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    this.events = this.events.filter(event => event.timestamp > cutoffDate);
    console.log(`Cleaned up moderation events, ${this.events.length} events remaining`);
  }
}

export const moderationReporter = new ModerationReporter();