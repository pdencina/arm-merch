import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/sumup/keepalive
 *
 * Ping periódico a SumUp API para mantener los lectores SOLO activos.
 * Se llama desde el cron cada 2 minutos.
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const sumupApiKey = process.env.SUMUP_API_KEY
  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE
  const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

  if (!sumupApiKey || !sumupMerchantCode) {
    return NextResponse.json({ error: 'Faltan SUMUP_API_KEY o SUMUP_MERCHANT_CODE' }, { status: 500 })
  }

  try {
    // Ping a la API para mantener la conexión activa
    const readersRes = await fetch(
      `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(sumupMerchantCode)}/readers`,
      { headers: { Authorization: `Bearer ${sumupApiKey}` } }
    )

    const readersData = await readersRes.json().catch(() => null)

    if (!readersRes.ok) {
      return NextResponse.json({
        alive: false,
        error: readersData?.error || `SumUp respondió ${readersRes.status}`,
        timestamp: new Date().toISOString(),
      })
    }

    const readers = Array.isArray(readersData?.items) ? readersData.items : Array.isArray(readersData) ? readersData : []

    return NextResponse.json({
      alive: true,
      readers_count: readers.length,
      readers: readers.map((r: any) => ({
        name: r.name,
        status: r.status,
        device: r.device?.identifier,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({
      alive: false,
      error: err?.message,
      timestamp: new Date().toISOString(),
    })
  }
}
