import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import turnsRouter from "./routes/turns.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/turnos", turnsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});