import { Global, Module } from '@nestjs/common';
import { AICategorizationService } from './ai-categorization.service';

@Global()
@Module({
  providers: [AICategorizationService],
  exports: [AICategorizationService],
})
export class AIModule {}
