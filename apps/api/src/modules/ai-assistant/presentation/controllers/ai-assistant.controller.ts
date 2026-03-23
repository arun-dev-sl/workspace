import { BadRequestException, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, Request, Res, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'

import { AiAssistantService } from '@/modules/ai-assistant/application/services/ai-assistant.service'
import { AI_CONVERSATION_REPOSITORY } from '@/modules/ai-assistant/application/ports/ai-conversation.repository.port'
import {
  AiAssistantChatRequestSchema
} from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard'

import type { AiConversationRepository } from '@/modules/ai-assistant/application/ports/ai-conversation.repository.port'
import type { AiAssistantChatRequest } from '@/modules/ai-assistant/presentation/dtos/ai-assistant.schema'
import type { FastifyReply, FastifyRequest } from 'fastify'

@ApiTags('ai-assistant')
@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
@SetMetadata('request_timeout_ms', null)
export class AiAssistantController {
  constructor(
    private readonly aiAssistantService: AiAssistantService,
    @Inject(AI_CONVERSATION_REPOSITORY)
    private readonly conversationRepo: AiConversationRepository,
  ) {}

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

  @Post('chat/stream')
  @ApiOperation({ summary: 'Stream a chat response via SSE with real-time token and tool progress' })
  async chatStream(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Res() reply: FastifyReply,
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

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    try {
      for await (const event of this.aiAssistantService.chatStream(input, req.user.id)) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed'
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations' })
  async listConversations(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 50)
    const offset = Math.max(Number(offsetStr) || 0, 0)
    return this.conversationRepo.findConversationsByUserId(req.user.id, limit, offset)
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  async getConversation(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ) {
    const conversation = await this.conversationRepo.findConversationById(id, req.user.id)
    if (!conversation) throw new NotFoundException('Conversation not found')
    const messages = await this.conversationRepo.getMessages(id)
    return { conversation, messages }
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a conversation' })
  async updateConversation(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ) {
    const schema = z.object({ title: z.string().trim().min(1).max(200) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) throw new BadRequestException('Invalid title')

    const updated = await this.conversationRepo.updateConversationTitle(id, req.user.id, parsed.data.title)
    if (!updated) throw new NotFoundException('Conversation not found')
    return updated
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async deleteConversation(
    @Request() req: FastifyRequest & { user: { id: string } },
    @Param('id') id: string,
  ) {
    const deleted = await this.conversationRepo.deleteConversation(id, req.user.id)
    if (!deleted) throw new NotFoundException('Conversation not found')
    return { deleted: true }
  }

  @Post('messages/:id/feedback')
  @ApiOperation({ summary: 'Submit feedback for an assistant message' })
  async submitFeedback(
    @Request() _req: FastifyRequest & { user: { id: string } },
    @Param('id') messageId: string,
  ) {
    const schema = z.object({
      rating: z.enum(['thumbs_up', 'thumbs_down']),
      comment: z.string().trim().max(1000).optional(),
    })
    const parsed = schema.safeParse(_req.body)
    if (!parsed.success) throw new BadRequestException('Invalid feedback')

    return this.conversationRepo.addFeedback(messageId, parsed.data.rating, parsed.data.comment)
  }
}
