# Prote-Prote

Aplicación web para explorar interacciones entre proteínas. El frontend usa Vue y TypeScript. El backend usa Python y FastAPI para validar los archivos CSV y calcular sus estadísticas.

## Requisitos

- Node.js 22.18.0 o posterior dentro de la rama 22, o Node.js 24.12.0 o posterior.
- Python 3.11 o posterior.

Ejecuta los comandos desde la raíz del repositorio en PowerShell. Usa una terminal para cada servidor.

## 1. Iniciar el backend

La primera vez, crea un entorno virtual e instala las dependencias:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

En cada sesión, inicia FastAPI:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --host 127.0.0.1 --port 8765
```

Abre [la documentación interactiva de la API](http://127.0.0.1:8765/docs) para comprobar que está en marcha. Ahí también puedes probar `POST /api/datasets` directamente.

En macOS y Linux, usa `python3` para crear el entorno y `./backend/.venv/bin/python` para ejecutar los comandos de pip y Uvicorn.

## 2. Iniciar el frontend

En otra terminal, instala las dependencias con `npm ci` la primera vez y cuando cambie `package-lock.json`. Luego inicia Vite:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre la URL que imprime Vite, normalmente [http://localhost:5173](http://localhost:5173). Vite redirige las solicitudes de `/api` al backend en el puerto `8765`. En macOS y Linux, usa `npm` en lugar de `npm.cmd`.
