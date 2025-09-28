import { formatDistanceToNow, addHours, isAfter } from "date-fns";

export interface FavorExpirationInfo {
  timeRemaining: string;
  isExpired: boolean;
  postedTime: string;
  urgencyLevel: 'high' | 'medium' | 'low';
}

export function calculateFavorExpiration(createdAt: string, timeframe: string): FavorExpirationInfo {
  const postDate = new Date(createdAt);
  const now = new Date();
  
  // Check for outdated relative timeframes using actual hours, not calendar days
  const hoursSincePosted = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
  
  // Auto-expire outdated relative timeframes that contain "today" after 24 hours
  if (timeframe.toLowerCase().includes('today') && hoursSincePosted >= 24) {
    return {
      timeRemaining: 'Expired',
      isExpired: true,
      postedTime: formatDistanceToNow(postDate, { addSuffix: true }),
      urgencyLevel: 'high'
    };
  }
  
  // Auto-expire outdated relative timeframes after 24 hours
  if (timeframe.toLowerCase() === 'today' && hoursSincePosted >= 24) {
    return {
      timeRemaining: 'Expired',
      isExpired: true,
      postedTime: formatDistanceToNow(postDate, { addSuffix: true }),
      urgencyLevel: 'high'
    };
  }
  
  if (timeframe.toLowerCase() === 'this week' && hoursSincePosted >= (7 * 24)) {
    return {
      timeRemaining: 'Expired',
      isExpired: true,
      postedTime: formatDistanceToNow(postDate, { addSuffix: true }),
      urgencyLevel: 'high'
    };
  }
  
  // Handle ASAP requests older than 24 hours
  if (timeframe.toLowerCase().includes('asap') && hoursSincePosted >= 24) {
    return {
      timeRemaining: 'Expired',
      isExpired: true,
      postedTime: formatDistanceToNow(postDate, { addSuffix: true }),
      urgencyLevel: 'high'
    };
  }
  
  // Handle specific date formats (e.g., "August 31st, 2025", "July 16th, 2025")
  const specificDateMatch = timeframe.match(/(\w+)\s+(\d+)\w*,?\s+(\d{4})/);
  if (specificDateMatch) {
    const [, monthName, day, year] = specificDateMatch;
    const monthMap: { [key: string]: number } = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    
    const targetDate = new Date(parseInt(year), monthMap[monthName.toLowerCase()], parseInt(day));
    const isExpired = isAfter(now, targetDate);
    const urgencyLevel: 'high' | 'medium' | 'low' = isExpired ? 'high' : 
      (targetDate.getTime() - now.getTime()) < (7 * 24 * 60 * 60 * 1000) ? 'medium' : 'low';
    
    const timeRemaining = isExpired 
      ? 'Expired' 
      : `${formatDistanceToNow(targetDate)} left`;
    
    const postedTime = formatDistanceToNow(postDate, { addSuffix: true });
    
    return {
      timeRemaining,
      isExpired,
      postedTime,
      urgencyLevel
    };
  }
  
  // Determine expiration based on timeframe
  let hoursToExpire = 24; // default
  let urgencyLevel: 'high' | 'medium' | 'low' = 'medium';
  
  switch (timeframe.toLowerCase()) {
    case 'asap':
      hoursToExpire = 24; // 24-hour window for ASAP
      urgencyLevel = 'high';
      break;
    case 'flexible':
      hoursToExpire = 336; // 2 weeks for flexible
      urgencyLevel = 'low';
      break;
    case 'expired':
      return {
        timeRemaining: 'Expired',
        isExpired: true,
        postedTime: formatDistanceToNow(postDate, { addSuffix: true }),
        urgencyLevel: 'high'
      };
    case 'in 1 hour':
    case '1 hour':
      hoursToExpire = 2;
      urgencyLevel = 'high';
      break;
    case 'today':
    case 'this morning':
    case 'this afternoon':
      hoursToExpire = 12;
      urgencyLevel = 'high';
      break;
    case 'tomorrow':
    case 'friday morning':
      hoursToExpire = 24;
      urgencyLevel = 'medium';
      break;
    case 'this week':
      hoursToExpire = 120; // 5 days
      urgencyLevel = 'medium';
      break;
    case 'this weekend':
    case 'next week':
      hoursToExpire = 168; // 1 week
      urgencyLevel = 'low';
      break;
    case 'next month':
      hoursToExpire = 720; // 30 days
      urgencyLevel = 'low';
      break;
  }
  
  const expirationDate = addHours(postDate, hoursToExpire);
  const isExpired = isAfter(now, expirationDate);
  
  const timeRemaining = isExpired 
    ? 'Expired' 
    : `${formatDistanceToNow(expirationDate)} left`;
    
  const postedTime = formatDistanceToNow(postDate, { addSuffix: true });
  
  return {
    timeRemaining,
    isExpired,
    postedTime,
    urgencyLevel
  };
}

export function getUrgencyColor(urgencyLevel: 'high' | 'medium' | 'low'): string {
  switch (urgencyLevel) {
    case 'high': return 'text-red-400';
    case 'medium': return 'text-orange-400';
    case 'low': return 'text-green-400';
  }
}