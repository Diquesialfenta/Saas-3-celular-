import Link from "next/link";
import { FolderKanban } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, Input, PageHeader, Progress, Select, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { createProjectAction } from "./actions";

export const metadata = { title: "Proyectos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ estado?: string; nuevo?: string; cliente?: string }> }) {
  const ctx = await requireWorkspace();
  const { estado, nuevo, cliente } = await searchParams;
  const visibility: Prisma.ProjectWhereInput = ctx.can("projects.view_all") ? {} : { OR: [{ managerId: ctx.user.id }, { tasks: { some: { assigneeId: ctx.user.id } } }] };
  const statusFilter: Prisma.ProjectWhereInput =
    estado === "completados" ? { status: { in: ["COMPLETED", "CANCELED"] } } : { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } };
  const [projects, clients, templates, members] = await Promise.all([
    db.project.findMany({
      where: { workspaceId: ctx.workspaceId, ...visibility, ...statusFilter },
      include: { client: { select: { name: true } }, tasks: { where: { parentId: null }, select: { status: true, dueDate: true } }, deliverables: { select: { status: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.template.findMany({ where: { workspaceId: ctx.workspaceId, type: "PROJECT" } }),
    db.membership.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } }),
  ]);

  const form = (
    <ActionForm action={createProjectAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Cliente" htmlFor="clientId" className="sm:col-span-2">
        <Select id="clientId" name="clientId" defaultValue={cliente} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nombre del proyecto" htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" required />
      </Field>
      <Field label="Plantilla" htmlFor="templateId" hint="Crea etapas, tareas e hitos automáticamente.">
        <Select id="templateId" name="templateId" defaultValue={templates[0]?.id}>
          <option value="">Sin plantilla</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Responsable" htmlFor="managerId">
        <Select id="managerId" name="managerId" defaultValue={ctx.user.id}>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Inicio" htmlFor="startDate">
        <Input id="startDate" name="startDate" type="date" />
      </Field>
      <Field label="Entrega" htmlFor="dueDate" hint="Si usas plantilla se calcula sola.">
        <Input id="dueDate" name="dueDate" type="date" />
      </Field>
      <Field label={`Presupuesto (${ctx.workspace.currency})`} htmlFor="budget">
        <Input id="budget" name="budget" inputMode="decimal" />
      </Field>
      <Field label="Descripción" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" />
      </Field>
      <div className="sm:col-span-2 flex justify-end">
        <SubmitButton>Crear proyecto</SubmitButton>
      </div>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Etapas, tareas, hitos, entregables y archivos de cada cliente, visibles para él en su portal."
        actions={
          ctx.can("projects.manage") &&
          clients.length > 0 && (
            <Modal trigger="Crear proyecto" title="Nuevo proyecto" wide>
              {form}
            </Modal>
          )
        }
      />
      {nuevo && ctx.can("projects.manage") && clients.length > 0 && (
        <Card className="p-6 mb-6 pop">
          <h2 className="text-lg mb-4">Nuevo proyecto</h2>
          {form}
        </Card>
      )}
      <Tabs
        current={estado === "completados" ? "/app/proyectos?estado=completados" : "/app/proyectos"}
        items={[
          { href: "/app/proyectos", label: "En curso" },
          { href: "/app/proyectos?estado=completados", label: "Completados" },
        ]}
      />
      {projects.length === 0 ? (
        <Card>
          <EmptyState icon={<FolderKanban className="size-5" />} title="No hay proyectos aquí" description={clients.length === 0 ? "Añade primero un cliente." : "Crea un proyecto desde una plantilla o deja que el onboarding lo cree al firmarse un contrato."} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {projects.map((p) => {
            const done = p.tasks.filter((t) => t.status === "DONE").length;
            const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
            const late = p.tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < new Date()).length;
            const review = p.deliverables.filter((d) => d.status === "IN_REVIEW").length;
            return (
              <Link key={p.id} href={`/app/proyectos/${p.id}`} className="lift block rounded-[var(--radius-md)] border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-[13px] text-muted truncate">{p.client.name}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-5 flex items-center justify-between text-[13px] text-muted mb-1.5">
                  <span>
                    {done} de {p.tasks.length} tareas
                  </span>
                  <span className="tabular-nums">{pct} %</span>
                </div>
                <Progress value={pct} />
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-muted">Entrega {date(p.dueDate, { day: "numeric", month: "short" })}</span>
                  {late > 0 && <span className="text-danger">{late} con retraso</span>}
                  {review > 0 && <span className="text-warn">{review} en revisión</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
