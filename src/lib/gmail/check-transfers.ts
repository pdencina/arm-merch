/**
 * Gmail — Verificación automática de transferencias bancarias
 *
 * Lee emails de Banco Estado en donaciones@armglobal.org
 * y los cruza con órdenes pendientes de confirmación.
 */

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface TransferData {
  date: string
  time: string
  clientName: string
  amount: number
  operationNumber: string
  rawText: string
}

interface MatchedOrder {
  orderId: string
  orderNumber: string | number
  amount: number
  operationNumber: string
  clientName: string
}

// ─── Obtener Access Token via Refresh Token ────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[Gmail] Faltan credenciales GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET o GMAIL_REFRESH_TOKEN')
    return null
  }

  try {
    const res = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.access_token) {
      console.error('[Gmail] Error obteniendo access token:', data)
      return null
    }

    return data.access_token
  } catch (err: any) {
    console.error('[Gmail] Exception getting token:', err?.message)
    return null
  }
}

// ─── Listar emails recientes de Banco Estado ────────────────────────────────

async function listRecentTransferEmails(accessToken: string, maxResults = 10): Promise<string[]> {
  // Buscar cualquier email que mencione la cuenta destino o sea de bancos conocidos
  // Esto captura: Banco Estado, Itaú, Falabella, Santander, BCI, Scotiabank, etc.
  const query = encodeURIComponent(
    '(29100078943 OR "transferencia" OR "fondos recibida") newer_than:1d -from:me'
  )

  const res = await fetch(
    `${GMAIL_API_BASE}/messages?q=${query}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const data = await res.json()

  if (!res.ok || !data.messages) return []

  return data.messages.map((m: any) => m.id)
}

// ─── Obtener contenido de un email ──────────────────────────────────────────

async function getEmailContent(accessToken: string, messageId: string): Promise<string | null> {
  const res = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const data = await res.json()

  if (!res.ok) return null

  // Extraer el body del email (puede estar en parts o directamente)
  function decodeBase64Url(encoded: string) {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf-8')
  }

  function extractTextFromParts(parts: any[]): string {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
      if (part.parts) {
        const nested = extractTextFromParts(part.parts)
        if (nested) return nested
      }
    }
    return ''
  }

  if (data.payload?.body?.data) {
    return decodeBase64Url(data.payload.body.data)
  }

  if (data.payload?.parts) {
    return extractTextFromParts(data.payload.parts)
  }

  return null
}

// ─── Parsear datos de transferencia desde el HTML/texto del email ────────────

function parseTransferEmail(content: string): TransferData | null {
  // Limpiar HTML tags
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Verificar que sea un email de transferencia (debe mencionar la cuenta o transferencia)
  const lowerText = text.toLowerCase()
  const isTransferEmail = 
    lowerText.includes('29100078943') ||
    lowerText.includes('transferencia') ||
    lowerText.includes('fondos')

  if (!isTransferEmail) return null

  // ── Buscar monto (múltiples formatos) ──
  // "Monto transferido: $5.000"
  // "Monto: $100"
  // "Monto transferencia $15.500"
  // "$15.500" precedido por "monto"
  const montoPatterns = [
    /Monto\s*(?:transferido|transferencia)?[:\s]*\$?([\d.,]+)/i,
    /monto[:\s]*\$?([\d.,]+)/i,
    /total[:\s]*\$?([\d.,]+)/i,
  ]

  let amount = 0
  for (const pattern of montoPatterns) {
    const match = text.match(pattern)
    if (match) {
      const amountStr = match[1].replace(/\./g, '').replace(',', '.')
      amount = Math.round(Number(amountStr))
      if (amount > 0) break
    }
  }

  if (!amount || amount <= 0) return null

  // ── Buscar número de operación ──
  const opPatterns = [
    /N[°ú]mero\s*de\s*operaci[oó]n[:\s]*([\d]+)/i,
    /operaci[oó]n[:\s]*([\d]+)/i,
    /comprobante[:\s]*([\d]+)/i,
    /N[°ú]mero[:\s]*([\d]{6,})/i,
  ]

  let operationNumber = ''
  for (const pattern of opPatterns) {
    const match = text.match(pattern)
    if (match) {
      operationNumber = match[1]
      break
    }
  }

  // ── Buscar nombre del cliente ──
  const clientPatterns = [
    /cliente\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s*,|\s*ha\s|\s*con)/i,
    /cliente\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)/i,
  ]

  let clientName = 'Desconocido'
  for (const pattern of clientPatterns) {
    const match = text.match(pattern)
    if (match) {
      clientName = match[1].trim()
      break
    }
  }

  // ── Buscar fecha y hora ──
  const datePatterns = [
    /(?:hoy|fecha)[,:\s]*(\d{2}[\/-]\d{2}[\/-]\d{4})[\s\-]*(\d{2}[:.]\d{2}(?:[:.]\d{2})?)?/i,
    /(\d{2}[\/-]\d{2}[\/-]\d{4})[\s\-]*(?:Hora[:\s]*)?(\d{2}[:.]\d{2})?/i,
  ]

  let date = ''
  let time = ''
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      date = match[1] ?? ''
      time = (match[2] ?? '').replace(/\./g, ':')
      break
    }
  }

  // Generar ID de operación si no se encontró
  if (!operationNumber) {
    operationNumber = `TEF-${date.replace(/[\/-]/g, '')}-${amount}`
  }

  return {
    date,
    time,
    clientName,
    amount,
    operationNumber,
    rawText: text.slice(0, 500),
  }
}

// ─── Buscar transferencia por monto (sin cruzar con BD) ─────────────────────

export async function findTransferByAmount(amount: number): Promise<{
  found: boolean
  transfer?: TransferData
  checked: number
  error?: string
}> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { found: false, checked: 0, error: 'No se pudo obtener access token de Gmail' }
  }

  const messageIds = await listRecentTransferEmails(accessToken)

  if (messageIds.length === 0) {
    return { found: false, checked: 0, error: 'No se encontraron emails de transferencia recientes' }
  }

  for (const msgId of messageIds) {
    try {
      const content = await getEmailContent(accessToken, msgId)
      if (!content) continue

      const transfer = parseTransferEmail(content)
      if (transfer && transfer.amount === amount) {
        return { found: true, transfer, checked: messageIds.length }
      }
    } catch {
      continue
    }
  }

  return { found: false, checked: messageIds.length }
}

// ─── Función principal: verificar transferencias ────────────────────────────

export async function checkGmailTransfers(): Promise<{
  checked: number
  matched: MatchedOrder[]
  errors: string[]
}> {
  const errors: string[] = []
  const matched: MatchedOrder[] = []

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { checked: 0, matched: [], errors: ['No se pudo obtener access token de Gmail'] }
  }

  // Obtener emails recientes
  const messageIds = await listRecentTransferEmails(accessToken)

  if (messageIds.length === 0) {
    return { checked: 0, matched: [], errors: [] }
  }

  // Parsear cada email
  const transfers: TransferData[] = []

  for (const msgId of messageIds) {
    try {
      const content = await getEmailContent(accessToken, msgId)
      if (!content) continue

      const transfer = parseTransferEmail(content)
      if (transfer && transfer.amount > 0 && transfer.operationNumber) {
        transfers.push(transfer)
      }
    } catch (err: any) {
      errors.push(`Error procesando email ${msgId}: ${err?.message}`)
    }
  }

  // Cruzar con órdenes en BD
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { checked: transfers.length, matched: [], errors: ['Faltan credenciales Supabase'] }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const transfer of transfers) {
    // Buscar órdenes de transferencia con el mismo monto que no tengan operación confirmada
    const { data: orders } = await adminClient
      .from('orders')
      .select('id, order_number, total, notes')
      .eq('payment_method', 'transferencia')
      .eq('status', 'paid')
      .eq('total', transfer.amount)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!orders || orders.length === 0) continue

    // Buscar una orden que NO tenga ya este número de operación en notas
    const matchingOrder = orders.find((o: any) => {
      const notes = String(o.notes ?? '')
      // Ya fue verificada con este número
      if (notes.includes(transfer.operationNumber)) return false
      // Ya tiene otro número de operación verificado
      if (notes.includes('✅ Verificado')) return false
      return true
    })

    if (!matchingOrder) continue

    // Actualizar la orden con la verificación
    const updatedNotes = [
      matchingOrder.notes || '',
      `✅ Verificado · Op: ${transfer.operationNumber} · ${transfer.clientName} · ${transfer.date} ${transfer.time}`,
    ].filter(Boolean).join(' | ')

    await adminClient
      .from('orders')
      .update({ notes: updatedNotes })
      .eq('id', matchingOrder.id)

    matched.push({
      orderId: matchingOrder.id,
      orderNumber: matchingOrder.order_number,
      amount: transfer.amount,
      operationNumber: transfer.operationNumber,
      clientName: transfer.clientName,
    })
  }

  return { checked: transfers.length, matched, errors }
}
