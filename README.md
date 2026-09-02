# Casa Planner — despliegue en Cloudflare (versión corregida)

Tu cuenta de Cloudflare crea proyectos nuevos como **Workers modernos** (con `npx wrangler
deploy`), no como el sistema clásico de Pages. Por eso el primer intento falló: le faltaba un
archivo `wrangler.toml` que le dijera qué desplegar. Esta carpeta ya lo trae, con esta
estructura:

```
casa-planner/
├── wrangler.toml       ← configuración: qué es estático, qué es el Worker, qué KV usa
├── public/
│   └── index.html      ← tu app (idéntica a la que ya tenías)
└── src/
    ├── worker.js        ← el "backend": rutas /api/register, /api/login, /api/data
    └── auth.js          ← hash de contraseñas y tokens de sesión
```

La lógica es exactamente la misma que antes (mismo hash de contraseñas, mismos tokens, mismos
endpoints) — solo está reorganizada para que `wrangler deploy` sepa qué hacer con ella.

---

## 1. Sustituir los archivos en tu repositorio de GitHub

En tu repo `valls27/Planner`, borra lo que subiste antes (`index.html` suelto y la carpeta
`functions/`) y sube en su lugar TODO el contenido de esta carpeta, manteniendo la estructura:
`wrangler.toml` en la raíz, `public/index.html`, `src/worker.js`, `src/auth.js`.

(Puedes hacerlo desde la web de GitHub: entra al repo, borra los archivos antiguos con el icono
de papelera, y luego "Add file → Upload files" para subir los nuevos.)

---

## 2. Crear los dos espacios KV (si no los tienes ya)

En el panel de Cloudflare: **Storage & Databases → KV → Create a namespace**.

1. Crea uno llamado `casa-planner-users`.
2. Crea otro llamado `casa-planner-data`.
3. Abre cada uno y copia su **ID** (una cadena larga tipo `a1b2c3d4...`), lo verás en la parte
   de arriba de la página del namespace.

---

## 3. Pegar los IDs en `wrangler.toml`

Abre el `wrangler.toml` que acabas de subir (edítalo directamente en GitHub, con el lápiz de
editar) y sustituye:

```toml
[[kv_namespaces]]
binding = "USERS"
id = "PON-AQUI-EL-ID-DE-casa-planner-users"   ← pega aquí el ID real

[[kv_namespaces]]
binding = "APPDATA"
id = "PON-AQUI-EL-ID-DE-casa-planner-data"    ← pega aquí el ID real
```

Guarda el cambio (commit) en GitHub. Esto es importante: con este modelo nuevo de Cloudflare,
el `wrangler.toml` manda — si conectas el KV solo desde el panel sin ponerlo también aquí, el
siguiente despliegue automático podría desconectarlo otra vez.

---

## 4. Añadir el secreto de sesión

Este SÍ se añade solo desde el panel (nunca lo pongas en el `wrangler.toml`, que es público en
tu repo):

1. Ve a tu Worker → **Settings** → **Variables and Secrets** (o "Runtime variables and secrets").
2. **Add** → tipo **Secret** → Name: `JWT_SECRET` → Value: una cadena larga y aleatoria (por
   ejemplo el resultado de `openssl rand -hex 32` en una terminal, o cualquier texto largo e
   inventado si no tienes terminal a mano).
3. Guarda. A diferencia del KV, esto sí persiste aunque vuelvas a desplegar desde Git.

---

## 5. Volver a desplegar

Si ya hiciste el commit con los IDs de KV, se debería desplegar solo. Si no, ve a
**Deployments** → botón de volver a desplegar / o simplemente haz cualquier cambio y `git push`.

Revisa el log del build: ya no debería salir el error de "Could not detect a directory
containing static files" — ahora debería decir algo como "Uploading X static assets" y terminar
en verde.

---

## 6. Probarlo

1. Abre la URL de tu Worker. Debe salir la pantalla de "Crear cuenta".
2. Regístrate, crea un proyecto o material de prueba.
3. Cierra sesión, vuelve a entrar: los datos deben seguir ahí.
4. Pruébalo también desde el móvil con el mismo usuario — y si el móvil ya había visitado la
   web antes, borra la caché del sitio primero para asegurarte de que carga la versión nueva.

---

## Notas

- Las contraseñas se guardan con PBKDF2 + sal (nunca en texto plano).
- Los tokens de sesión duran 30 días y se guardan en el `localStorage` del navegador.
- Todo sigue en el plan gratuito de Cloudflare (Workers + KV).
- Si en el futuro quieres mover las fotos/documentos pesados a Cloudflare R2 en vez de meterlos
  en el mismo JSON de KV, dímelo cuando lleguemos a esa función y lo vemos.
