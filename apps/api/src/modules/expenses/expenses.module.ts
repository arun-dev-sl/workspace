import { Module } from '@nestjs/common'

import { AuthModule } from '@/modules/auth/auth.module'
import { EMAIL_PARSERS } from '@/modules/expenses/application/ports/email-parser.port'
import { MERCHANT_RULE_REPOSITORY } from '@/modules/expenses/application/ports/merchant-rule.repository.port'
import { STATEMENT_REPOSITORY } from '@/modules/expenses/application/ports/statement.repository.port'
import { TRANSACTION_REPOSITORY } from '@/modules/expenses/application/ports/transaction.repository.port'
import { ExpensesService } from '@/modules/expenses/application/services/expenses.service'
import { GmailOAuthService } from '@/modules/expenses/application/services/gmail-oauth.service'
import { ChaseEmailParser } from '@/modules/expenses/infrastructure/parsers/chase-email.parser'
import { HdfcEmailParser } from '@/modules/expenses/infrastructure/parsers/hdfc-email.parser'
import { MerchantCategoryRuleRepositoryImpl } from '@/modules/expenses/infrastructure/repositories/merchant-rule.repository'
import { StatementRepositoryImpl } from '@/modules/expenses/infrastructure/repositories/statement.repository'
import { TransactionRepositoryImpl } from '@/modules/expenses/infrastructure/repositories/transaction.repository'
import { ExpensesController } from '@/modules/expenses/presentation/controllers/expenses.controller'
import { GmailDisconnectController } from '@/modules/expenses/presentation/controllers/gmail-disconnect.controller'
import { GmailOAuthController } from '@/modules/expenses/presentation/controllers/gmail-oauth.controller'
import { SharedEmailSyncModule } from '@/shared/shared-email-sync.module'

@Module({
  imports: [AuthModule, SharedEmailSyncModule],
  controllers: [ExpensesController, GmailOAuthController, GmailDisconnectController],
  providers: [
    ExpensesService,
    GmailOAuthService,
    ChaseEmailParser,
    HdfcEmailParser,
    {
      provide: EMAIL_PARSERS,
      useFactory: (chase: ChaseEmailParser, hdfc: HdfcEmailParser) => [hdfc, chase],
      inject: [ChaseEmailParser, HdfcEmailParser],
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepositoryImpl,
    },
    {
      provide: STATEMENT_REPOSITORY,
      useClass: StatementRepositoryImpl,
    },
    {
      provide: MERCHANT_RULE_REPOSITORY,
      useClass: MerchantCategoryRuleRepositoryImpl,
    },
  ],
  exports: [ExpensesService],
})
export class ExpensesModule {}
