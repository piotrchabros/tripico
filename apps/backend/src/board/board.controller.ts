import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BoardService } from './board.service';
import { CreateBoardPostDto } from './dto/create-board-post.dto';
import { UpdateBoardPostDto } from './dto/update-board-post.dto';

@Controller()
export class BoardController {
  constructor(private readonly board: BoardService) {}

  @Post('trips/:tripId/board')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: CreateBoardPostDto,
  ) {
    return this.board.create(tripId, user.id, dto);
  }

  @Get('trips/:tripId/board')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
  ) {
    return this.board.list(tripId, user.id, limit);
  }

  @Get('board-posts/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.board.get(id, user.id);
  }

  @Patch('board-posts/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBoardPostDto,
  ) {
    return this.board.update(id, user.id, dto);
  }

  @Delete('board-posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.board.remove(id, user.id);
  }
}
