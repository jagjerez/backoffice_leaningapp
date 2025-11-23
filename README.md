# Learning App - Backoffice

Sistema de gestión de frases para aprendizaje de idiomas con integración de IA para verificación de respuestas.

## Características

- 🔐 Autenticación OAuth2 con JWT
- 📝 CRUD completo de frases por idioma y nivel de dificultad
- 👥 Gestión de usuarios (solo administradores)
- 🤖 Integración con OpenAI para verificación inteligente de respuestas
- 📊 Estadísticas de aprendizaje
- 🌍 Soporte multiidioma
- 🎯 Generación automática de frases con ChatGPT

## Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de OpenAI con API key
- Base de datos PostgreSQL (para producción) o SQLite (para desarrollo)

## Instalación

1. Instala las dependencias:

```bash
npm install
```

2. Configura las variables de entorno. Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
NEXT_PUBLIC_API_URL="http://localhost:3000"
OPENAI_API_KEY="your-openai-api-key"
```

3. Genera el cliente de Prisma y crea la base de datos:

```bash
npm run db:generate
npm run db:push
```

4. Ejecuta el seed para crear el usuario administrador inicial:

```bash
npm run db:seed
```

**Credenciales por defecto del administrador:**
- Email: `admin@learningapp.com`
- Contraseña: `admin123`

⚠️ **IMPORTANTE**: Cambia estas credenciales en producción.

## Uso

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

### Producción

```bash
npm run build
npm start
```

## Despliegue en Vercel

El proyecto está configurado para ejecutarse automáticamente en Vercel:

1. **Variables de entorno en Vercel:**
   - `DATABASE_URL`: URL de tu base de datos PostgreSQL
   - `JWT_SECRET`: Clave secreta para JWT
   - `NEXT_PUBLIC_API_URL`: URL de tu API (ej: `https://tu-app.vercel.app`)
   - `OPENAI_API_KEY`: Tu clave de API de OpenAI

2. **Scripts automáticos:**
   - `postinstall`: Genera Prisma Client después de instalar dependencias
   - `vercel-build`: Ejecuta `db:generate`, `db:push`, `db:seed` y luego `next build`

3. **Notas importantes:**
   - El seed usa `upsert`, por lo que es seguro ejecutarlo múltiples veces
   - `db:push` usa `--accept-data-loss` para evitar errores en despliegues
   - Asegúrate de tener una base de datos PostgreSQL configurada en Vercel

## Estructura del Proyecto

```
backoffice_leaningapp/
├── prisma/
│   ├── schema.prisma      # Esquema de base de datos
│   └── seed.ts            # Script de seed
├── src/
│   ├── app/
│   │   ├── api/           # Endpoints de la API
│   │   ├── dashboard/     # Dashboard principal
│   │   ├── login/         # Página de login
│   │   ├── phrases/       # Gestión de frases
│   │   └── users/         # Gestión de usuarios
│   ├── contexts/          # Contextos de React
│   ├── lib/               # Utilidades y servicios
│   └── models/            # Modelos de datos
└── public/                # Archivos estáticos
```

## API Endpoints

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrarse (solo usuarios normales)

### Frases

- `GET /api/phrases` - Listar frases (con filtros opcionales)
- `POST /api/phrases` - Crear frase (requiere autenticación)
- `GET /api/phrases/:id` - Obtener frase por ID
- `PUT /api/phrases/:id` - Actualizar frase
- `DELETE /api/phrases/:id` - Eliminar frase
- `GET /api/phrases/random` - Obtener frase aleatoria
- `POST /api/phrases/verify` - Verificar respuesta con IA
- `POST /api/phrases/generate` - Generar frases con ChatGPT (solo admin)
- `POST /api/phrases/word-explanation` - Explicación de palabra con IA
- `POST /api/phrases/grammar-explanation` - Explicación gramatical con IA
- `POST /api/phrases/audio` - Generar audio de texto

### Usuarios (Solo Admin)

- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `GET /api/users/:id` - Obtener usuario por ID
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Otros

- `GET /api/languages` - Listar idiomas disponibles
- `GET /api/stats` - Obtener estadísticas del usuario
- `GET /api/user/profile` - Obtener perfil del usuario
- `PUT /api/user/profile` - Actualizar perfil del usuario

## Modelos de Datos

### User
- `id`: UUID
- `email`: String (único)
- `password`: String (hasheado)
- `role`: ADMIN | USER
- `nativeLanguage`: String (código de idioma)
- `learningLanguage`: String (código de idioma)

### Phrase
- `id`: UUID
- `nativeLanguageId`: UUID
- `learningLanguageId`: UUID
- `nativeText`: String
- `learningText`: String
- `difficulty`: BEGINNER | INTERMEDIATE | ADVANCED
- `cefrLevel`: A1 | A2 | B1 | B2 | C1 | C2
- `category`: String (opcional)

### WordExplanation
- `id`: UUID
- `phraseId`: UUID
- `word`: String
- `translation`: String
- `explanation`: String
- `examples`: JSON Array
- `grammarNotes`: String (opcional)
- `grammarExplanation`: String (opcional)

### UserPhraseProgress
- `id`: UUID
- `userId`: UUID
- `phraseId`: UUID
- `userAnswer`: String
- `aiFeedback`: String
- `isCorrect`: Boolean
- `accuracyScore`: Float (0-100)
- `wordsLearned`: JSON Array
- `wordsForgotten`: JSON Array

## Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt
- Los tokens JWT expiran después de 7 días
- Solo los administradores pueden acceder al backoffice
- Los endpoints protegidos requieren autenticación mediante Bearer token

## Notas

- La base de datos por defecto es SQLite para desarrollo (fácil de cambiar a PostgreSQL)
- El sistema de verificación con IA utiliza GPT-4o-mini de OpenAI
- Las estadísticas se calculan en tiempo real desde el progreso del usuario
- Las explicaciones de palabras se guardan en caché para evitar llamadas repetidas a la IA
