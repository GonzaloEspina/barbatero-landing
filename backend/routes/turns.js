import express from "express";
const router = express.Router();

import { findClient, createClient } from "../controllers/clientsController.js";
import { getDisponibilidad, getCalendarAvailability } from "../controllers/availabilityController.js";
import { createTurno, getServicios } from "../controllers/turnsController.js";
import { listMemberships, reserveMembership } from "../controllers/clientsController.js";

// POST /api/turnos/find-client
// body: { contacto: "correo o telefono" }
router.post("/find-client", findClient);
router.post("/create-client", createClient);
router.get("/servicios", getServicios);
router.get("/disponibilidad", getDisponibilidad); // ?day=Lunes
router.get("/calendar", getCalendarAvailability);
router.post("/create", createTurno);

// API para obtener listado de membresías
router.get("/memberships", listMemberships);
// API para reservar (crear) membresía activa
router.post("/memberships/reserve", reserveMembership);

// si tenés la ruta calendar en index, no repetir aquí
export default router;