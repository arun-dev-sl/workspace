import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import {
  deleteConversation,
  listConversations,
  renameConversation,
} from '@/features/ai-assistant/api/assistant'
import { useAiAssistant } from '@/features/ai-assistant/ai-assistant-context'
import { Button } from '@workspace/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/ui/dropdown-menu'
import { ScrollArea } from '@workspace/ui/components/ui/scroll-area'
import { cn } from '@workspace/ui/lib/utils'

export function ConversationSidebar() {
  const { conversationId, loadConversation, startNewConversation } =
    useAiAssistant()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => listConversations(30, 0),
    staleTime: 10_000,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleRename = async (id: string) => {
    const trimmed = editTitle.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    try {
      await renameConversation(id, trimmed)
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
    } catch {
      // silently fail
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id)
      if (conversationId === id) {
        startNewConversation()
      }
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
    } catch {
      // silently fail
    }
  }

  const conversations = data?.data ?? []

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/60 bg-muted/20">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Threads
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={startNewConversation}
          aria-label="New conversation"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {isLoading ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No past conversations
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conversationId === conv.id
              const isEditing = editingId === conv.id

              return (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <MessageSquare className="size-3.5 shrink-0" />

                  {isEditing ? (
                    <input
                      className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => void handleRename(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(conv.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void loadConversation(conv.id)}
                    >
                      <p className="truncate text-xs font-medium leading-tight">
                        {conv.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(parseISO(conv.updatedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </button>
                  )}

                  {!isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Conversation options"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditTitle(conv.title)
                            setEditingId(conv.id)
                          }}
                        >
                          <PenLine className="mr-2 size-3.5" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleDelete(conv.id)}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
