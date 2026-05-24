export default function PricingHistoryPage() {
  return (
    <div className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-7 text-white">
      <h1 className="text-3xl font-black">
        Historial de precios
      </h1>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-950 text-left text-xs uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-5 py-4">Fecha</th>
              <th className="px-5 py-4">Usuario</th>
              <th className="px-5 py-4">Producto</th>
              <th className="px-5 py-4">Cambio</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-t border-zinc-800">
              <td className="px-5 py-4">24 Mayo</td>
              <td className="px-5 py-4">Pablo</td>
              <td className="px-5 py-4">Polerón ARM</td>
              <td className="px-5 py-4 text-emerald-300">
                $24.990 → $29.990
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
