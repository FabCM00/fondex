# Optimizaciones: react-hook-form + zod + TanStack Query

## 1. react-hook-form + zod — Formularios de autenticación

### Paquetes instalados
```
npm install react-hook-form zod @hookform/resolvers
```

### Patrón aplicado
Reemplaza múltiples `useState` de campo + validación manual por un único `useForm` con un esquema zod declarativo.

```ts
// Antes
const [email, setEmail] = useState("");
const [error, setError] = useState("");
const isValid = /^[^@]+@[^@]+\.[^@]+$/.test(email);

// Después
const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo.").email("Correo inválido."),
});
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

### Archivos modificados

#### `src/components/login-form.tsx`
- Removido: 4 `useState` (email, password, formError, hasAuthError), 1 `useRef`
- Flujo de 2 pasos: paso 1 usa `trigger("email")` (valida solo ese campo), paso 2 usa `handleSubmit`
- Errores de servidor (credenciales incorrectas) → `setError("password", { type: "server" })`
- Auto-focus en paso 2 → `setFocus("password")`

#### `src/app/forgot-password/page.tsx`
- Removido: `useState` de email y errorMsg
- Errores de red → `setError("email", { type: "server", message: "..." })`
- Estado `sentEmail` se mantiene (necesario para pantalla de éxito)

#### `src/app/set-password/page.tsx`
- Removido: `useState` de password, confirm, error
- Validación cruzada de contraseñas con `.refine()`:
  ```ts
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  })
  ```
- Errores de API → `setError("root", { type: "server" })` mostrado como bloque de alerta

---

## 2. TanStack Query — Fetching y mutaciones del servidor

### Paquete instalado
```
npm install @tanstack/react-query
```

### Configuración global

**`src/components/providers.tsx`**
```tsx
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
}));

return (
  <QueryClientProvider client={queryClient}>
    ...
  </QueryClientProvider>
);
```
- `staleTime: 60_000` → los datos se consideran frescos por 1 minuto antes de re-fetch en background
- `retry: 1` → reintenta una vez en caso de error de red

### Patrón aplicado

```ts
// Antes: fetch manual con useState + useEffect
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
useEffect(() => { fetchData(); }, []);

// Después: useQuery
const { data = [], isLoading, isFetching, refetch } = useQuery({
  queryKey: ["clave", "identificador"],
  queryFn: () => fetchData(),
  enabled: condicion,          // opcional: solo corre si es true
  refetchInterval: 30_000,     // opcional: re-fetch automático cada 30s
});
```

### Archivos modificados

#### `src/components/bandeja/documentos/useDocumentos.ts`
- Removido: 3 `useState`, 3 `useCallback`, 1 `useEffect`
- `isLoading` = primera carga (sin cache) · `isFetching` = re-fetch en background
- `removeMutation` y `updateStatusMutation` con `onSuccess: () => invalidateQueries(key)`
- Interfaz pública sin cambios

#### `src/components/bandeja/BandejaView.tsx`
- Removido: 9 estados, `fetchData` callback, 3 `useEffect`, countdown de 30s con `setInterval`
- Query de lista: `refetchInterval: 30_000` reemplaza el countdown manual
- Query de detalle: `enabled: !!selectedRadicado` reemplaza el `useEffect` que observaba ese estado
- `gestionarMutation` con `onSuccess: invalidateQueries + limpiar selección`

#### `src/app/(protected)/admin/usuarios/page.tsx`
- Removido: 5 estados de UI de datos, `fetchUsers` callback, fetch inicial con `useEffect`
- `useQuery` con `enabled: isAuthorized`
- `toggleMutation` con **actualización optimista**:
  ```ts
  onMutate: async ({ id, active }) => {
    await qc.cancelQueries({ queryKey: ["admin", "users"] });
    const prev = qc.getQueryData(["admin", "users"]);
    qc.setQueryData(["admin", "users"], (old) =>
      old.map((u) => u.id === id ? { ...u, estado: active } : u)
    );
    return { prev };               // snapshot para rollback
  },
  onError: (e, _, ctx) => {
    qc.setQueryData(["admin", "users"], ctx.prev);  // rollback
    notify({ type: "error", message: e.message });
  },
  onSettled: () => qc.invalidateQueries(["admin", "users"]),
  ```
- `inviteMutation.onSuccess` → `invalidateQueries` reemplaza el hack `setTimeout(() => fetch, 1000)`
- `deleteMutation.onSuccess` → `setQueryData(old.filter(...))` para eliminar del cache sin re-fetch

---

## 3. Notificaciones — useNotification

### Integración en AdminUsuariosPage
Reemplaza el modal custom de confirmación y los mensajes inline por el sistema de notificaciones global.

```ts
const { notify, confirm } = useNotification();

// Confirmación antes de eliminar
const handleDelete = async (user) => {
  const ok = await confirm({
    type: "warning",
    title: "Eliminar usuario",
    message: `¿Confirmas eliminar a ${user.username}? Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar",
    confirmTone: "danger",
  });
  if (!ok) return;
  deleteMutation.mutate(user.id);
};

// Feedback de mutaciones
notify({ type: "success", message: "Usuario eliminado correctamente." });
notify({ type: "error",   message: e.message });
```

**Eliminado con este cambio:**
- `confirmDeleteId` state + modal JSX custom (~75 líneas)
- `inviteStatus` state + mensaje inline en modal de invitar

---

## Resumen de reducción de código

| Archivo | useState removidos | useEffect removidos |
|---|---|---|
| `login-form.tsx` | 4 | 0 |
| `forgot-password/page.tsx` | 2 | 0 |
| `set-password/page.tsx` | 3 | 0 |
| `useDocumentos.ts` | 3 | 1 |
| `BandejaView.tsx` | 9 | 3 |
| `admin/usuarios/page.tsx` | 7 | 1 |
| **Total** | **28** | **5** |
