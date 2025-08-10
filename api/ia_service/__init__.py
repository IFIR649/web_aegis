import azure.functions as func
from app.main import app  # tu FastAPI (mueve 'main.py' a /app y expone "app = FastAPI(...)")

# Exponer FastAPI como función
main = func.AsgiMiddleware(app).main
