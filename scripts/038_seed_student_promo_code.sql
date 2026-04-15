-- Ensure the STUDENT2026 promo code exists
INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, is_active)
VALUES ('STUDENT2026', 'months_free', 12, NULL, true)
ON CONFLICT (code) DO NOTHING;
