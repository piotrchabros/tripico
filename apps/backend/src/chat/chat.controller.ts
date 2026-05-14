import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ChatService } from './chat.service';

@Controller('trips')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(':tripId/messages')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
  ) {
    return this.chat.listMessages(tripId, user.id, limit);
  }
}
