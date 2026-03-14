import JsonView from '@uiw/react-json-view'
import { Badge } from '@workspace/ui/components/ui/badge'

import type { AiAssistantChatResponse } from '@/features/ai-assistant/api/assistant'

interface AssistantAnalysisTraceProps {
  analysis?: AiAssistantChatResponse['analysis']
  toolsUsed?: string[]
}

export function AssistantAnalysisTrace({
  analysis,
  toolsUsed,
}: AssistantAnalysisTraceProps) {
  const hasSteps = Boolean(analysis?.steps.length)
  const hasTools = Boolean(toolsUsed?.length)

  if (!hasSteps && !hasTools) {
    return null
  }

  return (
    <details className="mt-3 rounded-xl border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="font-medium text-foreground">Analysis trace</span>
        <div className="flex items-center gap-2">
          {analysis ? (
            <Badge variant="secondary" className="text-[10px]">
              {analysis.steps.length} steps
            </Badge>
          ) : null}
          {hasTools ? (
            <Badge variant="outline" className="text-[10px]">
              {(toolsUsed ?? []).length} tools
            </Badge>
          ) : null}
        </div>
      </summary>

      {analysis ? (
        <div className="mt-3 space-y-2">
          {analysis.steps.map((step, index) => (
            <div
              key={step.id}
              className="rounded-lg border border-border/40 bg-muted/20 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-1 leading-5">{step.summary}</p>
                </div>
                <Badge
                  variant={step.status === 'failed' ? 'outline' : 'secondary'}
                  className="text-[10px]"
                >
                  {step.status}
                </Badge>
              </div>

              {step.toolName ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {step.toolName}
                  </Badge>
                </div>
              ) : null}

              {step.toolArgs !== undefined ? (
                <div className="mt-2 overflow-x-auto rounded-md border border-border/40 bg-background px-2 py-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Arguments
                  </p>
                  <AssistantJsonView value={step.toolArgs} />
                </div>
              ) : null}

              {step.resultData !== undefined ? (
                <div className="mt-2 overflow-x-auto rounded-md border border-border/40 bg-background px-2 py-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Result
                  </p>
                  <AssistantJsonView value={step.resultData} />
                </div>
              ) : step.resultPreview ? (
                <pre className="mt-2 overflow-x-auto rounded-md bg-background px-2 py-1.5 text-[10px] text-foreground">
                  {step.resultPreview}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : hasTools ? (
        <div className="mt-3 border-t border-border/50 pt-2">
          Used tools: {(toolsUsed ?? []).join(', ')}
        </div>
      ) : null}
    </details>
  )
}

function AssistantJsonView({ value }: { value: unknown }) {
  if (
    value === null ||
    ['string', 'number', 'boolean'].includes(typeof value)
  ) {
    return (
      <pre className="overflow-x-auto text-[10px] text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return (
      <JsonView
        value={value as object}
        collapsed={2}
        displayDataTypes={false}
        displayObjectSize={true}
        enableClipboard={true}
        shortenTextAfterLength={80}
        style={{
          backgroundColor: 'transparent',
          fontSize: '10px',
          fontFamily:
            'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          ['--w-rjv-background-color' as string]: 'transparent',
          ['--w-rjv-color' as string]: 'hsl(var(--foreground))',
          ['--w-rjv-line-color' as string]: 'hsl(var(--border) / 0.4)',
          ['--w-rjv-arrow-color' as string]: 'hsl(var(--muted-foreground))',
          ['--w-rjv-key-string' as string]: 'hsl(var(--foreground))',
          ['--w-rjv-key-number' as string]: 'hsl(var(--foreground))',
          ['--w-rjv-type-string-color' as string]: 'hsl(var(--primary))',
          ['--w-rjv-type-int-color' as string]: 'hsl(var(--foreground))',
          ['--w-rjv-type-float-color' as string]: 'hsl(var(--foreground))',
          ['--w-rjv-type-boolean-color' as string]:
            'hsl(var(--chart-2, var(--foreground)))',
          ['--w-rjv-type-null-color' as string]: 'hsl(var(--muted-foreground))',
          ['--w-rjv-type-undefined-color' as string]:
            'hsl(var(--muted-foreground))',
          ['--w-rjv-curlybraces-color' as string]:
            'hsl(var(--muted-foreground))',
          ['--w-rjv-brackets-color' as string]: 'hsl(var(--muted-foreground))',
          ['--w-rjv-colon-color' as string]: 'hsl(var(--muted-foreground))',
          ['--w-rjv-quotes-color' as string]: 'hsl(var(--muted-foreground))',
          ['--w-rjv-quotes-string-color' as string]:
            'hsl(var(--muted-foreground))',
        }}
      />
    )
  }

  return (
    <pre className="overflow-x-auto text-[10px] text-foreground">
      {String(value)}
    </pre>
  )
}
