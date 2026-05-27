// FIX dashboard/page.tsx

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role, campus_id, full_name')
  .eq('id', session.user.id)
  .single()
