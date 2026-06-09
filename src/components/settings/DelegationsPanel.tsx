import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { listUsers } from "@/lib/admin-users.functions";
import {
  listDelegations,
  createDelegation,
  deleteDelegation,
  type DelegationRow,
} from "@/lib/delegations.functions";

const TRACK_LABEL: Record<DelegationRow["track"], string> = {
  coe: "COE",
  third_party: "Third-Party",
  internal: "Internal",
};

export function DelegationsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDelegations);
  const usersFn = useServerFn(listUsers);
  const createFn = useServerFn(createDelegation);
  const deleteFn = useServerFn(deleteDelegation);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-delegations"],
    queryFn: () => listFn(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => usersFn(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_user_id: "",
    to_user_id: "",
    track: "coe" as DelegationRow["track"],
    start_date: today,
    end_date: today,
    note: "",
  });
  const [toDelete, setToDelete] = useState<DelegationRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-delegations"] });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          from_user_id: form.from_user_id,
          to_user_id: form.to_user_id,
          track: form.track,
          start_date: form.start_date,
          end_date: form.end_date,
          note: form.note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Delegation created");
      setOpen(false);
      setForm({
        from_user_id: "",
        to_user_id: "",
        track: "coe",
        start_date: today,
        end_date: today,
        note: "",
      });
      invalidate();
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Delegation removed");
      setToDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  const valid =
    form.from_user_id &&
    form.to_user_id &&
    form.from_user_id !== form.to_user_id &&
    form.start_date &&
    form.end_date &&
    form.start_date <= form.end_date;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-5 w-5" /> Vacation delegations
          </h2>
          <p className="text-xs text-muted-foreground">
            Temporarily grant a reviewer's track-edit rights to another user. Active
            delegations let the delegate edit POs in that track as if they had the role.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New delegation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New delegation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>From (on vacation)</Label>
                <Select
                  value={form.from_user_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, from_user_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.email ?? u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To (covering)</Label>
                <Select
                  value={form.to_user_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, to_user_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.email ?? u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Track</Label>
                <Select
                  value={form.track}
                  onValueChange={(v) => setForm((f) => ({ ...f, track: v as DelegationRow["track"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coe">COE</SelectItem>
                    <SelectItem value="third_party">Third-Party</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. PTO coverage"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={!valid || createMut.isPending} onClick={() => createMut.mutate()}>
                {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">From</th>
              <th className="text-left px-3 py-2 font-medium">To</th>
              <th className="text-left px-3 py-2 font-medium">Track</th>
              <th className="text-left px-3 py-2 font-medium">Window</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No delegations.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.from_email ?? r.from_user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{r.to_email ?? r.to_user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{TRACK_LABEL[r.track]}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-3 py-2">
                    {r.active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40" variant="outline">Active</Badge>
                    ) : r.start_date > today ? (
                      <Badge variant="outline">Upcoming</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{r.note ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(r)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove delegation?</AlertDialogTitle>
            <AlertDialogDescription>
              The delegate will immediately lose their track-edit rights for the affected track.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}