import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Client } from '@/hooks/useClients';
import { useEnablePortal, useDisablePortal, useResetPortalPassword } from '@/hooks/useClientPortal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  isEnabled: boolean;
}

export function PortalAccessDialog({ open, onOpenChange, client, isEnabled }: Props) {
  const [password, setPassword] = useState('');
  const enablePortal = useEnablePortal();
  const disablePortal = useDisablePortal();
  const resetPassword = useResetPortalPassword();

  const close = () => {
    setPassword('');
    onOpenChange(false);
  };

  const handleEnable = async () => {
    if (!client) return;
    await enablePortal.mutateAsync({ clientId: client.id, email: client.email!, password });
    close();
  };

  const handleReset = async () => {
    if (!client) return;
    await resetPassword.mutateAsync({ clientId: client.id, password });
    close();
  };

  const handleDisable = async () => {
    if (!client) return;
    await disablePortal.mutateAsync({ clientId: client.id });
    close();
  };

  const isLoading = enablePortal.isPending || disablePortal.isPending || resetPassword.isPending;
  const missingEmail = !client?.email;

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && (o ? onOpenChange(o) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEnabled ? 'Manage Portal Access' : 'Enable Portal Access'}</DialogTitle>
          <DialogDescription>
            {isEnabled
              ? `${client?.name} can already sign in to the client portal with ${client?.email}. Set a new password below to reset it, or revoke access entirely.`
              : `Create a client portal login for ${client?.name}. They'll sign in with their email and the password you set here.`}
          </DialogDescription>
        </DialogHeader>

        {missingEmail ? (
          <p className="text-sm text-destructive">
            This client has no email on file. Add one on their profile before enabling portal access.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Login Email</Label>
              <Input value={client?.email ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-password">{isEnabled ? 'New Password' : 'Password'}</Label>
              <Input
                id="portal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEnabled ? (
            <Button variant="destructive" onClick={handleDisable} disabled={isLoading}>
              Revoke Access
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={isEnabled ? handleReset : handleEnable}
              disabled={isLoading || missingEmail || password.length < 6}
            >
              {isEnabled ? 'Reset Password' : 'Enable Access'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
