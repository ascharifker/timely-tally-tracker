import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Trash2, KeyRound, Mail, Info } from "lucide-react";
import { type AppRole } from "@/hooks/useUserRole";
import { ROLE_LABEL } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUsers,
  inviteUser,
  resendInvite,
  copyLinkForUser,
  changeUserRole,
  deleteUser,
  type AdminUserRow,
} from "@/lib/admin-users.functions";

const ROLE_OPTIONS: AppRole[] = [
  "admin",
  "manager",
  "po_editor",
  "engineer",
  "quality",
  "coe_reviewer",
  "third_party_reviewer",
  "production_editor",
  "viewer",
];

const PUBLIC_APP_URL = "https://mego-produccion.lovable.app";

export function UsersPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const inviteFn = useServerFn(inviteUser);
  const resendFn = useServerFn(resendInvite);
  const linkFn = useServerFn(copyLinkForUser);
  const roleFn = useServerFn(changeUserRole);
  const deleteFn = useServerFn(deleteUser);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("manager");
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link: string; email: string }>({
    open: false,
    link: "",
    email: "",
  });
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const inviteMut = useMutation({
    mutationFn: () => inviteFn({ data: { email: inviteEmail, role: inviteRole } }),
    onSuccess: (res) => {
      const sentTo = inviteEmail;
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("manager");
      invalidate();
      if (res.action_link) {
        setLinkDialog({ open: true, link: res.action_link, email: sentTo });
      }
      if (res.email_sent) {
        toast.success("Invite emailed", { description: "Use the live-app link shown here if the email link fails." });
      } else {
        toast.success("Invite processed", { description: sentTo });
      }
    },
    onError: (e: Error) => toast.error("Invite failed", { description: e.message }),
  });

  const resendMut = useMutation({
    mutationFn: (v: { user_id: string; email: string; role: AppRole }) => resendFn({ data: v }),
    onSuccess: (res, v) => {
      invalidate();
      if (res.action_link) {
        setLinkDialog({ open: true, link: res.action_link, email: v.email });
      }
      if (res.email_sent) {
        toast.success("Fresh invite emailed", { description: "Copy the live-app link shown here for WhatsApp." });
      } else {
        toast.success("Invite re-sent", { description: v.email });
      }
    },
    onError: (e: Error) => toast.error("Resend failed", { description: e.message }),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => roleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("User deleted");
      setToDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  const handleCopyLink = async (email: string, type: "invite" | "recovery") => {
    try {
      const res = await linkFn({ data: { email, type } });
      setLinkDialog({ open: true, link: res.action_link, email });
    } catch (e) {
      toast.error("Could not generate link", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Users</h2>
          <p className="text-xs text-muted-foreground">Invite-only. New invites are emailed automatically.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Invite user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite user</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button disabled={!inviteEmail || inviteMut.isPending} onClick={() => inviteMut.mutate()}>
                {inviteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2.5 items-start">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">How invites work</p>
          <p>New users receive an email with a "Set your password" link that opens the live app: <span className="font-mono text-foreground">{PUBLIC_APP_URL}</span>.</p>
          <p>Do <strong>not</strong> send them a Lovable editor, preview, or project URL — those are for project editors only and will show "Access denied".</p>
          <p>If a user sees "Internal Lovable project" or "Access denied", delete that message and resend/copy a fresh invite from this Users tab.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Last sign-in</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No users.</td></tr>
            ) : (
              users.map((u) => {
                const currentRole = (u.roles[0] as AppRole) ?? "viewer";
                const neverSignedIn = !u.last_sign_in_at;
                const setupRequired = !u.email_confirmed || neverSignedIn;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-3 py-2">{u.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={currentRole}
                        onValueChange={(v) => roleMut.mutate({ user_id: u.id, role: v as AppRole })}
                      >
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      {setupRequired ? (
                        <div className="space-y-1">
                          <Badge variant="outline">Setup needed</Badge>
                          <p className="text-[11px] text-muted-foreground">Send or copy setup link before sign-in.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge>Active</Badge>
                          <p className="text-[11px] text-muted-foreground">Use normal sign-in or password reset.</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {u.email && setupRequired ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={resendMut.isPending}
                              onClick={() => resendMut.mutate({ user_id: u.id, email: u.email!, role: currentRole })}
                            >
                              {resendMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                              Resend setup
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyLink(u.email!, "invite")}>
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copy setup link
                            </Button>
                          </>
                        ) : u.email ? (
                          <Button size="sm" variant="ghost" onClick={() => handleCopyLink(u.email!, "recovery")}>
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Password reset
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(u)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={linkDialog.open} onOpenChange={(o) => setLinkDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link for {linkDialog.email}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Single-use, expires in ~1 hour. Send this live-app link by WhatsApp if the email link opens an access wall.</p>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog.link} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(linkDialog.link);
                toast.success("Copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the auth account and all role assignments. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}