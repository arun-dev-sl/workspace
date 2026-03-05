import { Module } from '@nestjs/common'

import { PRINCIPAL_REPOSITORY } from './application/ports/principal.repository.port'
import { PrincipalService } from './application/services/principal.service'
import { PrincipalRepository } from './infrastructure/repositories/principal.repository'
import { PrincipalController } from './presentation/controllers/principal.controller'

@Module({
  controllers: [PrincipalController],
  providers: [
    PrincipalService,
    {
      provide: PRINCIPAL_REPOSITORY,
      useClass: PrincipalRepository,
    },
  ],
  exports: [PrincipalService],
})
export class PrincipalModule {}
