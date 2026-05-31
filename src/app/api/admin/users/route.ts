import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabase = getAdminClient()
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active, campus_id, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: campus } = await supabase
      .from('campus').select('id, name').eq('active', true).order('name')

    return NextResponse.json({ profiles: profiles ?? [], campus: campus ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, password, ...rawUpdates } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: currentProfile, error: currentError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, campus_id, active')
      .eq('id', id)
      .single()

    if (currentError || !currentProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // ── Cambiar contraseña en Supabase Auth ────────────────────
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Contraseña mínimo 6 caracteres' }, { status: 400 })
      }

      const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password })

      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 })
      }
    }

    const allowedUpdates: Record<string, any> = {}

    if (Object.prototype.hasOwnProperty.call(rawUpdates, 'full_name')) {
      const fullName = String(rawUpdates.full_name ?? '').trim()

      if (!fullName) {
        return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
      }

      allowedUpdates.full_name = fullName
    }

    if (Object.prototype.hasOwnProperty.call(rawUpdates, 'email')) {
      const email = String(rawUpdates.email ?? '').trim().toLowerCase()

      if (!email) {
        return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 })
      }

      allowedUpdates.email = email
    }

    if (Object.prototype.hasOwnProperty.call(rawUpdates, 'role')) {
      const role = String(rawUpdates.role ?? '')

      if (!['super_admin', 'adm_merch', 'admin', 'voluntario'].includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }

      allowedUpdates.role = role
    }

    if (Object.prototype.hasOwnProperty.call(rawUpdates, 'campus_id')) {
      allowedUpdates.campus_id = rawUpdates.campus_id || null
    }

    if (Object.prototype.hasOwnProperty.call(rawUpdates, 'active')) {
      allowedUpdates.active = Boolean(rawUpdates.active)
    }

    if (Object.keys(allowedUpdates).length > 0) {
      allowedUpdates.updated_at = new Date().toISOString()

      const authUpdates: Record<string, any> = {}

      if (
        allowedUpdates.email &&
        allowedUpdates.email !== String(currentProfile.email ?? '').toLowerCase()
      ) {
        authUpdates.email = allowedUpdates.email
        authUpdates.email_confirm = true
      }

      if (
        allowedUpdates.full_name &&
        allowedUpdates.full_name !== currentProfile.full_name
      ) {
        authUpdates.user_metadata = {
          full_name: allowedUpdates.full_name,
        }
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
          id,
          authUpdates
        )

        if (authUpdateError) {
          return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(allowedUpdates)
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
