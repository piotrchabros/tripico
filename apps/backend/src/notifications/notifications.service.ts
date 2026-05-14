import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../shared/constants/notification-types';

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Service-internal: emit a notification. Other services call this on
   * domain events. No external broadcast here yet — the WS chat gateway
   * may later re-emit "notification:new" on the user's socket.
   */
  async create(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ) {
    return this.prisma.notification.create({
      data: {
        user: { connect: { id: userId } },
        type,
        payload: payload as never,
      },
      select: NOTIFICATION_SELECT,
    });
  }

  async list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const where: Record<string, unknown> = { userId };
    if (opts.unreadOnly) where['readAt'] = null;

    const [data, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: NOTIFICATION_SELECT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      data,
      meta: { unreadCount, hasMore: data.length === limit },
    };
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, readAt: true },
    });
    if (!notification) throw new NotFoundException('NOTIFICATION_NOT_FOUND');
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      select: NOTIFICATION_SELECT,
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { markedAsRead: count };
  }
}
