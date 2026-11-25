import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { PERMISSIONS, ROLE_LABELS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { ActionButton, ActionForm, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, Card, CardHeader, Checkbox, EmptyState, Field, Input, Notice, PageHeader, Select, Table, Tabs, Td, Th, cx } from "@/components/ui";
import { deleteDepartmentAction, deleteRoleAction, inviteMemberAction, removeMemberAction, saveDepartmentAction, saveRoleAction, updateMemberAction } from "./actions";

export const metadata = { title: "Equipo" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace("team.manage");
  const { vista = "miembros" } = await searchParams;
  if (!ctx.isCompany) {
    return (
      <>
        <PageHeader title="Equipo" />
        <Notice tone="info" action={<ButtonLink href="/app/configuracion/plan">Pasar a cuenta de empresa</ButtonLink>}>
          Los equipos, departamentos, roles y la carga de trabajo están en las cuentas de empresa. Al cambiar conservas todos tus clientes, proyectos y configuraciones.
        </Notice>
      </>
    );
  }
  const ws = ctx.workspaceId;
  const [members, roles, departments, invites] = await Promise.all([
    db.membership.findMany({ where: { workspaceId: ws }, include: { user: true, department: true, customRole: true }, orderBy: { createdAt: "asc" } }),
    db.role.findMany({ where: { workspaceId: ws }, include: { _count: { select: { members: true } } } }),
    db.department.findMany({ where: { workspaceId: ws }, include: { _count: { select: { members: true } } } }),
    db.token.findMany({ where: { workspaceId: ws, type: "TEAM_INVITE", usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const base = "/app/equipo";
  const tabs = [
    { href: base, label: "Miembros", count: members.length },
    { href: `${base}?vista=carga`, label: "Carga y productividad" },
    { href: `${base}?vista=roles`, label: "Roles y permisos" },
    { href: `${base}?vista=departamentos`, label: "Departamentos" },
  ];
  const current = vista === "miembros" ? base : `${base}?vista=${vista}`;
  const users = members.map((m) => m.user);

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Quién trabaja en qué, con qué permisos y cuánta carga lleva cada persona."
        actions={
          <Modal trigger="Invitar a alguien" title="Invitar al equipo">
            <LinkResultForm action={inviteMemberAction} className="grid gap-4" note="Enlace de invitación (7 días):">
              <Field label="Correo" htmlFor="i-email">
                <Input id="i-email" name="email" type="email" required />
              </Field>
              <Field label="Cargo" htmlFor="i-title">
                <Input id="i-title" name="title" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nivel de acceso" htmlFor="i-role">
                  <Select id="i-role" name="role" defaultValue="MEMBER">
                    {ctx.membership.role === "OWNER" && <option value="ADMIN">Administrador</option>}
                    <option value="MANAGER">Responsable</option>
                    <option value="MEMBER">Colaborador</option>
                  </Select>
                </Field>
                <Field label="Rol personalizado" htmlFor="i-crole">
                  <Select id="i-crole" name="customRoleId">
                    <option value="">Ninguno</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Departamento" htmlFor="i-dep">
                <Select id="i-dep" name="departmentId">
                  <option value="">Sin departamento</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <SubmitButton>Enviar invitación</SubmitButton>
            </LinkResultForm>
          </Modal>
        }
      />
      <Tabs items={tabs} current={current} />

      {vista === "miembros" && (
        <div className="grid gap-4">
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Persona</Th>
                  <Th>Acceso</Th>
                  <Th className="hidden md:table-cell">Departamento</Th>
                  <Th className="hidden md:table-cell">Capacidad</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={m.user.name} size={32} />
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{m.user.name}</span>
                          <span className="block text-[12px] text-muted truncate">{m.title ?? m.user.email}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{m.customRole?.name ?? ROLE_LABELS[m.role]}</Badge>
                    </Td>
                    <Td className="hidden md:table-cell text-muted">{m.department?.name ?? "—"}</Td>
                    <Td className="hidden md:table-cell text-muted tabular-nums">{m.capacityHours} h/sem</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title={m.user.name}>
                          <ActionForm action={updateMemberAction} className="grid gap-4">
                            <input type="hidden" name="id" value={m.id} />
                            <Field label="Cargo" htmlFor={`t-${m.id}`}>
                              <Input id={`t-${m.id}`} name="title" defaultValue={m.title ?? ""} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Nivel de acceso" htmlFor={`r-${m.id}`}>
                                <Select id={`r-${m.id}`} name="role" defaultValue={m.role} disabled={m.role === "OWNER"}>
                                  {m.role === "OWNER" && <option value="OWNER">Propietario</option>}
                                  <option value="ADMIN">Administrador</option>
                                  <option value="MANAGER">Responsable</option>
                                  <option value="MEMBER">Colaborador</option>
                                </Select>
                              </Field>
                              <Field label="Rol personalizado" htmlFor={`cr-${m.id}`}>
                                <Select id={`cr-${m.id}`} name="customRoleId" defaultValue={m.customRoleId ?? ""}>
                                  <option value="">Ninguno</option>
                                  {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Departamento" htmlFor={`d-${m.id}`}>
                                <Select id={`d-${m.id}`} name="departmentId" defaultValue={m.departmentId ?? ""}>
                                  <option value="">Ninguno</option>
                                  {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Horas por semana" htmlFor={`c-${m.id}`}>
                                <Input id={`c-${m.id}`} name="capacityHours" type="number" min={1} max={80} defaultValue={m.capacityHours} />
                              </Field>
                            </div>
                            <p className="text-[12px] text-muted">El rol personalizado sustituye a los permisos del nivel Responsable o Colaborador. Propietario y Administrador tienen siempre acceso total.</p>
                            <SubmitButton>Guardar</SubmitButton>
                          </ActionForm>
                        </Modal>
                        {m.role !== "OWNER" && m.userId !== ctx.user.id && (
                          <ActionButton action={removeMemberAction} fields={{ id: m.id }} variant="ghost" confirm={`¿Quitar a ${m.user.name} del equipo?`}>
                            Quitar
                          </ActionButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          {invites.length > 0 && (
            <Card>
              <CardHeader title="Invitaciones pendientes" />
              <ul className="pb-3">
                {invites.map((i) => (
                  <li key={i.id} className="flex justify-between px-5 py-1.5 text-sm">
                    <span>{i.email}</span>
                    <span className="text-muted">{ROLE_LABELS[(i.role as keyof typeof ROLE_LABELS) ?? "MEMBER"]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {vista === "carga" && <Workload workspaceId={ws} members={members.map((m) => ({ userId: m.userId, name: m.user.name, capacity: m.capacityHours, department: m.department?.name ?? null }))} />}

      {vista === "roles" && (
        <div className="grid gap-4">
          <div className="flex justify-end">
            <Modal trigger="Crear rol" title="Nuevo rol" wide>
              <RoleForm />
            </Modal>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["ADMIN", "MANAGER", "MEMBER"] as const).map((r) => (
              <Card key={r} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{ROLE_LABELS[r]}</p>
                  <Badge>Predefinido</Badge>
                </div>
                <p className="text-[13px] text-muted mt-2">{DEFAULT_ROLE_PERMISSIONS[r].map((p) => PERMISSIONS[p]).join(" · ")}</p>
              </Card>
            ))}
            {roles.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.name}</p>
                  <span className="text-[12px] text-muted">{r._count.members} persona(s)</span>
                </div>
                {r.description && <p className="text-sm text-muted">{r.description}</p>}
                <p className="text-[13px] text-muted mt-2">{r.permissions.map((p) => PERMISSIONS[p as keyof typeof PERMISSIONS]).filter(Boolean).join(" · ") || "Sin permisos"}</p>
                <div className="mt-3 flex gap-2">
                  <Modal trigger="Editar" triggerVariant="secondary" triggerSize="sm" title={r.name} wide>
                    <RoleForm role={r} />
                  </Modal>
                  <ActionButton action={deleteRoleAction} fields={{ id: r.id }} variant="ghost" confirm="¿Eliminar el rol? Sus miembros volverán a los permisos de su nivel.">
                    Eliminar
                  </ActionButton>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {vista === "departamentos" && (
        <div className="grid gap-4">
          <div className="flex justify-end">
            <Modal trigger="Crear departamento" title="Nuevo departamento">
              <DepartmentForm users={users} />
            </Modal>
          </div>
          {departments.length === 0 ? (
            <Card>
              <EmptyState title="Sin departamentos" description="Agrupa al equipo por áreas: diseño, desarrollo, cuentas, operaciones…" />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {departments.map((d) => (
                <Card key={d.id} className="p-5">
                  <p className="font-medium">{d.name}</p>
                  {d.description && <p className="text-sm text-muted">{d.description}</p>}
                  <p className="text-[13px] text-muted mt-2">
                    {d._count.members} persona(s)
                    {d.leadUserId ? ` · responsable: ${users.find((u) => u.id === d.leadUserId)?.name ?? "—"}` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Modal trigger="Editar" triggerVariant="secondary" triggerSize="sm" title={d.name}>
                      <DepartmentForm users={users} d={d} />
                    </Modal>
                    <ActionButton action={deleteDepartmentAction} fields={{ id: d.id }} variant="ghost" confirm="¿Eliminar el departamento?">
                      Eliminar
                    </ActionButton>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function RoleForm({ role }: { role?: { id: string; name: string; description: string | null; permissions: string[] } }) {
  return (
    <ActionForm action={saveRoleAction} className="grid gap-4">
      {role && <input type="hidden" name="id" value={role.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor="role-name">
          <Input id="role-name" name="name" defaultValue={role?.name} required />
        </Field>
        <Field label="Descripción" htmlFor="role-desc">
          <Input id="role-desc" name="description" defaultValue={role?.description ?? ""} />
        </Field>
      </div>
      <fieldset className="grid sm:grid-cols-2 gap-2.5">
        <legend className="text-[13px] font-medium text-ink-2 mb-2">Permisos</legend>
        {Object.entries(PERMISSIONS).map(([k, v]) => (
          <Checkbox key={k} name="permissions" value={k} defaultChecked={role?.permissions.includes(k)} label={v} />
        ))}
      </fieldset>
      <SubmitButton>Guardar rol</SubmitButton>
    </ActionForm>
  );
}

function DepartmentForm({ users, d }: { users: { id: string; name: string }[]; d?: { id: string; name: string; description: string | null; leadUserId: string | null } }) {
  return (
    <ActionForm action={saveDepartmentAction} className="grid gap-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <Field label="Nombre" htmlFor="dep-name">
        <Input id="dep-name" name="name" defaultValue={d?.name} required />
      </Field>
      <Field label="Descripción" htmlFor="dep-desc">
        <Input id="dep-desc" name="description" defaultValue={d?.description ?? ""} />
      </Field>
      <Field label="Responsable" htmlFor="dep-lead">
        <Select id="dep-lead" name="leadUserId" defaultValue={d?.leadUserId ?? ""}>
          <option value="">Sin responsable</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}

async function Workload({ workspaceId, members }: { workspaceId: string; members: { userId: string; name: string; capacity: number; department: string | null }[] }) {
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const monthAgo = new Date(Date.now() - 30 * 86400_000);
  const nextWeek = new Date(Date.now() + 7 * 86400_000);
  const [open, overdue, doneMonth, hoursWeek, estimates] = await Promise.all([
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: { not: "DONE" }, assigneeId: { not: null } }, _count: true }),
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: { not: "DONE" }, dueDate: { lt: new Date() }, assigneeId: { not: null } }, _count: true }),
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: "DONE", completedAt: { gte: monthAgo }, assigneeId: { not: null } }, _count: true }),
    db.timeEntry.groupBy({ by: ["userId"], where: { workspaceId, date: { gte: weekAgo } }, _sum: { minutes: true } }),
    db.task.groupBy({ by: ["assigneeId"], where: { workspaceId, status: { not: "DONE" }, dueDate: { lte: nextWeek }, assigneeId: { not: null } }, _sum: { estimateHours: true } }),
  ]);
  const get = <T extends { assigneeId?: string | null; userId?: string }>(arr: T[], id: string) => arr.find((x) => (x.assigneeId ?? x.userId) === id);
  return (
    <Card>
      <CardHeader title="Carga de trabajo" description="Tareas abiertas, retrasos, horas registradas en 7 días y horas estimadas para los próximos 7 días frente a la capacidad" />
      <Table>
        <thead>
          <tr>
            <Th>Persona</Th>
            <Th className="text-right">Abiertas</Th>
            <Th className="text-right">Con retraso</Th>
            <Th className="text-right">Hechas (30 d)</Th>
            <Th className="text-right">Horas (7 d)</Th>
            <Th className="w-[28%]">Ocupación próxima semana</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const est = (get(estimates, m.userId) as { _sum: { estimateHours: number | null } } | undefined)?._sum.estimateHours ?? 0;
            const pct = Math.round((est / m.capacity) * 100);
            const late = (get(overdue, m.userId) as { _count: number } | undefined)?._count ?? 0;
            return (
              <tr key={m.userId}>
                <Td>
                  <Link href={`/app/tareas`} className="font-medium">
                    {m.name}
                  </Link>
                  {m.department && <span className="block text-[12px] text-muted">{m.department}</span>}
                </Td>
                <Td className="text-right tabular-nums">{(get(open, m.userId) as { _count: number } | undefined)?._count ?? 0}</Td>
                <Td className={cx("text-right tabular-nums", late && "text-danger")}>{late}</Td>
                <Td className="text-right tabular-nums">{(get(doneMonth, m.userId) as { _count: number } | undefined)?._count ?? 0}</Td>
                <Td className="text-right tabular-nums">{(((get(hoursWeek, m.userId) as { _sum: { minutes: number | null } } | undefined)?._sum.minutes ?? 0) / 60).toFixed(1)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden">
                      <div className={cx("h-full rounded-full", pct > 100 ? "bg-danger" : pct > 80 ? "bg-warn" : "bg-accent-strong")} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className={cx("w-12 text-right text-[13px] tabular-nums", pct > 100 && "text-danger")}>{pct} %</span>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="px-5 py-3 text-[12px] text-muted border-t border-line">La ocupación usa las horas estimadas de las tareas que vencen en los próximos 7 días. Añade estimaciones en cada tarea para afinarla.</p>
    </Card>
  );
}
