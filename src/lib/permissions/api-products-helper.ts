
import { createClient } from '@supabase/supabase-js'

export async function hasModulePermission(token:string, permission:string){
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL!
 const supabaseAnonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY!
 const authClient=createClient(supabaseUrl,supabaseAnonKey)
 const adminClient=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}})
 const {data:{user}}=await authClient.auth.getUser(token)
 if(!user) return false
 const {data:profile}=await adminClient.from('profiles').select('role').eq('id',user.id).single()
 if(!profile) return false
 if(profile.role==='super_admin') return true
 const {data}=await adminClient.from('module_permissions').select('enabled').eq('role',profile.role).eq('module',permission).maybeSingle()
 return data?.enabled===true
}
