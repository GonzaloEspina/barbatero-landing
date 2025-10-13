import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import turnsRouter from "./routes/turns.js";
import bodyParser from "body-parser";
import { createClient, updateClient } from "./controllers/clientsController.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/turnos", turnsRouter);
// registrar ruta para crear cliente (asegurá que no exista duplicada)
app.post("/api/clients/create", createClient);
app.put("/api/clients/update", updateClient);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});