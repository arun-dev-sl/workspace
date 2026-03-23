import { appPaths } from '@/config/app-paths'
import { clearStoredTokens, getRefreshToken } from '@/lib/auth'
import { apiRequest } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@workspace/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/ui/dropdown-menu'
import { UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const NavUser = ({ username }: { username: string | undefined }) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = async () => {
    try {
      const refreshToken = getRefreshToken()
      await apiRequest({
        method: 'POST',
        url: '/api/auth/logout',
        data: { refreshToken: refreshToken ?? '' },
        toastSuccess: true,
        successMessage: 'Logged out',
      })
    } finally {
      clearStoredTokens()
      // Invalidate the session query to clear cached user data
      await queryClient.invalidateQueries({
        queryKey: ['auth', 'session'],
      })
      navigate(appPaths.auth.login.getHref())
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem className="text-xs">{username}</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate(appPaths.auth.account.getHref())}
        >
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { NavUser }
