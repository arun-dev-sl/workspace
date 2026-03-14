import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, KeyRound, ShieldCheck } from 'lucide-react'

import { useAuthSession } from '@/app/auth-session-context'
import { MainLayout } from '@/components/layouts'
import {
  listAccountPasskeys,
  registerAccountPasskey,
} from '@/features/auth/api/account-passkeys'
import { Badge } from '@workspace/ui/components/ui/badge'
import { Button } from '@workspace/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/ui/table'

function maskCredentialId(value: string) {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const AccountPage = () => {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()

  const passkeysQuery = useQuery({
    queryKey: ['account', 'passkeys'],
    queryFn: listAccountPasskeys,
  })

  const registerMutation = useMutation({
    mutationFn: registerAccountPasskey,
    onSuccess: async (credentials) => {
      queryClient.setQueryData(['account', 'passkeys'], credentials)
      await queryClient.invalidateQueries({ queryKey: ['account', 'passkeys'] })
    },
  })

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <CardTitle>Account Security</CardTitle>
                  <CardDescription>
                    Register passkeys for faster, phishing-resistant sign-in.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                <p className="text-sm font-medium text-foreground">
                  Signed in as
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user?.email ?? 'Unknown user'}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Passkeys
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add a passkey on this device or in your password manager.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                  className="gap-2"
                >
                  <Fingerprint className="size-4" />
                  {registerMutation.isPending
                    ? 'Registering…'
                    : 'Register passkey'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Security posture
              </CardTitle>
              <CardDescription>
                Quick view of your current account protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
                <span>Registered passkeys</span>
                <Badge variant="secondary">
                  {passkeysQuery.data?.length ?? 0}
                </Badge>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
                Passkeys use the browser's WebAuthn flow already wired into the
                app. This page uses your active session instead of asking for
                your email again.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>Registered passkeys</CardTitle>
            <CardDescription>
              Devices and credential records currently linked to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passkeysQuery.isLoading ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                Loading passkeys...
              </div>
            ) : passkeysQuery.data && passkeysQuery.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credential</TableHead>
                    <TableHead>Device type</TableHead>
                    <TableHead>Transports</TableHead>
                    <TableHead>Backed up</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passkeysQuery.data.map((credential) => (
                    <TableRow key={credential.id}>
                      <TableCell className="font-mono text-xs text-foreground">
                        {maskCredentialId(credential.credentialId)}
                      </TableCell>
                      <TableCell>
                        {credential.deviceType ?? 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {credential.transports?.join(', ') ?? 'Not reported'}
                      </TableCell>
                      <TableCell>
                        {credential.backedUp ? 'Yes' : 'No'}
                      </TableCell>
                      <TableCell>{formatDate(credential.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                No passkeys registered yet. Add one to enable passkey sign-in
                for this account.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

export default AccountPage
