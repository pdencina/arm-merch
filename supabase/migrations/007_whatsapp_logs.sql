-- ╔═══════════════════════════════════════════════════════════╗
-- ║  WhatsApp Logs — Registro de mensajes enviados/recibidos ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('outgoing', 'incoming', 'status')),
  phone text,
  message_id text,
  message_type text, -- text, template, image, button, interactive, etc.
  status text, -- sent, delivered, read, failed (para status updates)
  text text, -- contenido de texto del mensaje
  contact_name text, -- nombre del contacto de WhatsApp
  template_name text, -- nombre del template usado (para outgoing)
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  campus_id uuid REFERENCES campus(id) ON DELETE SET NULL,
  payload jsonb, -- payload completo para debug
  error text, -- mensaje de error si falló
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas comunes
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON whatsapp_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_direction ON whatsapp_logs(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_order_id ON whatsapp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON whatsapp_logs(message_id);

-- Comentarios
COMMENT ON TABLE whatsapp_logs IS 'Registro de todos los mensajes WhatsApp enviados y recibidos por el sistema';
COMMENT ON COLUMN whatsapp_logs.direction IS 'outgoing = enviado por nosotros, incoming = recibido del cliente, status = actualización de estado';
COMMENT ON COLUMN whatsapp_logs.payload IS 'Payload completo de Meta para debugging';
