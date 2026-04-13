# ARM Merch 🛍️
Sistema de Merchandising - Iglesia ARM

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deploy**: Vercel (frontend) + Supabase Cloud (backend)
- **CI/CD**: GitHub → Vercel automático

---

## 🚀 Setup inicial paso a paso

### 1. Clonar y preparar el proyecto
```bash
git clone https://github.com/TU_ORG/arm-merch.git
cd arm-merch
npm install
cp .env.example .env.local
```

### 2. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) → New project
2. Nombre: `arm-merch` | Región: South America (São Paulo)
3. Copia las credenciales en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Ejecutar el schema SQL
1. En Supabase → SQL Editor → New snippet
2. Pega el contenido de `arm_merch_schema.sql`
3. Click **Run**

### 4. Crear el primer Super Admin
En Supabase → SQL Editor, ejecuta:
```sql
-- 1. Primero crea el usuario en Auth → Authentication → Users → Add user
-- 2. Luego actualiza su rol:
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'tu@email.com';
```

### 5. Correr en desarrollo
```bash
npm run dev
# Abre http://localhost:3000
```

### 6. Conectar con Vercel
1. Push a GitHub
2. Ve a [vercel.com](https://vercel.com) → New Project → importa el repo
3. Agrega las variables de entorno de `.env.example`
4. Deploy 🎉

---

## 📁 Estructura de carpetas

```
src/
├── app/
│   ├── (auth)/login/          # Página de login
│   └── (dashboard)/           # Rutas protegidas
│       ├── dashboard/         # Resumen
│       ├── pos/               # Punto de venta
│       ├── inventory/         # Inventario
│       ├── products/          # Productos
│       ├── orders/            # Órdenes
│       ├── reports/           # Reportes
│       └── settings/          # Configuración + usuarios
├── components/
│   ├── layout/                # Sidebar, Navbar
│   ├── pos/                   # Componentes del POS
│   ├── inventory/             # Componentes de inventario
│   └── ui/                    # Componentes base
├── lib/
│   ├── supabase/              # Clientes browser/server
│   ├── hooks/                 # useUser, useCart
│   └── actions/               # Server Actions
└── middleware.ts              # Protección de rutas
```

---

## 👥 Roles

| Rol | Dashboard | POS | Inventario | Productos | Órdenes | Reportes | Usuarios |
|-----|-----------|-----|------------|-----------|---------|----------|----------|
| Voluntario | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🔄 Generar tipos de Supabase

```bash
npm run types
# Genera src/types/database.types.ts automáticamente
# Reemplaza YOUR_PROJECT_ID en package.json con tu project ID de Supabase
```

---

## 📦 Próximos pasos sugeridos
1. Implementar página del POS con carrito
2. Agregar módulo de inventario con alertas
3. Dashboard con gráficos de ventas
4. Módulo de reportes exportables a Excel/PDF
5. Notificaciones de stock bajo por email (Supabase Edge Functions)
