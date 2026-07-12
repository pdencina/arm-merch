import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/api'

/**
 * POST /api/discount/validate-pin
 *
 * Valida el PIN de autorización para descuentos.
 * Body: { pin: string, discount_pct: number }
 * Returns: { authorized: boolean, authorizer_name: string, max_discount_pct: number }
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const body = await req.json().catch(() => ({}))

  const pin = String(body?.pin || '').trim()
  const requestedPct = Number(body?.discount_pct || 0)

  if (!pin) {
    return NextResponse.json(
      { authorized: false, error: 'PIN requerido' },
      { status: 400 }
    )
  }

  if (requestedPct <= 0 || requestedPct > 100) {
    return NextResponse.json(
      { authorized: false, error: 'Porcentaje de descuento inválido' },
      { status: 400 }
    )
  }

  // Hashear el PIN ingresado y comparar con la BD
  // Usamos SHA-256 del PIN como texto
  const { data: authorizer, error } = await ctx.adminClient
    .from('discount_authorizers')
    .select('id, name, max_discount_pct, active')
    .eq('pin_hash', hashPin(pin))
    .eq('active', true)
    .maybeSingle()

  if (error || !authorizer) {
    return NextResponse.json({
      authorized: false,
      error: 'PIN incorrecto',
    })
  }

  if (requestedPct > authorizer.max_discount_pct) {
    return NextResponse.json({
      authorized: false,
      error: `${authorizer.name} puede autorizar máximo ${authorizer.max_discount_pct}% de descuento`,
      max_discount_pct: authorizer.max_discount_pct,
    })
  }

  return NextResponse.json({
    authorized: true,
    authorizer_name: authorizer.name,
    max_discount_pct: authorizer.max_discount_pct,
  })
}

/**
 * Genera el SHA-256 hash de un PIN (mismo algoritmo que en la BD)
 */
function hashPin(pin: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export const POST = withAuth(handler)
