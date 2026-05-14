import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardCommentDto } from './dto/create-comment.dto';
import { CreateBoardPostDto } from './dto/create-board-post.dto';
import { UpdateBoardPostDto } from './dto/update-board-post.dto';

const POST_SELECT = {
  id: true,
  tripId: true,
  authorId: true,
  type: true,
  content: true,
  pinnedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      displayName: true,
      slug: true,
      avatarUrl: true,
      isVerifiedBadge: true,
    },
  },
} as const;

const COMMENT_SELECT = {
  id: true,
  postId: true,
  authorId: true,
  text: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      displayName: true,
      slug: true,
      avatarUrl: true,
      isVerifiedBadge: true,
    },
  },
} as const;

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tripId: string, userId: string, dto: CreateBoardPostDto) {
    await this.assertCanParticipate(tripId, userId);
    return this.prisma.boardPost.create({
      data: {
        trip: { connect: { id: tripId } },
        author: { connect: { id: userId } },
        type: dto.type ?? 'TEXT',
        content: { text: dto.text },
      },
      select: POST_SELECT,
    });
  }

  async list(tripId: string, userId: string, limit = 20) {
    await this.assertCanParticipate(tripId, userId);
    const data = await this.prisma.boardPost.findMany({
      where: { tripId, deletedAt: null },
      orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 50),
      select: POST_SELECT,
    });
    return { data, meta: { hasMore: data.length === limit } };
  }

  async get(id: string, userId: string) {
    const post = await this.findOrThrow(id);
    await this.assertCanParticipate(post.tripId, userId);
    return post;
  }

  async update(id: string, userId: string, dto: UpdateBoardPostDto) {
    const post = await this.findOrThrow(id);
    if (post.authorId !== userId) {
      throw new ForbiddenException('NOT_POST_AUTHOR');
    }
    if (dto.text === undefined) return post;

    const currentContent = (post.content ?? {}) as Record<string, unknown>;
    return this.prisma.boardPost.update({
      where: { id },
      data: { content: { ...currentContent, text: dto.text } },
      select: POST_SELECT,
    });
  }

  async remove(id: string, userId: string) {
    const post = await this.findOrThrow(id);
    const trip = await this.prisma.trip.findFirst({
      where: { id: post.tripId, deletedAt: null },
      select: { organizerId: true },
    });
    const isAuthor = post.authorId === userId;
    const isOrganizer = trip?.organizerId === userId;
    if (!isAuthor && !isOrganizer) {
      throw new ForbiddenException('NOT_AUTHOR_OR_ORGANIZER');
    }
    await this.prisma.boardPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addComment(postId: string, userId: string, dto: CreateBoardCommentDto) {
    const post = await this.findOrThrow(postId);
    await this.assertCanParticipate(post.tripId, userId);
    return this.prisma.boardComment.create({
      data: {
        post: { connect: { id: postId } },
        author: { connect: { id: userId } },
        text: dto.text.trim(),
      },
      select: COMMENT_SELECT,
    });
  }

  async listComments(postId: string, userId: string) {
    const post = await this.findOrThrow(postId);
    await this.assertCanParticipate(post.tripId, userId);
    return this.prisma.boardComment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: COMMENT_SELECT,
    });
  }

  async removeComment(commentId: string, userId: string) {
    const comment = await this.prisma.boardComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { id: true, authorId: true, post: { select: { tripId: true } } },
    });
    if (!comment) throw new NotFoundException('COMMENT_NOT_FOUND');
    const trip = await this.prisma.trip.findFirst({
      where: { id: comment.post.tripId, deletedAt: null },
      select: { organizerId: true },
    });
    const isAuthor = comment.authorId === userId;
    const isOrganizer = trip?.organizerId === userId;
    if (!isAuthor && !isOrganizer) {
      throw new ForbiddenException('NOT_AUTHOR_OR_ORGANIZER');
    }
    await this.prisma.boardComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  private async findOrThrow(id: string) {
    const post = await this.prisma.boardPost.findFirst({
      where: { id, deletedAt: null },
      select: POST_SELECT,
    });
    if (!post) throw new NotFoundException('POST_NOT_FOUND');
    return post;
  }

  private async assertCanParticipate(tripId: string, userId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { id: true, organizerId: true },
    });
    if (!trip) throw new NotFoundException('TRIP_NOT_FOUND');
    if (trip.organizerId === userId) return;

    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.role !== 'MEMBER' || membership.leftAt) {
      throw new ForbiddenException('NOT_TRIP_PARTICIPANT');
    }
  }
}
