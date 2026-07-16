 # FinTrack 💰

App de seguimiento de gastos personales y compartidos.

## Stack

- HTML + CSS + JavaScript (Vanilla)
- Supabase (auth + base de datos)
- PWA (instalable en mobile)

## Estructura

fintrack/
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── auth.js
│   └── db.js
├── index.html
├── manifest.json
├── sw.js
└── README.md

## Cómo correr localmente

1. Clonar el repositorio
2. Abrir con Live Server en VS Code
3. Cargar las credenciales de Supabase en `js/db.js`

## Funcionalidades

- Login con email/contraseña y Google
- Ingresos, gastos y gastos compartidos por mes
- División por porcentaje en gastos compartidos
- Ahorros automáticos e intencionales
- PWA instalable en el celular