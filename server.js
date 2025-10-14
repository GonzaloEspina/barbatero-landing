import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // restringir en producción a tu dominio
app.use(express.json());

const APPSHEET_BASE = process.env.APPSHEET_BASE_URL; // e.g. https://api.appsheet.com/...
const APPSHEET_KEY = process.env.APPSHEET_API_KEY; // secreto

if (!APPSHEET_BASE || !APPSHEET_KEY) {
  console.error("Missing APPSHEET_BASE_URL or APPSHEET_API_KEY env vars");
  // optionally exit in dev
}

// Ejemplo: obtener lista de servicios desde AppSheet y devolver al frontend
app.get("/api/turnos/servicios", async (req, res) => {
  try {
    // Ajustá path/params según tu AppSheet config
    const url = `${APPSHEET_BASE}/servicios`; 
    const r = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "ApplicationAccessKey": APPSHEET_KEY // ajustá nombre del header si tu AppSheet lo pide distinto
      }
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).send(txt);
    }
    const json = await r.json();
    return res.json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AppSheet proxy error" });
  }
});

// Ejemplo: búsqueda de cliente por dni
app.get("/api/turnos/find-client", async (req, res) => {
  const { dni } = req.query;
  if (!dni) return res.status(400).json({ error: "dni missing" });

  try {
    // Ajustá la URL / query conforme a tu AppSheet API (filter, GET params o request body)
    const url = `${APPSHEET_BASE}/find-client?dni=${encodeURIComponent(dni)}`;
    const r = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "ApplicationAccessKey": APPSHEET_KEY
      }
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).send(txt);
    }
    const json = await r.json();
    return res.json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AppSheet proxy error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));