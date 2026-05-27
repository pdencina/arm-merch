// FIX GLOBAL ACCESS FOR ADM_MERCH
// FILE: src/app/(dashboard)/dashboard/page.tsx

const hasGlobalAccess =
  role === 'super_admin' ||
  role === 'adm_merch'

// BEFORE
if (role !== 'super_admin' && campusId) {
  query = query.eq('campus_id', campusId)
}

// AFTER
if (!hasGlobalAccess && campusId) {
  query = query.eq('campus_id', campusId)
}
