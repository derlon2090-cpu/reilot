import {
  createEvolutionInstance,
  deleteEvolutionInstance,
  disconnectEvolutionInstance,
  getEvolutionQr,
  getEvolutionStatus,
  queueEvolutionTestMessage,
  requestEvolutionPairingCode,
  sendEvolutionMessage,
  updateEvolutionHealth
} from "./evolution.js";

export function normalizeWhatsAppPhone(phoneNumber) {
  const value = String(phoneNumber || "").replace(/[+\s-]/g, "");
  if (!/^[1-9]\d{10,14}$/.test(value)) {
    return { ok: false, error: "INVALID_WHATSAPP_PHONE" };
  }
  return { ok: true, phoneNumber: value };
}

export function createWhatsAppProvider({ provider = "evolution", client }) {
  if (provider !== "evolution") {
    throw new Error(`Unsupported WhatsApp provider: ${provider}`);
  }

  return {
    name: "evolution",
    createInstance: (args) => createEvolutionInstance({ ...args, evolution: client }),
    getQr: (args) => getEvolutionQr({ ...args, evolution: client }),
    requestPairingCode: (args) => requestEvolutionPairingCode({ ...args, evolution: client }),
    getStatus: (args) => getEvolutionStatus({ ...args, evolution: client }),
    enqueueTestMessage: (args) => queueEvolutionTestMessage(args),
    sendFromQueue: (args) => sendEvolutionMessage({ ...args, evolution: client }),
    disconnect: (args) => disconnectEvolutionInstance({ ...args, evolution: client }),
    deleteInstance: (args) => deleteEvolutionInstance({ ...args, evolution: client }),
    health: (args) => updateEvolutionHealth({ ...args, evolution: client })
  };
}
