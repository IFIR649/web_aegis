# ia_service/tools/build_mineria_cache.py
import os, time, json, re
from pathlib import Path
import numpy as np
import pandas as pd

# =========================
# Config y rutas
# =========================
CSV_PATH = Path(os.getenv("MINERIA_CSV_PATH", r"C:\Users\joses\OneDrive\Documentos\web_aegis-main\backend\data\consumo_mx_2M.csv")).resolve()
OUT_DIR  = Path(os.getenv("MINERIA_OUT_DIR", str((Path(__file__).resolve().parents[1] / "data_cache" / "mineria")))).resolve()
OUT_DIR.mkdir(parents=True, exist_ok=True)

CHUNKSIZE   = int(os.getenv("CHUNKSIZE", "500000"))
MAX_CHUNKS  = int(os.getenv("MAX_CHUNKS", "0"))      # 0 = sin límite
Z_THRESHOLD = float(os.getenv("Z_THRESHOLD", "3.0"))

# Columnas candidatas (tomaremos solo las que existan realmente)
CANDIDATE_COLS = [
    "casa_id",
    "timestamp",
    "fecha", "hora", "hora_dia",
    "consumo_kwh",
    "costo_mx",
    "costo_estimado",
    "dia_semana",
]

EN_ES = {
    "monday":"lunes","tuesday":"martes","wednesday":"miércoles","thursday":"jueves",
    "friday":"viernes","saturday":"sábado","sunday":"domingo"
}
DOW_MAP    = {0:"lunes",1:"martes",2:"miércoles",3:"jueves",4:"viernes",5:"sábado",6:"domingo"}
DIAS_ORDEN = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]

_time_re = re.compile(r"^\s*(\d{1,2})(?::(\d{1,2}))?")

def coerce_time_str(s: pd.Series) -> pd.Series:
    """
    Convierte posibles formatos de hora a 'HH:MM'.
    Acepta: 'H', 'HH', 'H:MM', 'HH:MM', enteros y strings con ruido.
    """
    if s is None:
        return pd.Series(dtype="object")

    # numérico (0..23) -> "HH:00"
    if pd.api.types.is_numeric_dtype(s):
        hh = s.astype("Int64").astype(object)
        return hh.apply(lambda v: f"{int(v):02d}:00" if pd.notna(v) else np.nan)

    s = s.astype(str)

    def _one(x: str):
        m = _time_re.match(x)
        if not m:
            return np.nan
        hh = int(m.group(1))
        mm = int(m.group(2)) if m.group(2) is not None else 0
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"
        return np.nan

    return s.map(_one)

def normalize_dow(series: pd.Series, dt_col: pd.Series) -> pd.Series:
    """Normaliza 'dia_semana'; si no está/vale, se infiere de dt_col."""
    if series is not None and series.notna().any():
        s = (series.astype(str)
             .str.normalize('NFKD')
             .str.encode('ascii', errors='ignore')
             .str.decode('utf-8')
             .str.strip()
             .str.lower())
        s = s.map(lambda x: EN_ES.get(x, x))
        mask_na = s.isna() | (s == "") | (~s.isin(DIAS_ORDEN))
        if mask_na.any():
            s.loc[mask_na] = dt_col.loc[mask_na].dt.dayofweek.map(DOW_MAP)
        return s
    else:
        return dt_col.dt.dayofweek.map(DOW_MAP)

def detect_usecols(csv_path: Path) -> list:
    """Detecta columnas disponibles y valida precondiciones."""
    df_head = pd.read_csv(csv_path, nrows=1)
    cols = df_head.columns.tolist()
    usecols = [c for c in CANDIDATE_COLS if c in cols]
    if "consumo_kwh" not in usecols:
        raise ValueError("El CSV no contiene la columna obligatoria 'consumo_kwh'.")
    # Aceptamos timestamp, o fecha + (hora_dia | hora)
    if not (("timestamp" in usecols) or ("fecha" in usecols and (("hora_dia" in usecols) or ("hora" in usecols)))):
        raise ValueError("Se requiere 'timestamp' o el par 'fecha' + ('hora_dia' o 'hora').")
    return usecols

# ====== NUEVO: elegir la mejor fuente de HORA por chunk ======
def _hours_from_ts(ts: pd.Series):
    if ts is None or not pd.api.types.is_datetime64_any_dtype(ts):
        return None
    return ts.dt.hour

def _hours_from_fecha_hora(df: pd.DataFrame, prefer: str):
    if prefer == "hora_dia" and "hora_dia" in df.columns:
        hhmm = coerce_time_str(df["hora_dia"])
    elif prefer == "hora" and "hora" in df.columns:
        hhmm = coerce_time_str(df["hora"])
    else:
        return None
    fecha_txt = df["fecha"].astype(str).str.strip() if "fecha" in df.columns else ""
    dt = pd.to_datetime(fecha_txt + " " + hhmm.astype(str), errors="coerce")
    return dt.dt.hour

def _pick_best_hours(df: pd.DataFrame):
    cand = []

    # 1) timestamp
    if "timestamp" in df.columns and pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        h_ts = _hours_from_ts(df["timestamp"])
        if h_ts is not None:
            cand.append(("timestamp", h_ts))

    # 2) fecha + hora_dia
    if "fecha" in df.columns and "hora_dia" in df.columns:
        h_hd = _hours_from_fecha_hora(df, "hora_dia")
        if h_hd is not None:
            cand.append(("fecha+hora_dia", h_hd))

    # 3) fecha + hora
    if "fecha" in df.columns and "hora" in df.columns:
        h_h = _hours_from_fecha_hora(df, "hora")
        if h_h is not None:
            cand.append(("fecha+hora", h_h))

    # Filtrar NaN y medir proporción de hora=00
    clean = []
    for name, hrs in cand:
        mask = hrs.notna()
        if mask.any():
            hrs2 = hrs.loc[mask].astype(int)
            p0 = (hrs2 == 0).mean()
            clean.append((name, hrs2, p0))

    if not clean:
        return None, None

    # Elegimos la de menor proporción en 00
    clean.sort(key=lambda t: t[2])
    best_name, best_hours, best_p0 = clean[0]
    return best_name, best_hours

def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"No se encontró el CSV en: {CSV_PATH}")

    print(f"📥 Leyendo: {CSV_PATH}")
    t0 = time.time()

    USECOLS = detect_usecols(CSV_PATH)
    print(f"🔎 Columnas detectadas para uso: {USECOLS}")

    hora_sum   = np.zeros(24, dtype=np.float64)
    dia_sum    = {d: 0.0 for d in DIAS_ORDEN}
    muni_sum   = {}
    scatter    = []
    total_rows = 0
    rng = np.random.default_rng(42)

    parse_dates = ["timestamp"] if "timestamp" in USECOLS else None

    reader = pd.read_csv(
        CSV_PATH,
        usecols=USECOLS,
        chunksize=CHUNKSIZE,
        parse_dates=parse_dates,
        dtype={"casa_id": "category"},
        low_memory=True,
        memory_map=True
    )

    for i, df in enumerate(reader, start=1):
        t_chunk = time.time()

        # ===== Elegir la mejor fuente de hora para ESTE chunk =====
        best_name, best_hours = _pick_best_hours(df)
        if best_hours is None:
            print(f"⚠️  Chunk {i} sin horas válidas (timestamp/fecha+hora_dia/fecha+hora). Saltando.")
            continue

        # Log de debug en los primeros 2 chunks
        if i <= 2:
            vc = best_hours.value_counts().sort_index()
            total_h = int(best_hours.shape[0])
            p0 = (best_hours == 0).mean()
            print(f"✅ Fuente de hora elegida chunk {i}: {best_name} | total={total_h} | p(h=00)={p0:0.3f}")
            print(f"⏱️  Dist horas chunk {i} (primeras 24):", dict(vc.head(24)))

        # Construir dt coherente con la fuente elegida
        if best_name == "timestamp":
            dt = df.loc[best_hours.index, "timestamp"]
        else:
            # Creamos "HH:MM" a partir de best_hours y combinamos con fecha
            hhmm = best_hours.astype(int).astype(str).str.zfill(2) + ":00"
            fecha_txt = df.loc[best_hours.index, "fecha"].astype(str).str.strip() if "fecha" in df.columns else ""
            dt = pd.to_datetime(fecha_txt + " " + hhmm, errors="coerce")

        mask_valid = dt.notna()
        if not mask_valid.any():
            print(f"⚠️  Chunk {i}: después de armar dt no quedaron válidos. Saltando.")
            continue

        df = df.loc[mask_valid].copy()
        dt = dt.loc[mask_valid]

        # Numéricos
        df["consumo_kwh"] = pd.to_numeric(df["consumo_kwh"], errors="coerce").fillna(0.0)
        costo_est = pd.to_numeric(df.get("costo_estimado", np.nan), errors="coerce")
        costo_mx  = pd.to_numeric(df.get("costo_mx", np.nan),        errors="coerce")
        costo     = costo_est.fillna(costo_mx).fillna(0.0)

        # Consumo por hora (rápido)
        h    = dt.dt.hour.values
        cons = df["consumo_kwh"].values
        hora_sum += np.bincount(h, weights=cons, minlength=24)

        # Consumo por día
        dow = normalize_dow(df.get("dia_semana"), dt)
        dsum = df.groupby(dow, observed=False)["consumo_kwh"].sum()
        for d, v in dsum.items():
            if d in dia_sum:
                dia_sum[d] += float(v)

        # Top municipios
        if "casa_id" in df.columns:
            msum = df.groupby("casa_id", observed=False)["consumo_kwh"].sum()
            for k, v in msum.items():
                muni_sum[k] = muni_sum.get(k, 0.0) + float(v)

        # Muestra scatter (consumo vs costo)
        n = len(df)
        if n:
            take = min(400, n)
            idx = rng.choice(n, size=take, replace=False)
            cons_sample  = cons[idx]
            costo_sample = costo.iloc[idx].to_numpy(dtype=float, copy=False)
            scatter.extend({"x": float(x), "y": float(y)} for x, y in zip(cons_sample, costo_sample))
            if len(scatter) > 5000:
                scatter = scatter[:5000]

        total_rows += n

        dt_chunk = time.time() - t_chunk
        speed    = n / max(dt_chunk, 1e-9)
        elapsed  = time.time() - t0
        print(f"🔹 Chunk {i} | filas: {n:,} | {dt_chunk:0.1f}s | {speed:0.0f} reg/s | total {elapsed:0.0f}s")

        if MAX_CHUNKS and i >= MAX_CHUNKS:
            print(f"⏭️  Cortando por MAX_CHUNKS={MAX_CHUNKS}")
            break

    # ===== KPIs y salidas =====
    arr = np.array([p["x"] for p in scatter], dtype=float)
    if arr.size >= 30:
        mu, sd = arr.mean(), arr.std() or 1e-9
        z = np.abs((arr - mu) / sd)
        n_anom = int((z >= Z_THRESHOLD).sum())
    else:
        n_anom = 0

    (OUT_DIR / "resumen.json").write_text(
        json.dumps({
            "n_registros": int(total_rows),
            "n_municipios": int(len(muni_sum)),
            "n_anomalias": int(n_anom),
            "z_threshold": Z_THRESHOLD
        }, ensure_ascii=False),
        encoding="utf-8"
    )

    labels_h = [f"{h:02d}" for h in range(24)]
    (OUT_DIR / "consumo_hora.json").write_text(
        json.dumps({"labels": labels_h, "data": [round(float(v), 3) for v in hora_sum.tolist()]}, ensure_ascii=False),
        encoding="utf-8"
    )

    (OUT_DIR / "consumo_dia.json").write_text(
        json.dumps({"labels": [d.capitalize() for d in DIAS_ORDEN],
                    "data": [round(float(dia_sum.get(d, 0.0)), 3) for d in DIAS_ORDEN]}, ensure_ascii=False),
        encoding="utf-8"
    )

    top = sorted(muni_sum.items(), key=lambda kv: kv[1], reverse=True)[:10]
    (OUT_DIR / "top_dispositivos.json").write_text(
        json.dumps([{"municipio": k, "total": round(float(v), 3)} for k, v in top], ensure_ascii=False),
        encoding="utf-8"
    )

    (OUT_DIR / "consumo_vs_costo.json").write_text(
        json.dumps(scatter[:1200], ensure_ascii=False),
        encoding="utf-8"
    )

    print(f"✅ Cache listo en {OUT_DIR} | Tiempo total: {time.time()-t0:0.1f}s")

if __name__ == "__main__":
    main()
