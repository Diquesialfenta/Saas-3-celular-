import type { Plan } from "@prisma/client";
import { APP_NAME } from "@/lib/config";

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
    <path className="m-arrow__stem" d="M1 6h8" />
    <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
  </svg>
);
const Chev = () => (
  <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const fmt = (cents: number, currency: string) => new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export function LandingBody({ plans }: { plans: Plan[] }) {
  const freelancer = plans.filter((p) => p.accountType === "FREELANCER");
  const company = plans.filter((p) => p.accountType === "COMPANY");
  const from = (list: typeof plans) => (list.length ? list.reduce((a, b) => (a.priceMonthly <= b.priceMonthly ? a : b)) : null);
  const f = from(freelancer);
  const c = from(company);
  const trial = f?.trialDays ?? 14;
  // Tres planes a la vista: el independiente básico, el independiente con más uso y el primero de empresa.
  const shown = [...freelancer.slice(0, 2), ...company.slice(0, 1)];
  const extra = company[1] ?? null;

  return (
    <>
      <header className="nav">
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">
            Saltar al contenido
          </a>
          <a className="nav__logo" href="#top">
            <span className="mark" data-mark="dots" aria-hidden="true" />
            {APP_NAME}
          </a>
          <nav className="nav__links" aria-label="Principal">
            <div className="nav__item">
              <a className="nav__link" href="#portal">
                Producto <Chev />
              </a>
              <div className="nav__menu">
                <div className="wrap grid">
                  <a className="menu-card span-4" href="#flujo">
                    <div className="panel">
                      <div className="stage stage--fade-br">
                        <div className="at-corner" style={{ ["--ax" as string]: "24px", ["--ay" as string]: "24px" }}>
                          <div className="d-card mini">
                            <div className="d-card__row">
                              <p className="d-t">PRO-2026-0042</p>
                              <span className="d-chip">Aceptada</span>
                            </div>
                            <p>Web corporativa · 4.800 USD</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="t-card">Propuestas y contratos</span>
                    <span className="t-small muted">Se aceptan y se firman en línea</span>
                  </a>
                  <a className="menu-card span-4" href="#portal">
                    <div className="panel">
                      <div className="stage stage--fade-br">
                        <div className="at-corner" style={{ ["--ax" as string]: "24px", ["--ay" as string]: "24px" }}>
                          <div className="d-card mini">
                            <div className="d-card__row">
                              <p className="d-t">Maqueta de inicio</p>
                              <span className="d-chip d-chip--low">En revisión</span>
                            </div>
                            <p>El cliente la aprueba desde su portal</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="t-card">Portal del cliente</span>
                    <span className="t-small muted">Con tu marca, tu color y tu logotipo</span>
                  </a>
                  <a className="menu-card span-4" href="#automatizacion">
                    <div className="panel">
                      <div className="stage stage--fade-br">
                        <div className="at-corner" style={{ ["--ax" as string]: "24px", ["--ay" as string]: "24px" }}>
                          <div className="d-card mini">
                            <div className="d-card__row">
                              <p className="d-t">Contrato firmado</p>
                              <span className="d-chip">Onboarding</span>
                            </div>
                            <p>Portal, formulario y proyecto creados</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="t-card">Automatizaciones</span>
                    <span className="t-small muted">Cada paso dispara el siguiente</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#flujo">
                Cómo funciona
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#equipos">
                Equipos
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#precios">
                Precios
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#preguntas">
                Preguntas
              </a>
            </div>
          </nav>
          <div className="nav__actions">
            <a className="nav__link" href="/login">
              Entrar
            </a>
            <a className="btn btn--primary" href="/registro">
              Empezar la prueba gratis
            </a>
          </div>
          <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menú">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <main id="top">
        {/* HERO · collage: el texto a la izquierda, la ventana de Encauza cortada por el marco, una tarjeta con el resultado */}
        <section className="hero hero--collage" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <h1 id="hero-h">Gestión de clientes para agencias y freelancers</h1>
                <p className="hero__lead">
                  Envía la propuesta, firma el contrato, cobra el anticipo y abre el portal del cliente desde un solo sitio. Desde {f ? fmt(f.priceMonthly, f.currency) : "29 US$"} al mes, con {trial} días de prueba.
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="/registro">
                    Empezar la prueba gratis
                    <Arrow />
                  </a>
                  <a className="btn btn--secondary" href="#flujo">
                    Ver cómo funciona
                  </a>
                </div>
                <p className="hero__proof">Cobros con Stripe, avisos por WhatsApp y reuniones en tu calendario.</p>
              </div>
              <div className="hero__art span-6 start-7" role="img" aria-label="La lista de propuestas de Encauza con una propuesta aceptada, y la tarjeta con el contrato y el anticipo que se generan solos">
                <div className="ly-piece ly-piece--main d-win" aria-hidden="true">
                  <div className="d-win__bar">
                    <span className="d-win__dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>Encauza · Estudio Faro</span>
                  </div>
                  <div className="d-win__body">
                    <div className="d-side">
                      <span>
                        <i />
                        Inicio
                      </span>
                      <span>
                        <i />
                        Clientes
                      </span>
                      <span className="is-on">
                        <i />
                        Propuestas
                      </span>
                      <span>
                        <i />
                        Contratos
                      </span>
                      <span>
                        <i />
                        Facturación
                      </span>
                      <span className="d-side__label">Entrega</span>
                      <span>
                        <i />
                        Proyectos
                      </span>
                      <span>
                        <i />
                        Portales
                      </span>
                    </div>
                    <div className="d-main">
                      <div className="d-main__head">
                        <h4>Propuestas</h4>
                        <span className="d-btn">Nueva propuesta</span>
                      </div>
                      <div className="d-tabs">
                        <span className="is-on">Todas 38</span>
                        <span>Esperando 6</span>
                        <span>Aceptadas 27</span>
                      </div>
                      <div className="d-rows">
                        {[
                          ["PS", "#e3f1e9", "Panadería Sol", "Web nueva · PRO-0042", "4.800", "Aceptada", ""],
                          ["CL", "#e9e4d6", "Clínica Lumbre", "Campaña de captación", "2.150", "Vista", "low"],
                          ["MV", "#e7ecf6", "Mueblería Vega", "Tienda online · fase 2", "6.900", "Enviada", "low"],
                          ["HA", "#f3e6e1", "Hostal Andes", "Fotos y redes · 3 meses", "1.200", "Aceptada", ""],
                          ["CR", "#ede7f2", "Constructora Ríos", "Identidad de marca", "3.400", "Rechazada", "out"],
                          ["OT", "#e4eef0", "Óptica Trece", "Mantenimiento web", "180/mes", "Aceptada", ""],
                        ].map(([ini, bg, name, sub, amount, status, tone]) => (
                          <div className="d-row" key={name}>
                            <span className="d-thumb d-ini" style={{ background: bg }} data-i={ini} />
                            <div>
                              <b>{name}</b>
                              <small>{sub}</small>
                            </div>
                            <span className="num">{amount}</span>
                            <span className={`d-chip${tone ? ` d-chip--${tone}` : ""}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ly-piece ly-piece--note d-card" aria-hidden="true" data-ly-steps="700">
                  <div className="d-card__row">
                    <p className="d-t">Panadería Sol aceptó</p>
                    <span className="d-chip" data-step data-step-at="4">
                      Listo
                    </span>
                  </div>
                  <div className="d-note__line" data-step>
                    <i>✓</i>
                    <span>
                      Contrato <b>CON-0042</b> enviado a firmar
                    </span>
                  </div>
                  <div className="d-note__line" data-step>
                    <i>✓</i>
                    <span>
                      Anticipo del 50 % facturado, <b>2.400 US$</b>
                    </span>
                  </div>
                  <div className="d-note__line" data-step>
                    <i>✓</i>
                    <span>
                      Portal y proyecto <b>creados</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* APP-FRAME: el portal del cliente, la lista de entregas junto a la entrega abierta */}
        <section className="section" id="portal" aria-labelledby="portal-h">
          <div className="wrap">
            <div className="grid">
              <h2 id="portal-h" className="span-5">
                Un portal privado para cada cliente
              </h2>
              <p className="span-6 start-7 t-lead">
                Tu cliente entra con tu marca, ve el avance del proyecto, aprueba cada entrega o pide cambios, firma y paga sin escribirte un correo.{" "}
                <a className="link" href="/registro">
                  Crear mi portal
                </a>
              </p>
            </div>
            <div className="ui app fill" role="img" aria-label="El portal de Panadería Sol: la lista de entregas a la izquierda y la maqueta de inicio abierta, lista para aprobar">
              <div className="app__pane app__pane--list">
                <div className="p-list">
                  <div className="p-list__head">
                    <span className="p-brand">F</span>
                    <b>Portal de Estudio Faro</b>
                  </div>
                  <div className="p-list__tabs">
                    <span className="is-on">Entregas</span>
                    <span>Cronograma</span>
                    <span>Pagos</span>
                    <span>Mensajes</span>
                  </div>
                  {[
                    ["Maqueta de la página de inicio", "Web nueva · v3", "En revisión", "low", true],
                    ["Guía de estilo", "Colores, tipografías y logotipo", "Aprobada", "", false],
                    ["Textos de la web", "6 páginas · 2 revisiones", "Aprobada", "", false],
                    ["Fotos de producto", "48 imágenes editadas", "Aprobada", "", false],
                    ["Página de pedidos", "Pago con tarjeta y recogida", "En curso", "info", false],
                    ["Formulario de reservas", "Pedidos por encargo", "Pendiente", "info", false],
                    ["Ficha de Google", "Horarios y fotos", "Pendiente", "info", false],
                    ["Informe de octubre", "Visitas y pedidos", "Publicado", "", false],
                    ["Contrato CON-0042", "Firmado por ambas partes", "Firmado", "", false],
                  ].map(([t, s, st, tone, on]) => (
                    <div className={`p-row${on ? " is-on" : ""}`} key={t as string}>
                      <div>
                        <b>{t}</b>
                        <small>{s}</small>
                      </div>
                      <span className={`d-chip${tone ? ` d-chip--${tone}` : ""}`}>{st}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="app__pane app__pane--open" data-ui-loop>
                <div className="p-open">
                  <div className="p-open__head">
                    <div>
                      <small>Web nueva para Panadería Sol</small>
                      <h4>Maqueta de la página de inicio</h4>
                    </div>
                    <span className="d-chip d-chip--low">En revisión</span>
                  </div>
                  <div className="p-mock">
                    <div className="p-mock__nav">
                      <i />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="p-mock__hero">
                      <div>
                        <p className="p-mock__h">Pan de masa madre recién horneado</p>
                        <p className="p-mock__l">Pide antes de las 20:00 y recoge mañana desde las 7:30.</p>
                        <span className="p-mock__b">Hacer un pedido</span>
                      </div>
                      <div className="p-mock__img" />
                    </div>
                    <div className="p-mock__cards">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="p-open__actions">
                    <span className="p-btn p-btn--ok">✓ Aprobar la entrega</span>
                    <span className="p-btn">Pedir cambios</span>
                  </div>
                  <div className="p-comment">
                    <span className="p-av" data-i="LS" />
                    <div>
                      <b>Lucía Sol</b>
                      <p>Me encanta. ¿Podemos poner el horario del sábado más visible?</p>
                    </div>
                  </div>
                  <div className="p-comment p-comment--team">
                    <span className="p-av" data-i="MR" />
                    <div>
                      <b>Marta, Estudio Faro</b>
                      <p>Hecho en la versión 3. Lo verás junto al botón de pedidos.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEPS: tres pasos, cada uno con su resultado */}
        <section className="section" id="flujo" aria-labelledby="flujo-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="flujo-h">
                De la propuesta al cobro en 3 pasos. <span className="muted">Sin copiar datos entre herramientas.</span>
              </h2>
            </div>
            <div className="grid steps">
              <article className="card card--row card--open span-4">
                <span className="step-num">1</span>
                <h3>El cliente acepta en línea</h3>
                <p>Abre tu propuesta, marca los extras que quiere y la acepta con su nombre.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card">
                        <div className="d-card__row">
                          <p className="d-t">Inversión</p>
                          <span className="d-chip">Aceptada</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Diseño y desarrollo web</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>
                            Fotos de producto <b>extra</b>
                          </span>
                        </div>
                        <div className="d-note__line">
                          <i className="warn">·</i>
                          <span>
                            Mantenimiento mensual <b>opcional</b>
                          </span>
                        </div>
                        <div className="d-note__line">
                          <i className="warn">·</i>
                          <span>
                            Total <b>2.750 US$</b>, anticipo 50 %
                          </span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Aceptada por Lucía Sol</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <span className="step-num">2</span>
                <h3>Ambos firman el contrato</h3>
                <p>Se redacta con tu plantilla y sus datos. Firma con el dedo y queda registro de cada firma.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card">
                        <div className="d-card__row">
                          <p className="d-t">CON-2026-0042</p>
                          <span className="d-chip">Firmado</span>
                        </div>
                        <svg className="sig" viewBox="0 0 220 56" aria-hidden="true">
                          <path d="M6 40c18-30 30-30 26-6s10 16 22-6 16-14 14 4 14 12 28-10 20-12 18 6 22 14 40-6" fill="none" stroke="#232323" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        <p>Lucía Sol · 25 nov, 18:42</p>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Firma de Estudio Faro</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>IP y huella SHA-256 guardadas</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Copia en el portal del cliente</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <span className="step-num">3</span>
                <h3>El anticipo se cobra solo</h3>
                <p>La factura del anticipo y los plazos salen al firmar. Tu cliente paga con tarjeta desde el enlace.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card">
                        <div className="d-card__row">
                          <p className="d-t">FAC-2026-0108</p>
                          <span className="d-chip">Pagada</span>
                        </div>
                        <p>Anticipo 50 % · 1.375 US$</p>
                        <div className="d-bar" style={{ ["--v" as string]: "50%" }}>
                          <i />
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Pagada con tarjeta en Stripe</span>
                        </div>
                        <div className="d-note__line">
                          <i className="warn">·</i>
                          <span>
                            Plazo 2 de 2 el <b>15 dic</b>
                          </span>
                        </div>
                        <div className="d-note__line">
                          <i className="warn">·</i>
                          <span>Recordatorio 3 días antes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* BENTO en dos pantallas: dos tarjetas en el par 6/6 y tres debajo */}
        <section className="section g2" id="automatizacion" aria-labelledby="auto-h">
          <div className="wrap">
            <div className="group">
              <div className="section-head">
                <h2 id="auto-h">
                  Lo repetitivo se hace solo. <span className="muted">Tú decides qué pasa después de cada paso.</span>
                </h2>
              </div>
              <div className="grid bento">
              <article className="card card--row card--open span-6">
                <h3>Da la bienvenida al firmar</h3>
                <p>Se crean el portal, el proyecto con sus tareas, el formulario de briefing y la cita inicial.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "420px", ["--ax" as string]: "max(20px, 50% - 210px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card flow">
                        <div className="flow__row">
                          <span className="flow__when">Cuando</span>
                          <b>Se firma un contrato</b>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Activar el portal e invitar a <b>Lucía Sol</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Publicar el documento de bienvenida</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Pedir el formulario «Información inicial»</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Crear el proyecto en 4 fases con <b>9 tareas</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Pedir logotipos, accesos y fotos</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Compartir la agenda de la reunión inicial</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Avisar al equipo por correo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-6">
                <h3>Redacta con IA</h3>
                <p>Propuestas, contratos, informes de progreso y resúmenes de reunión.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "420px", ["--ax" as string]: "max(20px, 50% - 210px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card doc">
                        <p className="d-t">Informe de progreso · noviembre</p>
                        <p>Esta semana aprobaste la maqueta de inicio y los textos de las seis páginas.</p>
                        <p>La página de pedidos está en curso y estará lista para revisar el jueves.</p>
                        <p><b>Necesitamos de tu parte:</b> el horario de los sábados y dos fotos del obrador.</p>
                        <p>Próxima reunión: martes 2 de diciembre a las 10:00.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              </div>
            </div>
            <div className="grid bento small">
              <article className="card card--row card--open span-4">
                <h3>Cobra cada mes</h3>
                <p>Igualas y mantenimientos que se facturan y envían solos.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card">
                        <div className="d-card__row">
                          <p className="d-t">Cobros recurrentes</p>
                          <span className="d-chip">Activos</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Mantenimiento web · <b>180 US$</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Redes sociales · <b>450 US$</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Hosting anual · <b>96 US$</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Iguala de diseño · <b>600 US$</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Soporte técnico · <b>120 US$</b></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <h3>Avisa por WhatsApp</h3>
                <p>Entregas, recordatorios de pago y reuniones.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card wa">
                        <p className="d-t">WhatsApp · Panadería Sol</p>
                        <div className="wa__msg">Estudio Faro: tu nueva entrega está lista para revisar en tu portal.<small>9:41 ✓✓</small></div>
                        <div className="wa__msg">Recordatorio: la factura FAC-0108 vence el viernes.<small>10:02 ✓✓</small></div>
                        <div className="wa__msg">Tu reunión es mañana a las 10:00. Enlace en tu portal.<small>18:30 ✓✓</small></div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <h3>Fideliza al cerrar</h3>
                <p>Encuesta, testimonio y renovación al terminar.</p>
                <div className="panel">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "300px", ["--ax" as string]: "max(20px, 50% - 150px)", ["--ay" as string]: "32px" }}>
                      <div className="d-card">
                        <div className="d-card__row">
                          <p className="d-t">Proyecto cerrado</p>
                          <span className="d-chip">NPS 10</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Encuesta enviada a <b>Hostal Andes</b></span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Respuesta: 10 de 10</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Testimonio pedido y recibido</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Oportunidad de renovación creada</span>
                        </div>
                        <div className="d-note__line">
                          <i>✓</i>
                          <span>Recomendó a un contacto nuevo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* SPLIT en el fondo oscuro, con el momento line-carries-colour */}
        <section className="section ground-inverse" id="equipos" aria-labelledby="equipos-h" data-moment="line-carries-colour" data-moment-opts='{"from": "base"}'>
          <div className="wrap">
            <div className="grid">
              <div className="span-5 stack-6">
                <h2 id="equipos-h">Empieza solo y crece a empresa</h2>
                <p className="t-lead">Como independiente lo tienes todo en tu cuenta. Cuando contrates, la conviertes en empresa en un clic y conservas cada cliente, proyecto y plantilla.</p>
                <ul className="facts">
                  <li>Departamentos, roles y permisos por persona</li>
                  <li>Carga de trabajo frente a las horas de cada uno</li>
                  <li>Analítica de cobros, ventas y entregas</li>
                </ul>
                <a className="link" href="#precios">
                  Ver los planes de empresa
                </a>
              </div>
              <div className="frame frame--split span-6 start-7" role="img" aria-label="La carga de trabajo del equipo de Estudio Faro: cuatro personas con su ocupación de la próxima semana">
                <div className="stage stage--fade-br">
                  <div className="at-corner to-edge" style={{ ["--ax" as string]: "48px", ["--ay" as string]: "48px" }}>
                    <div className="d-win team" aria-hidden="true">
                      <div className="d-win__bar">
                        <span className="d-win__dots">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span>Equipo · Carga de trabajo</span>
                      </div>
                      <div className="team__rows">
                        {[
                          ["Marta Ríos", "Dirección", 62],
                          ["Diego Paz", "Diseño", 94],
                          ["Ana Quispe", "Desarrollo", 78],
                          ["Luis Vera", "Cuentas", 41],
                          ["Sara León", "Redes", 55],
                        ].map(([n, d, v]) => (
                          <div className="team__row" key={n as string}>
                            <span className="p-av" data-i={(n as string).split(" ").map((x) => x[0]).join("")} />
                            <div>
                              <b>{n}</b>
                              <small>{d}</small>
                            </div>
                            <span className="team__bar">
                              <i style={{ width: `${v}%`, background: (v as number) > 90 ? "#d9822b" : "#5fe59e" }} />
                            </span>
                            <span className="num">{v} %</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING-THREE: tres planes reales de la base de datos; el cuarto, en una línea */}
        <section className="section" id="precios" aria-labelledby="precios-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="precios-h">
                Precios por cuenta, no por cliente. <span className="muted">{trial} días de prueba, sin tarjeta.</span>
              </h2>
            </div>
            <div className="grid plans">
              {shown.map((p, i) => (
                <article key={p.id} className={`card card--plan span-4${i === 1 ? " is-featured" : ""}`}>
                  <h3>{p.name}</h3>
                  <p className="plan__who">{p.description}</p>
                  <p className="price">
                    {fmt(p.priceMonthly, p.currency)}
                    <span className="t-small muted"> /mes · {fmt(p.priceYearly, p.currency)} al año</span>
                  </p>
                  <a className={`btn ${i === 1 ? "btn--primary" : "btn--secondary"}`} href={`/registro?tipo=${p.accountType === "COMPANY" ? "empresa" : "independiente"}&plan=${p.code}`}>
                    {`Probar ${p.name}`}
                  </a>
                  <ul className="plan__list">
                    {p.features.slice(0, 4).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {extra && (
              <p className="plans__more">
                ¿Más de 10 personas? {extra.name}: {fmt(extra.priceMonthly, extra.currency)} al mes con miembros ilimitados.
              </p>
            )}
          </div>
        </section>

        {/* FAQ: todas las respuestas abiertas */}
        <section className="section" id="preguntas" aria-labelledby="faq-h">
          <div className="wrap">
            <div className="grid">
              <div className="span-5 stack-5">
                <h2 id="faq-h">Preguntas</h2>
                <p className="muted">Lo que suelen preguntar antes de empezar.</p>
                <a className="link" href="#contact">
                  Escribir al equipo
                </a>
                <div className="panel faq__panel" role="img" aria-label="Un cliente pregunta en su portal cuándo vence su factura y el asistente responde con la fecha">
                  <div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ ["--fit-max" as string]: "340px", ["--ax" as string]: "max(16px, 50% - 170px)", ["--ay" as string]: "28px" }}>
                      <div className="d-card chat" aria-hidden="true">
                        <p className="d-t">Asistente del portal</p>
                        <div className="chat__me">¿Cuándo vence mi próxima factura?</div>
                        <div className="chat__bot">El 15 de diciembre: plazo 2 de 2, 1.375 US$. Puedes pagarla con tarjeta desde Pagos.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="faq span-6 start-7">
                {[
                  ["¿Mis clientes pagan algo por usar el portal?", "No. El portal es gratis para tus clientes y no tienen límite de usuarios. Solo tu cuenta tiene suscripción."],
                  ["¿La firma electrónica tiene validez?", "Cada firma guarda el trazo, el nombre, la fecha, la IP y la huella SHA-256 del documento, y puedes descargar el registro en PDF."],
                  ["¿Puedo pasar de independiente a empresa?", "Sí. Es la misma cuenta: cambias de plan y conservas todos tus clientes, proyectos, plantillas y configuraciones."],
                  ["¿Cómo me pagan mis clientes?", "Con tarjeta desde la factura si conectas tu cuenta de Stripe, o por transferencia y registras el pago. El dinero va directo a ti."],
                  ["¿Puedo cancelar cuando quiera?", "Sí. Cancelas desde la configuración y puedes descargar todos tus datos en cualquier momento."],
                ].map(([q, a]) => (
                  <div className="faq__item" key={q}>
                    <h3>{q}</h3>
                    <p>{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer closing footer--dark ground-inverse" id="contact" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">Ordena tus clientes desde esta semana</h2>
              <p className="t-small muted">{trial} días gratis. Sin tarjeta para empezar.</p>
            </div>
            <a className="btn btn--primary btn--xl btn--wide" href="/registro">
              Empezar la prueba gratis
              <Arrow />
            </a>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-4 stack-4">
                <a className="nav__logo footer__name" href="#top">
                  <span className="mark" data-mark="dots" aria-hidden="true" />
                  {APP_NAME}
                </a>
                <p className="footer__lede">Gestión de clientes para agencias y freelancers.</p>
              </div>
              <div className="span-2 footer__col">
                <h3>Producto</h3>
                <ul>
                  <li>
                    <a href="#portal">Portal del cliente</a>
                  </li>
                  <li>
                    <a href="#automatizacion">Automatizaciones</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Cómo funciona</h3>
                <ul>
                  <li>
                    <a href="#flujo">Propuesta a cobro</a>
                  </li>
                  <li>
                    <a href="#equipos">Equipos</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Precios</h3>
                <ul>
                  <li>
                    <a href="#precios">Planes</a>
                  </li>
                  <li>
                    <a href="#preguntas">Preguntas</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Cuenta</h3>
                <ul>
                  <li>
                    <a href="/login">Entrar</a>
                  </li>
                  <li>
                    <a href="mailto:hola@encauza.example">Contacto</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="footer__legal">
              <span>© 2026 {APP_NAME}</span>
              <div className="socials" />
            </div>
          </div>
        </div>
      </footer>
      <nav className="actionbar" aria-label="Acciones rápidas">
        <a className="btn btn--primary" href="/registro">
          Empezar la prueba gratis
        </a>
      </nav>
    </>
  );
}
