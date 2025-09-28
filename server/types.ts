export type NotificationType = "chat" | "favor" | "system";

export interface UnifiedNotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    url?: string;
    favorId?: number | string;
    chatId?: number | string;
    data?: any;
}
