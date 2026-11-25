import "server-only";
import { db } from "../db";
import { sha256 } from "../crypto";
import { fillTemplate, money } from "../format";
import { nextNumber, activity, notifyTeam } from "../audit";
import type { ContractTemplate } from "../templates";
import { appUrl } from "../config";
import { emailLayout, sendEmail } from "../email";
import { emit } from "../automations";
import { computeTotals } from "./billing";

export function contractVars(
  ws: { name: string; legalName?: string | null; email?: string | null; address?: string | null; taxId?: string | null },
  client: { name: string; email?: string | null; address?: string | null; taxId?: string | null },
  proposal?: {
    title: string;
    number: string;
    currency: string;
    taxRate: number;
    discount: number;
    depositPercent: number;
    sections: unknown;
    items: { name: string; quantity: number; unitPrice: number; isOptional: boolean; isSelected: boolean }[];
  } | null,
) {
  let total = "";
  let deposit = "";
  let scope = "";
  if (proposal) {
    const lines = proposal.items
      .filter((i) => !i.isOptional || i.isSelected)
      .map((i) => ({ description: i.name, quantity: i.quantity, unitPrice: i.unitPrice }));
    const t = computeTotals(lines, proposal.taxRate, proposal.discount).total;
    total = money(t, proposal.currency);
    deposit = money(Math.round((t * proposal.depositPercent) / 100), proposal.currency);
    scope = lines.map((l) => `- ${l.description}${l.quantity !== 1 ? ` (x${l.quantity})` : ""}`).join("\n");
  }
  return {
    cliente: { nombre: client.name, email: client.email ?? "", direccion: client.address ?? "", documento: client.taxId ?? "" },
    empresa: { nombre: ws.legalName || ws.name, email: ws.email ?? "", direccion: ws.address ?? "", documento: ws.taxId ?? "" },
    propuesta: { titulo: proposal?.title ?? "", numero: proposal?.number ?? "", total, anticipo: deposit, alcance: scope },
    fecha: { hoy: new Date().toLocaleDateString("es", { dateStyle: "long" }) },
  };
}

export async function createContract(input: {
  workspaceId: string;
  clientId: string;
  proposalId?: string | null;
  templateId?: string | null;
  title?: string;
  body?: string;
  providerName: string;
  providerEmail: string;
}) {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: input.workspaceId } });
  const client = await db.client.findFirstOrThrow({ where: { id: input.clientId, workspaceId: input.workspaceId }, include: { contacts: true } });
  const proposal = input.proposalId
    ? await db.proposal.findFirst({ where: { id: input.proposalId, workspaceId: input.workspaceId }, include: { items: true } })
    : null;
  let tpl: ContractTemplate | null = null;
  if (input.templateId) {
    const t = await db.template.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId, type: "CONTRACT" } });
    tpl = (t?.content as ContractTemplate) ?? null;
  }
  const vars = contractVars(ws, client, proposal);
  const title = fillTemplate(input.title || tpl?.title || `Contrato · ${proposal?.title ?? client.name}`, vars);
  const body = fillTemplate(input.body || tpl?.body || "", vars);
  const primary = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  const clientEmail = proposal?.acceptedByEmail || primary?.email || client.email || "";
  const clientName = proposal?.acceptedByName || primary?.name || client.name;
  const number = await nextNumber(input.workspaceId, "contract");
  const contract = await db.contract.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: client.id,
      proposalId: proposal?.id ?? null,
      number,
      title,
      body,
      signers: {
        create: [
          { party: "PROVIDER", name: input.providerName, email: input.providerEmail, order: 0 },
          { party: "CLIENT", name: clientName, email: clientEmail, order: 1 },
        ],
      },
    },
  });
  await activity({ workspaceId: input.workspaceId, clientId: client.id, content: `Contrato ${number} creado` });
  return contract;
}

export async function sendContract(workspaceId: string, contractId: string) {
  const c = await db.contract.findFirst({ where: { id: contractId, workspaceId }, include: { signers: true, workspace: true } });
  if (!c) throw new Error("Contrato no encontrado");
  if (c.status === "SIGNED" || c.status === "VOID") throw new Error("El contrato ya no se puede enviar.");
  const hash = sha256(`${c.title}\n${c.body}`);
  await db.contract.update({ where: { id: c.id }, data: { status: c.status === "DRAFT" ? "SENT" : c.status, sentAt: new Date(), contentHash: hash } });
  const links: { name: string; email: string; url: string; emailed: boolean }[] = [];
  for (const s of c.signers.filter((s) => !s.signedAt && s.party === "CLIENT")) {
    const url = appUrl(`/firmar/${s.token}`);
    let emailed = false;
    if (s.email) {
      const r = await sendEmail({
        workspaceId,
        to: s.email,
        subject: `${c.workspace.name} te envía un contrato para firmar`,
        html: emailLayout(c.workspace, c.title, `Hola ${s.name},\n\nTienes pendiente la firma del contrato ${c.number}. Puedes leerlo completo y firmarlo desde el enlace.`, {
          label: "Revisar y firmar",
          url,
        }),
      });
      emailed = r.ok;
    }
    links.push({ name: s.name, email: s.email, url, emailed });
  }
  return links;
}

/** Registra la firma de un firmante: guarda trazo, IP, agente y la huella SHA-256 del contenido. */
export async function signContract(input: { signerId: string; typedName: string; signatureData: string; ip: string | null; userAgent: string | null }) {
  const signer = await db.contractSigner.findUnique({ where: { id: input.signerId }, include: { contract: true } });
  if (!signer) throw new Error("Firmante no encontrado");
  const c = signer.contract;
  if (c.status === "VOID") throw new Error("El contrato está anulado.");
  if (signer.signedAt) return c;
  if (!input.signatureData.startsWith("data:image/png;base64,") || input.signatureData.length > 400_000) {
    throw new Error("La firma no es válida.");
  }
  const hash = c.contentHash ?? sha256(`${c.title}\n${c.body}`);
  await db.contractSigner.update({
    where: { id: signer.id },
    data: { signedAt: new Date(), typedName: input.typedName, signatureData: input.signatureData, ip: input.ip, userAgent: input.userAgent?.slice(0, 300), hashAtSigning: hash },
  });
  const signers = await db.contractSigner.findMany({ where: { contractId: c.id } });
  const all = signers.every((s) => s.signedAt);
  const updated = await db.contract.update({
    where: { id: c.id },
    data: { status: all ? "SIGNED" : "PARTIALLY_SIGNED", signedAt: all ? new Date() : null, contentHash: hash },
  });
  await activity({ workspaceId: c.workspaceId, clientId: c.clientId, content: `${input.typedName} firmó el contrato ${c.number}` });
  if (all) {
    await notifyTeam(c.workspaceId, { title: `Contrato ${c.number} firmado`, link: `/app/contratos/${c.id}` });
    await emit(c.workspaceId, "contract.signed", { clientId: c.clientId, contractId: c.id, proposalId: c.proposalId ?? undefined });
  }
  return updated;
}
