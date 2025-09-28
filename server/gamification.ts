// Gamification service for Favr points and achievements

interface FavrPointsAction {
  action: string;
  points: number;
  description: string;
}

export class GamificationService {
  // Point values for different actions
  private readonly POINT_VALUES: Record<string, FavrPointsAction> = {
    FAVOR_COMPLETED: { action: 'favor_completed', points: 50, description: 'Completed a favor' },
    FAVOR_POSTED: { action: 'favor_posted', points: 10, description: 'Posted a new favor' },
    FIVE_STAR_RATING: { action: 'five_star_rating', points: 25, description: 'Received 5-star rating' },
    FOUR_STAR_RATING: { action: 'four_star_rating', points: 15, description: 'Received 4-star rating' },
    QUICK_RESPONSE: { action: 'quick_response', points: 5, description: 'Quick response (under 1 hour)' },
    PROFILE_COMPLETE: { action: 'profile_complete', points: 20, description: 'Completed profile setup' },
    FIRST_FAVOR: { action: 'first_favor', points: 100, description: 'First favor milestone' },
    STREAK_WEEK: { action: 'streak_week', points: 30, description: '7-day activity streak' },
    
    // Negative actions
    FAVOR_CANCELLED: { action: 'favor_cancelled', points: -20, description: 'Cancelled accepted favor' },
    ONE_STAR_RATING: { action: 'one_star_rating', points: -15, description: 'Received 1-star rating' },
    TWO_STAR_RATING: { action: 'two_star_rating', points: -5, description: 'Received 2-star rating' },
    LATE_RESPONSE: { action: 'late_response', points: -5, description: 'Slow response time' },
  };

  // Calculate response time bonus/penalty
  calculateResponseTimePoints(responseMinutes: number): { points: number; reason: string } {
    if (responseMinutes <= 60) {
      return { points: this.POINT_VALUES.QUICK_RESPONSE.points, reason: 'Quick response' };
    } else if (responseMinutes > 240) { // 4 hours
      return { points: this.POINT_VALUES.LATE_RESPONSE.points, reason: 'Slow response' };
    }
    return { points: 0, reason: 'Normal response time' };
  }

  // Calculate rating points
  calculateRatingPoints(rating: number): { points: number; reason: string } {
    switch(rating) {
      case 5:
        return { points: this.POINT_VALUES.FIVE_STAR_RATING.points, reason: 'Excellent service' };
      case 4:
        return { points: this.POINT_VALUES.FOUR_STAR_RATING.points, reason: 'Good service' };
      case 2:
        return { points: this.POINT_VALUES.TWO_STAR_RATING.points, reason: 'Below average service' };
      case 1:
        return { points: this.POINT_VALUES.ONE_STAR_RATING.points, reason: 'Poor service' };
      default:
        return { points: 0, reason: 'Average service' };
    }
  }

  // Get user level based on points
  getUserLevel(points: number): { level: number; title: string; nextLevelPoints: number; progress: number } {
    const levels = [
      { level: 1, title: 'Newcomer', minPoints: 0, nextPoints: 100 },
      { level: 2, title: 'Helper', minPoints: 100, nextPoints: 300 },
      { level: 3, title: 'Community Star', minPoints: 300, nextPoints: 600 },
      { level: 4, title: 'Favr Expert', minPoints: 600, nextPoints: 1000 },
      { level: 5, title: 'Community Hero', minPoints: 1000, nextPoints: 1500 },
      { level: 6, title: 'Favr Master', minPoints: 1500, nextPoints: 2500 },
      { level: 7, title: 'Legend', minPoints: 2500, nextPoints: 5000 },
      { level: 8, title: 'Favr Champion', minPoints: 5000, nextPoints: 10000 },
    ];

    const currentLevel = levels.find(level => points >= level.minPoints && points < level.nextPoints) || levels[levels.length - 1];
    const progress = currentLevel.nextPoints > 0 ? 
      Math.round(((points - currentLevel.minPoints) / (currentLevel.nextPoints - currentLevel.minPoints)) * 100) : 100;

    return {
      level: currentLevel.level,
      title: currentLevel.title,
      nextLevelPoints: currentLevel.nextPoints,
      progress
    };
  }

  // Get leaderboard position
  calculateLeaderboardPosition(userPoints: number, allUserPoints: number[]): number {
    const sortedPoints = allUserPoints.sort((a, b) => b - a);
    return sortedPoints.indexOf(userPoints) + 1;
  }

  // Get achievements based on user stats
  getUserAchievements(user: any): string[] {
    const achievements: string[] = [];

    // Completion milestones
    if (user.completedFavrs >= 1) achievements.push('First Steps');
    if (user.completedFavrs >= 10) achievements.push('Getting Started');
    if (user.completedFavrs >= 50) achievements.push('Community Contributor');
    if (user.completedFavrs >= 100) achievements.push('Helping Hand');
    if (user.completedFavrs >= 500) achievements.push('Community Pillar');

    // Rating achievements
    if (parseFloat(user.averageRating) >= 4.8 && user.totalRatings >= 10) {
      achievements.push('Five Star Helper');
    }
    if (parseFloat(user.averageRating) >= 4.5 && user.totalRatings >= 50) {
      achievements.push('Trusted Helper');
    }

    // Points milestones
    if (user.favrPoints >= 1000) achievements.push('Point Collector');
    if (user.favrPoints >= 5000) achievements.push('Point Master');

    // Time-based achievements
    const memberDays = Math.floor((Date.now() - new Date(user.memberSince).getTime()) / (1000 * 60 * 60 * 24));
    if (memberDays >= 30) achievements.push('Monthly Member');
    if (memberDays >= 365) achievements.push('Veteran');

    return achievements;
  }

  // Generate point summary for user profile
  generatePointSummary(pointsHistory: any[]): {
    totalEarned: number;
    totalLost: number;
    netPoints: number;
    topReasons: { reason: string; points: number }[];
  } {
    const totalEarned = pointsHistory.filter(p => p.points > 0).reduce((sum, p) => sum + p.points, 0);
    const totalLost = Math.abs(pointsHistory.filter(p => p.points < 0).reduce((sum, p) => sum + p.points, 0));
    
    // Group by reason and sum points
    const reasonGroups = pointsHistory.reduce((acc, p) => {
      acc[p.reason] = (acc[p.reason] || 0) + p.points;
      return acc;
    }, {} as Record<string, number>);

    const topReasons = Object.entries(reasonGroups)
      .sort(([,a], [,b]) => (Number(b) || 0) - (Number(a) || 0))
      .slice(0, 5)
      .map(([reason, points]) => ({ reason, points: Number(points) || 0 }));

    return {
      totalEarned,
      totalLost,
      netPoints: totalEarned - totalLost,
      topReasons: topReasons as { reason: string; points: number }[]
    };
  }

  // Check for milestone achievements
  checkMilestones(oldPoints: number, newPoints: number, completedFavrs: number): string[] {
    const achievements: string[] = [];

    // Point milestones
    const pointMilestones = [100, 500, 1000, 2500, 5000, 10000];
    for (const milestone of pointMilestones) {
      if (oldPoints < milestone && newPoints >= milestone) {
        achievements.push(`${milestone} Points Achieved!`);
      }
    }

    // Favor milestones
    const favorMilestones = [1, 5, 10, 25, 50, 100];
    for (const milestone of favorMilestones) {
      if (completedFavrs === milestone) {
        achievements.push(`${milestone} Favors Completed!`);
      }
    }

    return achievements;
  }

  // Get recommended actions to earn more points
  getRecommendedActions(userStats: any): string[] {
    const recommendations: string[] = [];

    if (!userStats.profilePicture) {
      recommendations.push('Add a profile picture (+10 points)');
    }
    if (!userStats.bio) {
      recommendations.push('Write a bio (+10 points)');
    }
    if (userStats.averageRating < 4.0) {
      recommendations.push('Improve service quality for better ratings');
    }
    if (userStats.responseTimeAvg > 120) {
      recommendations.push('Respond faster to earn quick response bonuses');
    }

    return recommendations;
  }
}

export const gamificationService = new GamificationService();