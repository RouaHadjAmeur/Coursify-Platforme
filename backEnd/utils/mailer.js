/* eslint-env node */
/* global process */
import nodemailer from "nodemailer";

const hasRealSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const devBcc = process.env.DEV_BCC || "";


const transportConfig = hasRealSMTP
  ? {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      logger: process.env.SMTP_DEBUG === "true",
      debug: process.env.SMTP_DEBUG === "true",
    }
  : { jsonTransport: true };

export const transporter = nodemailer.createTransport(transportConfig);

console.log(`[mailer] Transport mode: ${hasRealSMTP ? "REAL SMTP" : "MOCK JSON"}`);
if (hasRealSMTP) {
  transporter.verify((err, success) => {
    if (err) {
      console.error("❌ SMTP verify failed:", err);
    } else {
      console.log("✅ SMTP ready:", success);
    }
  });
}

function extractAddr(str = "") {
  const m = /<([^>]+)>/.exec(String(str));
  return (m?.[1] || String(str)).trim().toLowerCase();
}

export async function safeSendMail(options) {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const envFromRaw = (process.env.SMTP_FROM || "").trim(); 
  const envFromAddr = extractAddr(envFromRaw);
  const smtpUserAddr = extractAddr(smtpUser);

  let from;
  if (envFromRaw && envFromAddr === smtpUserAddr) {
    // use display name + address when the address matches SMTP_USER
    from = envFromRaw;
  } else {
    // fallback to the authenticated address (no display name) to avoid spoofing issues
    from = smtpUser || process.env.SMTP_FROM || "no-reply@coursify.local";
  }

  const finalOpts = {
    ...options,
    from,
    replyTo: options.replyTo || process.env.REPLY_TO || from,
    ...(devBcc ? { bcc: devBcc } : {}),
  };

  try {
    const info = await transporter.sendMail(finalOpts);
    console.log("📧 sendMail info:", {
      messageId: info.messageId,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
    return { ok: true, info };
  } catch (err) {
    console.error("❌ sendMail failed:", err);
    return { ok: false, error: String(err) };
  }
}
