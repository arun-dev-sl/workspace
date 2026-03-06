import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";

import { MainLayout } from "@/components/layouts";
import { getExpenseEmail } from "@/features/expenses/api/get-expense-email";
import { appPaths } from "@/config/app-paths";
import { Button } from "@workspace/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import { Separator } from "@workspace/ui/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/ui/tabs";
import { ScrollArea } from "@workspace/ui/components/ui/scroll-area";
import { Badge } from "@workspace/ui/components/ui/badge";
import { ArrowLeft, Hash, Mail } from "lucide-react";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

function toHeadersList(raw: Record<string, string>) {
  return Object.entries(raw).sort(([a], [b]) => a.localeCompare(b));
}

function getHeader(
  raw: Record<string, string>,
  key: string,
): string | undefined {
  return raw[key.toLowerCase()];
}

function buildEmailSrcDoc(html: string) {
  // Render in a sandboxed iframe with an aggressive CSP:
  // - no scripts
  // - no external network requests
  // - allow inline styles (emails often rely on them)
  const escaped = html;
  return `<!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
              <meta name="referrer" content="no-referrer" />
              <base target="_blank" />
              <style>
                html, body { padding: 0; margin: 0; background: white; color: #111; }
                body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; line-height: 1.4; }
                img { max-width: 100%; height: auto; }
                a { color: #0a66c2; }
                pre { white-space: pre-wrap; }
              </style>
            </head>
            <body>${escaped}</body>
          </html>`;
}

export default function ExpenseEmailDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const emailQuery = useQuery({
    queryKey: ["expenses", "email", id],
    enabled: Boolean(id),
    queryFn: () => getExpenseEmail(id!),
  });

  const email = emailQuery.data;

  const headersList = useMemo(
    () => (email ? toHeadersList(email.rawHeaders) : []),
    [email],
  );

  const envelope = useMemo(() => {
    if (!email) return null;
    const h = email.rawHeaders;
    return {
      to: getHeader(h, "to"),
      cc: getHeader(h, "cc"),
      replyTo: getHeader(h, "reply-to"),
      messageId: getHeader(h, "message-id"),
      contentType: getHeader(h, "content-type"),
      mimeVersion: getHeader(h, "mime-version"),
      listUnsubscribe: getHeader(h, "list-unsubscribe"),
    };
  }, [email]);

  const srcDoc = useMemo(() => {
    if (!email?.bodyHtml) return null;
    return buildEmailSrcDoc(email.bodyHtml);
  }, [email?.bodyHtml]);

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to={appPaths.auth.expensesEmails.getHref()}>
                <ArrowLeft />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {email?.provider ?? "email"}
              </Badge>
              {email?.providerMessageId ? (
                <Badge variant="outline" className="gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {email.providerMessageId}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Expenses
            </p> */}
            <h1 className="text-2xl font-semibold text-foreground">
              Email Details
            </h1>
            <p className="max-w-fit text-sm text-muted-foreground">
              Raw captured payload: parsed metadata + header map + HTML/text
              bodies (useful for debugging parsers and data extraction).
            </p>
          </div>
        </header>

        {emailQuery.isLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              Loading email…
            </CardContent>
          </Card>
        ) : null}

        {emailQuery.isError ? (
          <Card>
            <CardContent className="py-10 text-sm text-destructive">
              We couldn’t load this email. Please try again.
            </CardContent>
          </Card>
        ) : null}

        {email ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="border-border/60 lg:sticky lg:top-6 lg:self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Subject
                  </div>
                  <div className="font-medium">
                    {email.subject || "(no subject)"}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    From
                  </div>
                  <div className="font-mono text-xs wrap-anywhere">
                    {email.from || "Unknown sender"}
                  </div>
                </div>
                {envelope?.to ? (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        To
                      </div>
                      <div className="font-mono text-xs wrap-anywhere">
                        {envelope.to}
                      </div>
                    </div>
                  </>
                ) : null}
                {envelope?.cc ? (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Cc
                      </div>
                      <div className="font-mono text-xs wrap-anywhere">
                        {envelope.cc}
                      </div>
                    </div>
                  </>
                ) : null}
                <Separator />
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Received At
                    </div>
                    <div>{formatDate(email.receivedAt)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Internal ID
                    </div>
                    <div className="font-mono text-xs break-all">
                      {email.id}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      User ID
                    </div>
                    <div className="font-mono text-xs break-all">
                      {email.userId}
                    </div>
                  </div>
                </div>
                {envelope?.messageId ? (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Message-Id
                      </div>
                      <div className="font-mono text-xs break-all">
                        {envelope.messageId}
                      </div>
                    </div>
                  </>
                ) : null}
                {envelope?.contentType ? (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Content-Type
                      </div>
                      <div className="font-mono text-xs wrap-anywhere">
                        {envelope.contentType}
                      </div>
                    </div>
                  </>
                ) : null}
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Header Count
                  </div>
                  <div>{headersList.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 min-w-0">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base font-semibold">
                  Content
                </CardTitle>
                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-foreground/80">
                      From:
                    </span>{" "}
                    <span className="font-mono">{email.from || "Unknown"}</span>
                  </div>
                  <div className="min-w-0 truncate sm:text-right">
                    <span className="font-medium text-foreground/80">
                      Received:
                    </span>{" "}
                    {formatDate(email.receivedAt)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <Tabs defaultValue={email.bodyHtml ? "text" : "rendered"}>
                  <TabsList className="w-full overflow-x-auto">
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="rendered" disabled={!email.bodyHtml}>
                      Rendered (HTML)
                    </TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="rendered" className="mt-4">
                    {srcDoc ? (
                      <div className="overflow-hidden rounded-md border border-border/60">
                        <iframe
                          title="Email HTML"
                          sandbox=""
                          referrerPolicy="no-referrer"
                          className="h-[70vh] w-full bg-white"
                          srcDoc={srcDoc}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No HTML body captured for this email.
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Rendered in a sandboxed iframe with a restrictive CSP (no
                      scripts, no external requests).
                    </p>
                  </TabsContent>

                  <TabsContent value="text" className="mt-4">
                    <ScrollArea className="h-[70vh] w-full rounded-md border border-border/60">
                      <pre className="max-w-full p-4 font-mono text-xs leading-5 whitespace-pre-wrap wrap-anywhere">
                        {email.bodyText || "(empty)"}
                      </pre>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="headers" className="mt-4">
                    <ScrollArea className="h-[70vh] w-full rounded-md border border-border/60">
                      <div className="p-4">
                        <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
                          {headersList.map(([key, value]) => (
                            <div key={key} className="contents">
                              <div className="font-mono text-muted-foreground wrap-anywhere">
                                {key}
                              </div>
                              <div className="min-w-0 font-mono whitespace-pre-wrap wrap-anywhere">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="json" className="mt-4">
                    <ScrollArea className="h-[70vh] w-full rounded-md border border-border/60">
                      <pre className="max-w-full p-4 font-mono text-xs leading-5 whitespace-pre-wrap wrap-anywhere">
                        {JSON.stringify(email, null, 2)}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
