-- Notification staff : une commande boutique vient d'être payée.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHOP_ORDER_PLACED';
