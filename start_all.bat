@echo off
TITLE HydroLens Automation Launcher
echo ===================================================
echo    Launching HydroLens Screening System
echo ===================================================

:: 1. Backend Auto-Setup & Launch
cd backend
if not exist ".venv" (
    echo [*] Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
echo [*] Checking Python dependencies...
pip install -r requirements.txt --quiet

:: NOTE: If your main.py is NOT inside an "app" folder, change "app.main:app" to "main:app" below
start "HydroLens Backend" cmd /k "echo HydroLens FastAPI Backend running on http://127.0.0.1:8000 && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

:: 2. Frontend Auto-Setup & Launch
cd ..\frontend
if not exist "node_modules" (
    echo [*] Installing frontend packages...
    call npm install
)
start "HydroLens Frontend" cmd /k "echo HydroLens Frontend running on http://localhost:5173 && npm run dev"

:: 3. Open Browser
echo [*] Waiting for servers to start...
timeout /t 5 >nul
start http://localhost:5173

echo ===================================================
echo HydroLens launched successfully in your browser!
echo ===================================================
pause