# build_dashboard_cache.py
import pandas as pd
import numpy as np
from pathlib import Path

# === RUTAS (tu CSV real y salida JSON) ===
CSV_PATH = Path(r"C:\Users\joses\OneDrive\Documentos\web_aegis-main\backend\data\consumo_mx_2M.csv")
OUT_DIR  = Path(r"C:\Users\joses\OneDrive\Documentos\web_aegis-main\ia_service\data_cache")

OUT_DIR.mkdir(parents=True, exist_ok=True)

if not CSV_PATH.exists():
    alt = CSV_PATH.with_suffix("")
    pq  = CSV_PATH.with_suffix(".parquet")
    if alt.exists():
        CSV_PATH = alt
    elif pq.exists():
        CSV_PATH = pq
    else:
        raise FileNotFoundError(f"No encontré el CSV/parquet en: {CSV_PATH}")

print(f"📥 Leyendo: {CSV_PATH}")

# Detectar columnas disponibles en el archivo sin cargar todo
# (leemos solo el header)
if CSV_PATH.suffix.lower() == ".parquet":
    # Para parquet no necesitamos usecols; cargaremos y luego normalizamos
    available_cols = None
else:
    with open(CSV_PATH, "r", encoding="utf-8", errors="ignore") as f:
        header = f.readline().strip()
    available_cols = [c.strip() for c in header.split(",")]

# Conjunto de columnas deseadas (algunas pueden faltar)
desired = ["fecha", "consumo_kwh", "costo_mx", "estado", "dispositivo", "usuario"]

# Filtrar usecols según existan
if available_cols is None:
    # parquet: no pasamos usecols, cargamos todo y luego filtramos
    df = pd.read_parquet(CSV_PATH)
else:
    used = [c for c in desired if c in available_cols]
    # Mínimos indispensables para el cálculo
    if "fecha" not in used or "consumo_kwh" not in used:
        raise ValueError(
            f"Tu archivo debe tener al menos 'fecha' y 'consumo_kwh'. "
            f"Encontradas: {available_cols[:10]}..."
        )
    df = pd.read_csv(
        CSV_PATH,
        usecols=used,              # solo las que existan
        parse_dates=["fecha"],     # parseo de fecha
        dayfirst=False,
        encoding="utf-8",
        low_memory=False
    )

# Crear columnas faltantes con valores por defecto
if "dispositivo" not in df.columns: df["dispositivo"] = "Smart Plug"
if "usuario" not in df.columns:     df["usuario"] = "—"
if "estado" not in df.columns:      df["estado"] = "activo"
if "costo_mx" not in df.columns:    df["costo_mx"] = 0.0

# Limpieza y tipos
df = df.dropna(subset=["fecha", "consumo_kwh"]).copy()
df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
df = df.dropna(subset=["fecha"]).copy()

df["consumo_kwh"] = pd.to_numeric(df["consumo_kwh"], errors="coerce").fillna(0.0)
df["costo_mx"]    = pd.to_numeric(df["costo_mx"], errors="coerce").fillna(0.0)
df["estado"]      = df["estado"].astype(str).str.lower().str.strip()

# ===== Cards (mes actual) =====
hoy = df["fecha"].max()
if pd.isna(hoy):
    raise ValueError("No se pudo determinar la fecha máxima; revisa la columna 'fecha'.")

mes_actual = df[df["fecha"].dt.to_period("M") == hoy.to_period("M")]
consumo_mes = float(mes_actual["consumo_kwh"].sum()) if not mes_actual.empty else 0.0

if not mes_actual.empty:
    umbral = mes_actual["consumo_kwh"].quantile(0.95)
    alertas = int((mes_actual["consumo_kwh"] > umbral).sum())
else:
    alertas = 0

ult7 = df[df["fecha"] >= (hoy - pd.Timedelta(days=7))]
activos = int((ult7["estado"] == "activo").sum()) if not ult7.empty else 0

cards = {"consumo": round(consumo_mes, 2), "alertas": alertas, "activos": activos}
pd.Series(cards).to_json(OUT_DIR / "cards.json", orient="index", force_ascii=False)

# ===== Mensual (últimos 7) =====
df["mes"] = df["fecha"].dt.to_period("M")
mens = df.groupby("mes")["consumo_kwh"].sum().sort_index().tail(7)
mensual = {"labels": [str(p) for p in mens.index.astype(str)], "data": [round(x,2) for x in mens.values]}
pd.Series(mensual).to_json(OUT_DIR / "mensual.json", orient="index", force_ascii=False)

# ===== Semanal (últimos 7 días) =====
df["dia"] = df["fecha"].dt.date
sem = df.groupby("dia")["consumo_kwh"].sum().sort_index().tail(7)
semanal = {"labels": [str(d) for d in sem.index], "data": [round(x,2) for x in sem.values]}
pd.Series(semanal).to_json(OUT_DIR / "semanal.json", orient="index", force_ascii=False)

# ===== Histórico (últimos 500) =====
hist = (df.sort_values("fecha", ascending=False)
          .loc[:, ["fecha","dispositivo","usuario","consumo_kwh","costo_mx","estado"]]
          .head(500)
          .copy())
hist["fecha"] = pd.to_datetime(hist["fecha"], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
hist.rename(columns={"consumo_kwh":"consumo","costo_mx":"costo"}, inplace=True)

hist.to_json(OUT_DIR / "historico.json", orient="records", force_ascii=False)
print(f"✅ Cache generado en: {OUT_DIR.resolve()}")
