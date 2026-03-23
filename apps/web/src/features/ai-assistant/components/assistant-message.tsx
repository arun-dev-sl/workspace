import rehypeKatex from 'rehype-katex'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

interface AssistantMessageProps {
  content: string
}

export function AssistantMessage({ content }: AssistantMessageProps) {
  return (
    <div className="prose prose-sm max-w-none wrap-anywhere prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-ul:my-2 prose-li:my-1 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-foreground prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border/60 prose-pre:bg-background prose-table:block prose-table:overflow-x-auto prose-table:text-sm prose-th:text-left prose-td:align-top [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_.katex]:text-foreground dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props) {
            const { inline, children, className, ...rest } = props as {
              inline?: boolean
              children?: React.ReactNode
              className?: string
            }

            if (inline) {
              return (
                <code
                  className={[className, 'wrap-anywhere']
                    .filter(Boolean)
                    .join(' ')}
                  {...rest}
                >
                  {children}
                </code>
              )
            }

            return (
              <code
                className={[className, 'wrap-anywhere']
                  .filter(Boolean)
                  .join(' ')}
                {...rest}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
