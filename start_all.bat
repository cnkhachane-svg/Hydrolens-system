@echo off
title Launching HydroLens System

echo [1/2] Launching FastAPI Backend on :8000...
start "HydroLens-Backend" cmd /k "cd /d C:\Users\cnkha\hydrolens-system\backend && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo [2/2] Launching Vite Frontend on :5173...
start "HydroLens-Frontend" cmd /k "cd /d C:\Users\cnkha\hydrolens-system\frontend && npm run dev"

timeout /t 3 >nul
start chrome "http://localhost:5173"

echo HydroLens is online!
