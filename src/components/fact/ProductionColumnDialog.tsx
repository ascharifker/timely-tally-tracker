import type { Job, Machine, PartTime } from "@/lib/fact-types";
import type { BoardColumn } from "@/lib/production-board";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { getUrgency } from "@/lib/job-urgency";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ProductionColumnDialog({ column, jobs, machines, partTimes, activeRunIds, onClose, onJobClick }: {
  column: BoardColumn | null; jobs: Job[]; machines: Machine[]; partTimes: PartTime[];
  activeRunIds: Set<string>; onClose: () => void; onJobClick?: (job: Job) => void;
}) {
  const [search, setSearch] = useState("");
  const [workshop, setWorkshop] = useState("all");
  const external = column?.status === "TALLER_EXTERNO";
  const filtered = jobs.filter((j) => [j.odf, j.pir, j.tube_spec].some((v) => v?.toLowerCase().includes(search.toLowerCase())) &&
    (!external || workshop === "all" || (workshop === "unassigned" ? !machines.some((m) => m.id === j.machine_id && m.type === "external_shop") : j.machine_id === workshop)));
  return <Dialog open={!!column} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-6xl h-[85dvh] flex flex-col overflow-hidden">
      <DialogHeader className="pr-8">
        <DialogTitle>{column?.label}</DialogTitle>
        <DialogDescription>{jobs.length} ODTs · {jobs.reduce((sum, j) => sum + jobDurationHours(j, partTimes).hours, 0).toLocaleString("es", { maximumFractionDigits: 1 })} h de maquinado</DialogDescription>
      </DialogHeader>
      <div className="flex gap-3 flex-wrap">
        <Input aria-label="Buscar en columna" placeholder="Buscar ODT, PIR o número de tubo…" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        {external && <Select value={workshop} onValueChange={setWorkshop}><SelectTrigger className="w-56" aria-label="Filtrar taller"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">Todos los talleres</SelectItem>
          {machines.filter((m) => m.type === "external_shop").map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          <SelectItem value="unassigned">Sin taller asignado</SelectItem>
        </SelectContent></Select>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table><TableHeader><TableRow>
          <TableHead>ODT</TableHead><TableHead>PIR / Revisión</TableHead><TableHead>Número de Tubo</TableHead><TableHead>Cantidad</TableHead><TableHead>Horas</TableHead>
          {external && <TableHead>Taller</TableHead>}<TableHead>Fecha cliente</TableHead><TableHead>Fecha de exportación</TableHead><TableHead>Urgencia / Corrida</TableHead>
        </TableRow></TableHeader><TableBody>
          {filtered.map((j) => <TableRow key={j.id}>
            <TableCell><Button variant="link" className="p-0 h-auto font-mono" onClick={() => onJobClick?.(j)}>{j.odf}</Button></TableCell>
            <TableCell className="whitespace-nowrap">{j.pir ?? "—"}<div className="text-xs text-muted-foreground">Rev. {j.pir_rev ?? "—"}</div></TableCell>
            <TableCell className="min-w-40 max-w-64 break-words">{j.tube_spec ?? "—"}</TableCell><TableCell>{j.qty}</TableCell>
            <TableCell className="whitespace-nowrap">{jobDurationHours(j, partTimes).hours.toLocaleString("es", { maximumFractionDigits: 1 })} h</TableCell>
            {external && <TableCell className="whitespace-nowrap">{machines.find((m) => m.id === j.machine_id && m.type === "external_shop")?.name ?? "Sin taller asignado"}</TableCell>}
            <TableCell className="whitespace-nowrap">{j.customer_date ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{j.export_date ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap">{getUrgency(j)?.label ?? "Normal"}<div className="text-xs text-muted-foreground">{activeRunIds.has(j.id) ? "Corrida en curso" : "Sin corrida activa"}</div></TableCell>
          </TableRow>)}
          {!filtered.length && <TableRow><TableCell colSpan={external ? 9 : 8} className="py-12 text-center text-muted-foreground">{jobs.length ? "Sin resultados" : "Sin ODTs en esta columna"}</TableCell></TableRow>}
        </TableBody></Table>
      </div>
    </DialogContent>
  </Dialog>;
}
