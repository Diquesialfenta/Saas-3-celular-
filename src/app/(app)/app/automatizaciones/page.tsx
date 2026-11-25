import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { ACTIONS, RECIPES, TRIGGERS, type ActionDef } from "@/lib/automations";
import { ActionButton } from "@/components/forms";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { deleteAutomationAction, installRecipeAction, toggleAutomationAction } from "./actions";

export const metadata = { title: "Automatizaciones" };

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace("automations.manage");
  const { vista } = await searchParams;
  const [automations, runs] = await Promise.all([
    db.automation.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "asc" } }),
    db.automationRun.findMany({ where: { workspaceId: ctx.workspaceId }, include: { automation: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Cuando ocurre algo (se acepta una propuesta, se firma un contrato, se paga una factura…), se ejecutan solas las acciones que elijas."
        actions={<ButtonLink href="/app/automatizaciones/nueva">Crear automatización</ButtonLink>}
      />
      <Tabs
        current={vista === "historial" ? "/app/automatizaciones?vista=historial" : "/app/automatizaciones"}
        items={[
          { href: "/app/automatizaciones", label: "Automatizaciones", count: automations.length },
          { href: "/app/automatizaciones?vista=historial", label: "Historial de ejecuciones" },
        ]}
      />
      {vista === "historial" ? (
        <Card>
          {runs.length === 0 ? (
            <EmptyState title="Aún no se ha ejecutado ninguna automatización" />
          ) : (
            <ul>
              {runs.map((r) => (
                <li key={r.id} className="px-5 py-3 border-b border-line last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.status === "SUCCESS" ? "ok" : r.status === "PARTIAL" ? "warn" : "danger"}>{r.status === "SUCCESS" ? "Correcta" : r.status === "PARTIAL" ? "Parcial" : "Fallida"}</Badge>
                    <span className="text-sm font-medium">{r.automation.name}</span>
                    <span className="text-[12px] text-muted ml-auto">{relative(r.createdAt)}</span>
                  </div>
                  <ul className="mt-1.5 grid gap-0.5">
                    {(r.log as { action: string; ok: boolean; detail: string }[]).map((l, i) => (
                      <li key={i} className={`text-[13px] ${l.ok ? "text-muted" : "text-danger"}`}>
                        {l.ok ? "✓" : "✕"} {ACTIONS[l.action as keyof typeof ACTIONS]?.label ?? l.action}: {l.detail}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-3">
            {automations.length === 0 && (
              <Card>
                <EmptyState title="No tienes automatizaciones" description="Activa una receta de abajo o crea la tuya." />
              </Card>
            )}
            {automations.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${a.isActive ? "bg-accent-strong" : "bg-line-strong"}`} />
                      <Link href={`/app/automatizaciones/${a.id}`} className="font-medium hover:underline underline-offset-2">
                        {a.name}
                      </Link>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      <span className="text-ink-2">Cuando:</span> {TRIGGERS[a.trigger as keyof typeof TRIGGERS] ?? a.trigger}
                    </p>
                    <ol className="mt-2 flex flex-wrap gap-1.5">
                      {(a.actions as ActionDef[]).map((x, i) => (
                        <li key={i}>
                          <Badge>
                            {i + 1}. {ACTIONS[x.type]?.label ?? x.type}
                          </Badge>
                        </li>
                      ))}
                    </ol>
                    <p className="text-[12px] text-faint mt-2">
                      {a.runCount} ejecuciones{a.lastRunAt ? ` · última ${relative(a.lastRunAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <ActionButton action={toggleAutomationAction} fields={{ id: a.id }} variant={a.isActive ? "secondary" : "accent"}>
                      {a.isActive ? "Pausar" : "Activar"}
                    </ActionButton>
                    <ActionButton action={deleteAutomationAction} fields={{ id: a.id }} variant="ghost" confirm="¿Eliminar la automatización?">
                      Eliminar
                    </ActionButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title="Recetas listas para usar" description="Flujos probados que puedes activar en un clic y ajustar después" />
            <ul className="grid gap-px bg-line">
              {RECIPES.map((r, i) => (
                <li key={r.name} className="bg-white flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 max-w-2xl">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-[13px] text-muted">{r.description}</p>
                  </div>
                  <ActionButton action={installRecipeAction} fields={{ index: i }}>
                    Activar receta
                  </ActionButton>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
