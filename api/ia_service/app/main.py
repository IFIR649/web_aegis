# ia_service/main.py  — API FastAPI (debe existir "app")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import joblib, json, os
import pandas as pd
from pathlib import Path
from . import MODEL_DIR, DATA_CACHE_DIR


# ---------------- Config ----------------
MODEL_PATH = os.getenv("MODEL_PATH", "model_assets/modelo_rf_multioutput_ligero.pkl")
TRAIN_COLUMNS_PATH = os.getenv("TRAIN_COLUMNS_PATH", "model_assets/train_columns.json")
DASH_CACHE = Path(os.getenv("DASH_CACHE", "data_cache"))          # /ia_service/data_cache
MINERIA_CACHE = DASH_CACHE / "mineria"                             # /ia_service/data_cache/mineria

FEATURES_NUM = ['consumo_kwh', 'consumo_pico', 'promedio_hora', 'costo_estimado']
FEATURES_CAT = ['estado', 'hora_dia', 'dia_semana', 'casa_id', 'modo_ecologico_activado']

ESTADOS = ["activo", "inactivo", "sin conexión", "suministro cortado"]
DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MUNICIPIOS = [
    "Puebla","Tehuacán","San Martín Texmelucan","San Pedro Cholula","San Andrés Cholula",
    "Atlixco","Cuautlancingo","Huejotzingo","Amozoc","Tecamachalco","Xicotepec","Zacatlán","Huauchinango"
]

# ---------------- App ----------------
app = FastAPI(title="IA Consumo/Costo API", version="1.0.0")  # <— ESTO es lo que uvicorn busca

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ---------------- Modelo ----------------
model = None
train_columns = None

def _load_model_and_columns():
    global model, train_columns
    if not Path(MODEL_PATH).exists():
        raise FileNotFoundError(f"No se encontró el modelo en: {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    if Path(TRAIN_COLUMNS_PATH).exists():
        train_columns = json.loads(Path(TRAIN_COLUMNS_PATH).read_text(encoding="utf-8"))
    else:
        train_columns = None

try:
    _load_model_and_columns()
    MODEL_OK, MODEL_MSG = True, "loaded"
except Exception as e:
    MODEL_OK, MODEL_MSG = False, f"error: {e}"

# ---------------- Schemas ----------------
class Registro(BaseModel):
    consumo_kwh: float
    consumo_pico: float
    promedio_hora: float
    costo_estimado: float
    estado: Optional[str] = Field(default="activo")
    hora_dia: Optional[str] = Field(default="00:00")
    dia_semana: Optional[str] = Field(default="lunes")
    casa_id: Optional[str] = Field(default="Puebla")
    modo_ecologico_activado: Optional[int] = Field(default=0)

class Lote(BaseModel):
    registros: List[Registro]

# ---------------- Utils ----------------
def _coerce_inputs(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # categóricas
    if 'estado' not in df or df['estado'].isna().any(): df['estado'] = 'activo'
    df['estado'] = df['estado'].where(df['estado'].isin(ESTADOS), 'activo')

    if 'dia_semana' not in df or df['dia_semana'].isna().any(): df['dia_semana'] = 'lunes'
    df['dia_semana'] = df['dia_semana'].astype(str).str.lower().str.strip()
    df['dia_semana'] = df['dia_semana'].where(df['dia_semana'].isin(DIAS_SEMANA), 'lunes')

    if 'hora_dia' not in df or df['hora_dia'].isna().any(): df['hora_dia'] = '00:00'
    df['hora_dia'] = df['hora_dia'].astype(str).str.slice(0,5)

    if 'casa_id' not in df or df['casa_id'].isna().any(): df['casa_id'] = 'Puebla'
    df['casa_id'] = df['casa_id'].where(df['casa_id'].isin(MUNICIPIOS), 'Puebla')

    if 'modo_ecologico_activado' not in df: df['modo_ecologico_activado'] = 0
    df['modo_ecologico_activado'] = df['modo_ecologico_activado'].fillna(0).astype(int)

    # numéricas
    for c in FEATURES_NUM:
        if c not in df: df[c] = 0.0
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    df = df[FEATURES_NUM + FEATURES_CAT]
    X = pd.get_dummies(df, drop_first=True)
    if train_columns is not None:
        X = X.reindex(columns=train_columns, fill_value=0)
    return X

def _read_json_cache(path: Path):
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No existe {path}")
    return json.loads(path.read_text(encoding="utf-8"))

# ---------------- Endpoints básicos ----------------
@app.get("/")
def root():
    return {"msg": "IA Consumo/Costo API OK. Revisa /health y /docs"}

@app.get("/health")
def health():
    return {"status": "ok" if MODEL_OK else "error", "model_loaded": MODEL_OK, "detail": MODEL_MSG}

@app.get("/schema")
def schema():
    return {
        "features_numeric": FEATURES_NUM, "features_categorical": FEATURES_CAT,
        "estados": ESTADOS, "dias_semana": DIAS_SEMANA, "municipios": MUNICIPIOS,
        "train_columns_loaded": train_columns is not None
    }

# ---------------- Predicción ----------------
@app.post("/predict")
def predict(item: Registro):
    if not MODEL_OK:
        raise HTTPException(status_code=503, detail=f"Modelo no disponible: {MODEL_MSG}")
    df = pd.DataFrame([item.dict()])
    X = _coerce_inputs(df)
    y = model.predict(X)[0]  # [consumo_next, costo_next]
    return {"consumo_kwh_next": float(y[0]), "costo_mx_next": float(y[1])}

@app.post("/predict_batch")
def predict_batch(items: Lote):
    if not MODEL_OK:
        raise HTTPException(status_code=503, detail=f"Modelo no disponible: {MODEL_MSG}")
    df = pd.DataFrame([r.dict() for r in items.registros])
    X = _coerce_inputs(df)
    y = model.predict(X)  # (n,2)
    return {
        "n": int(len(y)),
        "predicciones": [{"consumo_kwh_next": float(a), "costo_mx_next": float(b)} for a, b in y]
    }

# ---------------- Dashboard cache ----------------
@app.get("/dash/cards")
def dash_cards():
    return _read_json_cache(DASH_CACHE / "cards.json")

@app.get("/dash/mensual")
def dash_mensual():
    return _read_json_cache(DASH_CACHE / "mensual.json")

@app.get("/dash/semanal")
def dash_semanal():
    return _read_json_cache(DASH_CACHE / "semanal.json")

@app.get("/dash/historico")
def dash_historico(limit: int = 100):
    data = _read_json_cache(DASH_CACHE / "historico.json")
    return data[:max(1, min(limit, len(data)))]

# ---------------- Minería cache ----------------
@app.get("/mineria_cache")
def mineria_cache():
    """Devuelve todos los JSONs que arma build_mineria_cache.py"""
    return {
        "resumen": _read_json_cache(MINERIA_CACHE / "resumen.json"),
        "consumo_hora": _read_json_cache(MINERIA_CACHE / "consumo_hora.json"),
        "consumo_dia": _read_json_cache(MINERIA_CACHE / "consumo_dia.json"),
        "top_dispositivos": _read_json_cache(MINERIA_CACHE / "top_dispositivos.json"),
        "consumo_vs_costo": _read_json_cache(MINERIA_CACHE / "consumo_vs_costo.json"),
    }
