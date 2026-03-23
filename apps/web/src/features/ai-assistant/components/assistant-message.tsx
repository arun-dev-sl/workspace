import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import rehypeKatex from 'rehype-katex'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { AssistantMetricCard, parseMetricBlock } from '@/features/ai-assistant/components/assistant-metric-card'
import { AssistantSuggestedActions } from '@/features/ai-assistant/components/assistant-suggested-actions'

interface AssistantMessageProps {
  content: string
  isStreaming?: boolean
  activeTools?: string[]
  onSuggestedAction?: (action: string) => void
}

type ParsedBlock =
  | { type: 'markdown'; content: string }
  | { type: 'actions'; items: string[] }
  | { type: 'metric'; data: { label: string; value: string; trend?: 'up' | 'down' | 'flat'; change?: string } }

function parseStructuredContent(raw: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const blockRegex = /:::(actions|metric)\n([\s\S]*?):::/g
  let lastIndex = 0

  for (const match of raw.matchAll(blockRegex)) {
    const beforeText = raw.slice(lastIndex, match.index)
    if (beforeText.trim()) {
      blocks.push({ type: 'markdown', content: beforeText })
    }

    const blockType = match[1]
    const blockContent = match[2]?.trim() ?? ''

    if (blockType === 'actions') {
      const items = blockContent.split('\n').map((l) => l.trim()).filter(Boolean)
      if (items.length > 0) {
        blocks.push({ type: 'actions', items })
      }
    } else if (blockType === 'metric') {
      const metric = parseMetricBlock(blockContent)
      if (metric) {
        blocks.push({ type: 'metric', data: metric })
      }
    }

    lastIndex = (match.index ?? 0) + match[0].length
  }

  const remaining = raw.slice(lastIndex)
  if (remaining.trim()) {
    blocks.push({ type: 'markdown', content: remaining })
  }

  if (blocks.length === 0 && raw.trim()) {
    blocks.push({ type: 'markdown', content: raw })
  }

  return blocks
}

export function AssistantMessage({ content, isStreaming, activeTools, onSuggestedAction }: AssistantMessageProps) {
  const hasActiveTools = activeTools && activeTools.length > 0

  const blocks = useMemo(() => {
    if (!content || isStreaming) return []
    return parseStructuredContent(content)
  }, [content, isStreaming])

  return (
    <div>
      {hasActiveTools && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {activeTools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <LoaderCircle className="size-2.5 animate-spin" />
              {tool}
            </span>
          ))}
        </div>
      )}

      {isStreaming ? (
        content ? (
          <div className="prose prose-sm max-w-none wrap-anywhere prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-ul:my-2 prose-li:my-1 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-foreground prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border/60 prose-pre:bg-background prose-table:block prose-table:overflow-x-auto prose-table:text-sm prose-th:text-left prose-td:align-top [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_.katex]:text-foreground dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {content}
            </ReactMarkdown>
            <span className="inline-block size-2 animate-pulse rounded-full bg-foreground/40" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {hasActiveTools ? 'Running tools...' : 'Thinking...'}
          </div>
        )
      ) : blocks.length > 0 ? (
        <div>
          {blocks.map((block, i) => {
            if (block.type === 'markdown') {
              return (
                <div key={i} className="prose prose-sm max-w-none wrap-anywhere prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-ul:my-2 prose-li:my-1 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-foreground prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border/60 prose-pre:bg-background prose-table:block prose-table:overflow-x-auto prose-table:text-sm prose-th:text-left prose-td:align-top [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_.katex]:text-foreground dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code(props) {
                        const { children, className, ...rest } = props as {
                          children?: React.ReactNode
                          className?: string
                        }
                        return (
                          <code className={[className, 'wrap-anywhere'].filter(Boolean).join(' ')} {...rest}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {block.content}
                  </ReactMarkdown>
                </div>
              )
            }
            if (block.type === 'metric') {
              return <AssistantMetricCard key={i} metric={block.data} />
            }
            if (block.type === 'actions' && onSuggestedAction) {
              return <AssistantSuggestedActions key={i} actions={block.items} onAction={onSuggestedAction} />
            }
            return null
          })}
        </div>
      ) : null}
    </div>
  )
}
