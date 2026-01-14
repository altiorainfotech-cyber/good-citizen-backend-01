import { Module } from '@nestjs/common';
import { ExploreSimpleController } from './explore-simple.controller';

@Module({
  controllers: [ExploreSimpleController],
  providers: [],
})
export class ExploreSimpleModule {}