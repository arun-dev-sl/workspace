import { BadRequestException } from '@nestjs/common'

import type { PipeTransform, ArgumentMetadata } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * NestJS pipe that validates input against a Zod schema.
 * Throws 422 Unprocessable Entity on validation failure.
 *
 * @example
 * @Post()
 * create(@Body(new ZodValidationPipe(CreateTodoSchema)) body: CreateTodoInput) { ... }
 *
 * @example
 * @Get()
 * list(@Query(new ZodValidationPipe(ListQuerySchema)) query: ListQuery) { ... }
 */
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (result.success) {
      return result.data
    }

    throw new BadRequestException({
      message: 'Validation failed',
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }
}
