/** Estructuras de contenido de las plantillas y plantillas iniciales de cada cuenta nueva. */

export type ProposalTemplate = {
  title: string;
  summary: string;
  sections: { title: string; body: string }[];
  items: { name: string; description?: string; quantity: number; unitPrice: number; recurring?: string; isOptional?: boolean }[];
  depositPercent?: number;
  validDays?: number;
};

export type ContractTemplate = { title: string; body: string };

export type ProjectTemplate = {
  objectives: string[];
  stages: { name: string; offsetDays?: number; tasks: { title: string; offsetDays?: number; priority?: string; forClient?: boolean }[] }[];
  milestones: { title: string; offsetDays: number }[];
};

export type DocumentTemplate = { kind: string; title: string; body: string };

export type EmailTemplate = { subject: string; body: string };

export type OnboardingTemplate = {
  welcomeTitle: string;
  welcomeBody: string;
  formId?: string | null;
  projectTemplateId?: string | null;
  bookingLinkId?: string | null;
  fileRequest?: string | null;
};

export const TEMPLATE_TYPE_LABELS = {
  PROPOSAL: "Propuesta",
  CONTRACT: "Contrato",
  FORM: "Formulario",
  PROJECT: "Proyecto",
  DOCUMENT: "Documento",
  ONBOARDING: "Onboarding",
  EMAIL: "Correo",
} as const;

export const TEMPLATE_VARIABLES = [
  "{{cliente.nombre}}",
  "{{cliente.email}}",
  "{{cliente.direccion}}",
  "{{cliente.documento}}",
  "{{empresa.nombre}}",
  "{{empresa.email}}",
  "{{empresa.direccion}}",
  "{{empresa.documento}}",
  "{{propuesta.titulo}}",
  "{{propuesta.total}}",
  "{{propuesta.numero}}",
  "{{propuesta.alcance}}",
  "{{propuesta.anticipo}}",
  "{{fecha.hoy}}",
];

export const STARTER_TEMPLATES: { type: keyof typeof TEMPLATE_TYPE_LABELS; name: string; description: string; content: unknown }[] = [
  {
    type: "PROPOSAL",
    name: "Propuesta de servicio por proyecto",
    description: "Estructura base: contexto, alcance, entregables, calendario y condiciones.",
    content: {
      title: "Propuesta de servicios",
      summary: "Resumen de lo que haremos, en cuánto tiempo y con qué inversión.",
      sections: [
        { title: "Contexto y objetivos", body: "Describe la situación actual del cliente y lo que quiere conseguir." },
        { title: "Alcance del servicio", body: "Qué incluye y qué no incluye el trabajo." },
        { title: "Entregables", body: "Lista de entregables concretos y su formato." },
        { title: "Calendario", body: "Fases principales y fechas estimadas." },
        { title: "Condiciones", body: "Forma de pago, revisiones incluidas y plazos de respuesta." },
      ],
      items: [],
      depositPercent: 50,
      validDays: 15,
    } satisfies ProposalTemplate,
  },
  {
    type: "CONTRACT",
    name: "Contrato de prestación de servicios",
    description: "Contrato general con variables de cliente, empresa y propuesta.",
    content: {
      title: "Contrato de prestación de servicios",
      body: `Entre {{empresa.nombre}} ({{empresa.documento}}), con domicilio en {{empresa.direccion}}, en adelante "el Proveedor", y {{cliente.nombre}} ({{cliente.documento}}), con domicilio en {{cliente.direccion}}, en adelante "el Cliente", se acuerda lo siguiente:

1. Objeto
El Proveedor prestará al Cliente los servicios descritos en la propuesta {{propuesta.numero}} "{{propuesta.titulo}}".

2. Alcance
{{propuesta.alcance}}

3. Precio y forma de pago
El precio total es de {{propuesta.total}}. El Cliente abonará un anticipo de {{propuesta.anticipo}} al inicio del trabajo y el resto según el calendario de facturación acordado.

4. Plazos y entregas
Las entregas se publicarán en el portal privado del Cliente, donde podrá aprobarlas o solicitar cambios dentro del número de revisiones acordado.

5. Confidencialidad
Ambas partes mantendrán confidencial la información recibida de la otra parte durante y después de la relación.

6. Propiedad intelectual
Una vez abonado el precio total, los derechos de explotación de los entregables finales se transfieren al Cliente.

7. Resolución
Cualquiera de las partes podrá resolver el contrato con un preaviso de 15 días por escrito. Se abonará el trabajo realizado hasta esa fecha.

Firmado electrónicamente el {{fecha.hoy}}.`,
    } satisfies ContractTemplate,
  },
  {
    type: "PROJECT",
    name: "Proyecto estándar en 4 fases",
    description: "Descubrimiento, producción, revisión y entrega, con tareas y hitos.",
    content: {
      objectives: ["Entregar el alcance acordado en plazo", "Mantener al cliente informado cada semana"],
      stages: [
        {
          name: "Descubrimiento",
          tasks: [
            { title: "Reunión estratégica inicial", offsetDays: 2, priority: "HIGH" },
            { title: "Completar el formulario de briefing", offsetDays: 3, forClient: true, priority: "HIGH" },
            { title: "Redactar brief estratégico", offsetDays: 5 },
          ],
        },
        {
          name: "Producción",
          tasks: [
            { title: "Plan de trabajo detallado", offsetDays: 7 },
            { title: "Primera versión de entregables", offsetDays: 14, priority: "HIGH" },
          ],
        },
        {
          name: "Revisión",
          tasks: [
            { title: "Revisión del cliente", offsetDays: 17, forClient: true },
            { title: "Aplicar cambios solicitados", offsetDays: 20 },
          ],
        },
        { name: "Entrega", tasks: [{ title: "Entrega final y cierre", offsetDays: 24, priority: "HIGH" }] },
      ],
      milestones: [
        { title: "Brief aprobado", offsetDays: 5 },
        { title: "Primera versión entregada", offsetDays: 14 },
        { title: "Entrega final", offsetDays: 24 },
      ],
    } satisfies ProjectTemplate,
  },
  {
    type: "DOCUMENT",
    name: "Documento de bienvenida",
    description: "Explica al cliente cómo trabajaremos juntos.",
    content: {
      kind: "WELCOME",
      title: "Bienvenido a {{empresa.nombre}}",
      body: `Hola {{cliente.nombre}},

Gracias por confiar en nosotros. En este portal encontrarás todo lo relacionado con tu proyecto: el calendario, las entregas, los documentos, las facturas y un canal directo con el equipo.

Próximos pasos:
1. Completa el formulario de información inicial.
2. Sube los archivos que te pedimos.
3. Agenda la reunión estratégica inicial.

Cualquier duda, escríbenos desde la sección Mensajes.`,
    } satisfies DocumentTemplate,
  },
  {
    type: "EMAIL",
    name: "Recordatorio de factura",
    description: "Correo amable para facturas próximas a vencer.",
    content: {
      subject: "Recordatorio: factura pendiente de {{empresa.nombre}}",
      body: "Hola {{cliente.nombre}},\n\nTe recordamos que tienes una factura pendiente. Puedes verla y pagarla desde tu portal.\n\nGracias.",
    } satisfies EmailTemplate,
  },
];

export const STARTER_FORM = {
  name: "Información inicial del cliente",
  description: "Lo que necesitamos saber para empezar.",
  fields: [
    { id: "objetivo", type: "textarea", label: "¿Cuál es el objetivo principal del proyecto?", required: true },
    { id: "publico", type: "textarea", label: "¿A quién se dirige?", required: true },
    { id: "referencias", type: "textarea", label: "Referencias o ejemplos que te gusten", required: false },
    { id: "fecha", type: "date", label: "Fecha límite deseada", required: false },
    { id: "presupuesto", type: "select", label: "Prioridad", required: true, options: ["Plazo", "Calidad", "Coste"] },
  ],
};
