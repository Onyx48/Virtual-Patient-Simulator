/*
 * "Talk to us" from the public website. Unauthenticated, so: validated, size-limited, a simple
 * per-IP limit, a honeypot field, and stored in its own collection (contactrequests). If mail is
 * configured, a copy goes to CONTACT_TO (or EMAIL_FROM). Nothing else in the app reads it.
 */
import express from "express";
import mongoose from "mongoose";
import { SendEmailCommand } from "@aws-sdk/client-ses";
import { getSesClient } from "../utils/emailService.js";

const ContactRequest = mongoose.models.ContactRequest || mongoose.model("ContactRequest", new mongoose.Schema({
  name: { type: String, maxlength: 120 },
  email: { type: String, maxlength: 200 },
  organisation: { type: String, maxlength: 200 },
  role: { type: String, maxlength: 80 },
  topic: { type: String, maxlength: 60 },
  message: { type: String, maxlength: 4000 },
  ip: { type: String },
}, { timestamps: true }));

const router = express.Router();
const hits = new Map(); // ip -> [timestamps]
const esc = (s) => String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot: bots fill every field
    const ip = req.ip || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
    if (recent.length >= 5) return res.status(429).json({ message: "Thanks, we have your messages. Please wait a little before sending another." });
    hits.set(ip, [...recent, now]);

    const name = String(b.name || "").trim().slice(0, 120);
    const email = String(b.email || "").trim().slice(0, 200);
    const message = String(b.message || "").trim().slice(0, 4000);
    if (!name) return res.status(400).json({ message: "Please add your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Please add a valid email address." });
    if (message.length < 10) return res.status(400).json({ message: "Please tell us a little more." });

    const doc = await ContactRequest.create({
      name, email, message, ip,
      organisation: String(b.organisation || "").slice(0, 200),
      role: String(b.role || "").slice(0, 80),
      topic: String(b.topic || "").slice(0, 60),
    });

    const to = process.env.CONTACT_TO || process.env.EMAIL_FROM;
    if (to && process.env.EMAIL_FROM) {
      try {
        await getSesClient().send(new SendEmailCommand({
          Source: process.env.EMAIL_FROM,
          Destination: { ToAddresses: [to] },
          ReplyToAddresses: [email],
          Message: {
            Subject: { Data: `VPS website: ${doc.topic || "enquiry"} from ${name}`.slice(0, 200) },
            Body: { Html: { Data: `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt;<br/>${esc(doc.organisation)} ${doc.role ? `· ${esc(doc.role)}` : ""}<br/>Topic: ${esc(doc.topic)}</p><p style="white-space:pre-line">${esc(message)}</p>` } },
          },
        }));
      } catch (e) {
        console.warn("[contact] mail copy failed:", e.message);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;
