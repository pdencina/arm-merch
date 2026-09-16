// app/api/cron/cumpleanos/route.ts
//
// Lee el proyecto "Cumpleaños ARM" en Asana, detecta quién cumple hoy
// y le manda un único WhatsApp a Pastorita con la lista de nombres.
//
// Variables de entorno necesarias:
//   ASANA_TOKEN                 Personal access token de Asana
//   ASANA_PROJECT_CUMPLEANOS    GID del proyecto (1218550857320725)
//   WHATSAPP_PHONE_NUMBER_ID    Identificador del número en Meta
//   WHATSAPP_TOKEN              Token permanente del usuario del sistema
//   PASTORA_PHONE               Destinatario real, formato 56978657890 (sin +)
//   TEST_PHONE                  Destinatario de prueba, mismo formato
//   CRON_SECRET                 Secreto que protege el endpoint
//
// Uso manual:
//   Ver a quién detecta, sin enviar nada:
//     ?dryRun=1
//   Simular otro día:
//     ?dryRun=1&testDate=2026-12-25
//   Enviar de verdad, pero a TEST_PHONE:
//     ?test=1
//   Enviar de verdad a Pastorita:
//     (sin parámetros; es lo que hace el cron)
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "https://TU-APP.vercel.app/api/cron/cumpleanos?dryRun=1"

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ZONA = "America/Santiago";
const GRAPH_VERSION = "v21.0";
const PLANTILLA = "aviso_cumpleanos";
const IDIOMA = "es_CL";

type TareaAsana = {
  gid: string;
  name: string;
  notes: string | null;
  due_on: string | null;
  completed: boolean;
  memberships?: { section?: { name?: string } }[];
};

/** Devuelve { mes, dia } de hoy en horario de Santiago, no en UTC. */
function hoyEnSantiago(): { mes: number; dia: number; iso: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (t: string) => partes.find((p) => p.type === t)!.value;
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  return { mes: Number(get("month")), dia: Number(get("day")), iso };
}

/** Lee una línea con formato "clave: valor" desde la descripción. */
function leerCampo(notes: string | null, clave: string): string | null {
  if (!notes) return null;
  const re = new RegExp(`^\\s*${clave}\\s*:\\s*(.+)$`, "im");
  const m = notes.match(re);
  return m ? m[1].trim() : null;
}

/** Trae todas las tareas del proyecto, paginando. */
async function traerTareas(token: string, proyecto: string): Promise<TareaAsana[]> {
  const campos = "name,notes,due_on,completed,memberships.section.name";
  let url =
    `https://app.asana.com/api/1.0/tasks` +
    `?project=${proyecto}&opt_fields=${campos}&limit=100`;

  const todas: TareaAsana[] = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Asana ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    todas.push(...(json.data ?? []));
    url = json.next_page?.uri ?? "";
  }

  return todas;
}

/** Decide si una tarea corresponde a alguien que cumple hoy. */
function cumpleHoy(t: TareaAsana, mes: number, dia: number): boolean {
  if (t.completed) return false;
  if (!t.due_on) return false;

  // La tarea PLANTILLA vive en la sección de instrucciones: se ignora.
  const seccion = t.memberships?.[0]?.section?.name ?? "";
  if (seccion.toLowerCase().includes("instruccion")) return false;

  // Tolerante: sin línea "estado" se asume activo.
  // Solo queda fuera quien diga explícitamente "pausado".
  const estado = leerCampo(t.notes, "estado");
  if (estado && estado.toLowerCase().startsWith("pausado")) return false;

  // due_on viene como YYYY-MM-DD. El año no importa.
  const [, mm, dd] = t.due_on.split("-").map(Number);
  return mm === mes && dd === dia;
}

async function enviarWhatsApp(nombres: string, destino: string): Promise<unknown> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/` +
    `${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino,
      type: "template",
      template: {
        name: PLANTILLA,
        language: { code: IDIOMA },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: nombres }],
          },
        ],
      },
    }),
  });

  const cuerpo = await res.json();

  if (!res.ok) {
    throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(cuerpo)}`);
  }

  return cuerpo;
}

export async function GET(req: NextRequest) {
  // Solo entra el cron de Vercel o quien tenga el secreto.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const testDate = req.nextUrl.searchParams.get("testDate");
  const modoPrueba = req.nextUrl.searchParams.get("test") === "1";

  // Con ?test=1 el mensaje va a TEST_PHONE, nunca a Pastorita.
  const destino = modoPrueba
    ? process.env.TEST_PHONE
    : process.env.PASTORA_PHONE;

  if (!destino) {
    return NextResponse.json(
      {
        error: modoPrueba
          ? "Falta la variable TEST_PHONE"
          : "Falta la variable PASTORA_PHONE",
      },
      { status: 500 }
    );
  }

  try {
    let mes: number, dia: number, fecha: string;

    if (testDate) {
      const [, mm, dd] = testDate.split("-").map(Number);
      if (!mm || !dd) {
        return NextResponse.json(
          { error: "testDate debe ser YYYY-MM-DD" },
          { status: 400 }
        );
      }
      mes = mm;
      dia = dd;
      fecha = testDate;
    } else {
      const hoy = hoyEnSantiago();
      mes = hoy.mes;
      dia = hoy.dia;
      fecha = hoy.iso;
    }

    const tareas = await traerTareas(
      process.env.ASANA_TOKEN!,
      process.env.ASANA_PROJECT_CUMPLEANOS!
    );

    const deHoy = tareas.filter((t) => cumpleHoy(t, mes, dia));
    const nombres = deHoy.map((t) => t.name.trim()).filter(Boolean);

    if (nombres.length === 0) {
      return NextResponse.json({
        fecha,
        revisadas: tareas.length,
        cumplen: 0,
        enviado: false,
        detalle: "Nadie cumple hoy, no se envía nada.",
      });
    }

    const lista = nombres.join(", ");

    if (dryRun) {
      return NextResponse.json({
        fecha,
        revisadas: tareas.length,
        cumplen: nombres.length,
        enviado: false,
        dryRun: true,
        mensajeQueSeEnviaria: lista,
      });
    }

    const respuesta = await enviarWhatsApp(lista, destino);

    return NextResponse.json({
      fecha,
      revisadas: tareas.length,
      cumplen: nombres.length,
      enviado: true,
      modoPrueba,
      destino,
      nombres,
      whatsapp: respuesta,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("[cumpleanos]", mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
