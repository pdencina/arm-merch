import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── GET /api/sumup/readers/status ────────────────────────────────────────────
// Verifica la conexión con la API de SumUp y consulta el estado real de los lectores
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient } = ctx
  const sumupApiKey = process.env.SUMUP_API_KEY
  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE
  const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

  // 1. Verificar configuración de variables de entorno
  const config = {
    hasApiKey: Boolean(sumupApiKey),
    hasMerchantCode: Boolean(sumupMerchantCode),
    apiBase: sumupApiBase,
  }

  if (!sumupApiKey || !sumupMerchantCode) {
    return NextResponse.json({
      api_connected: false,
      config,
      error: 'Faltan variables SUMUP_API_KEY o SUMUP_MERCHANT_CODE',
      readers: [],
    })
  }

  // 2. Verificar conexión con la API de SumUp (merchant info)
  let apiConnected = false
  let merchantInfo: any = null
  let apiError: string | null = null
  let apiLatency: number | null = null

  try {
    const start = Date.now()
    const merchantRes = await fetch(`${sumupApiBase}/v0.1/me`, {
      headers: { Authorization: `Bearer ${sumupApiKey}` },
    })
    apiLatency = Date.now() - start

    if (merchantRes.ok) {
      apiConnected = true
      const data = await merchantRes.json()
      merchantInfo = {
        merchant_code: data.merchant_profile?.merchant_code ?? sumupMerchantCode,
        business_name: data.merchant_profile?.business_name ?? null,
        country: data.merchant_profile?.country ?? null,
        email: data.personal_profile?.email ?? null,
      }
    } else {
      const errData = await merchantRes.json().catch(() => ({}))
      apiError = errData?.error_message ?? errData?.message ?? `HTTP ${merchantRes.status}`
    }
  } catch (err: any) {
    apiError = err?.message ?? 'No se pudo conectar con SumUp'
  }

  // 3. Consultar estado real de los lectores desde SumUp
  let readersFromSumUp: any[] = []

  if (apiConnected) {
    try {
      const readersRes = await fetch(
        `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(sumupMerchantCode)}/readers`,
        {
          headers: { Authorization: `Bearer ${sumupApiKey}` },
        }
      )

      if (readersRes.ok) {
        const data = await readersRes.json()
        readersFromSumUp = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      }
    } catch {
      // No es crítico si falla la lista de readers
    }
  }

  // 4. Cargar lectores registrados en nuestra BD
  const { data: localReaders } = await adminClient
    .from('sumup_readers')
    .select('id, reader_id, name, campus_id, status, active, device_model, serial_number')
    .order('created_at', { ascending: false })

  // 5. Cruzar datos: BD local vs API SumUp
  const enrichedReaders = (localReaders ?? []).map((local: any) => {
    const remote = readersFromSumUp.find(
      (r: any) => r.id === local.reader_id || r.name === local.name
    )

    return {
      ...local,
      sumup_status: remote?.status ?? null,
      sumup_online: remote?.status === 'paired' || remote?.status === 'online',
      last_seen: remote?.updated_at ?? null,
      device_info: remote?.device ?? null,
    }
  })

  // 6. Actualizar status en BD si cambió
  for (const reader of enrichedReaders) {
    if (reader.sumup_status && reader.sumup_status !== reader.status) {
      await adminClient
        .from('sumup_readers')
        .update({ status: reader.sumup_status, updated_at: new Date().toISOString() })
        .eq('id', reader.id)
    }
  }

  return NextResponse.json({
    api_connected: apiConnected,
    api_latency_ms: apiLatency,
    api_error: apiError,
    config,
    merchant: merchantInfo,
    readers: enrichedReaders,
    readers_total: enrichedReaders.length,
    readers_online: enrichedReaders.filter((r: any) => r.sumup_online).length,
    checked_at: new Date().toISOString(),
  })
}, { permission: 'pos.smart_pos' })
