import { Module } from '@nestjs/common'

import { DIVIDENDS_REPOSITORY } from './application/ports/dividends.repository.port'
import { DividendsService } from './application/services/dividends.service'
import { DividendsRepository } from './infrastructure/repositories/dividends.repository'
import { DividendsController } from './presentation/controllers/dividends.controller'

@Module({
  controllers: [DividendsController],
  providers: [
    DividendsService,
    {
      provide: DIVIDENDS_REPOSITORY,
      useClass: DividendsRepository,
    },
  ],
  exports: [DividendsService],
})
export class DividendsModule {}
