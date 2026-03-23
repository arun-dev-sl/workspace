import { BadRequestException, Controller, Get, Post, Request, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { AiAssistantService } from '@/modules/ai-assistant/application/services/ai-assistant.service'
import {
  AiAssistantChatRequestSchema

} from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'

import type { AiAssistantChatRequest } from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'
import type { FastifyRequest } from 'fastify'

@ApiTags('ai-assistant')
@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
@SetMetadata('request_timeout_ms', null)
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check OpenWire availability and available models' })
  getStatus() {
    return this.aiAssistantService.getStatus()
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the local AI assistant using query-only tool orchestration' })
  chat(
    @Request() req: FastifyRequest & { user: { id: string } },
  ) {
    const parsedInput = AiAssistantChatRequestSchema.safeParse(req.body)

    if (!parsedInput.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parsedInput.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const input: AiAssistantChatRequest = parsedInput.data
    return this.aiAssistantService.chat(input, req.user.id)
  }
}
