-- ===== МАСОВЕ ДОДАВАННЯ ТОВАРІВ В БД =====
-- Скопіюйте ці запити в MySQL Workbench або phpMyAdmin

-- ===== 🎮 ВІДЕОКАРТИ (GPU) =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('NVIDIA RTX 4090', 79999, 'gpu', 2, 'Найпотужніша відеокарта для гейміну та професійної роботи', 
  JSON_OBJECT('memory', '24gb', 'series', 'rtx40', 'interface', 'pci-e-4')),

('NVIDIA RTX 4080', 59999, 'gpu', 5, 'Топовна відеокарта для максимальної якості гейміну', 
  JSON_OBJECT('memory', '16gb', 'series', 'rtx40', 'interface', 'pci-e-4')),

('NVIDIA RTX 4070 Ti', 49999, 'gpu', 8, 'Потужна відеокарта для ігор на UHD', 
  JSON_OBJECT('memory', '12gb', 'series', 'rtx40', 'interface', 'pci-e-4')),

('NVIDIA RTX 4070', 35999, 'gpu', 12, 'Відеокарта для гейміну на 1440p', 
  JSON_OBJECT('memory', '12gb', 'series', 'rtx40', 'interface', 'pci-e-4')),

('NVIDIA RTX 4060 Ti', 22999, 'gpu', 15, 'Бюджетна карта для ігор на 1080p', 
  JSON_OBJECT('memory', '8gb', 'series', 'rtx40', 'interface', 'pci-e-4')),

('AMD Radeon RX 7900 XTX', 59999, 'gpu', 3, 'Флагман AMD з 24GB VRAM', 
  JSON_OBJECT('memory', '24gb', 'series', 'rx7000', 'interface', 'pci-e-4')),

('AMD Radeon RX 7900 XT', 44999, 'gpu', 6, 'Топовна AMD карта для гейміну', 
  JSON_OBJECT('memory', '20gb', 'series', 'rx7000', 'interface', 'pci-e-4'));

-- ===== 🖥️ ПРОЦЕСОРИ (CPU) =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('Intel Core i9-13900KS', 29999, 'cpu', 3, 'Топовний 13-го покоління Intel з максимальною частотою', 
  JSON_OBJECT('cores', '24', 'threads', '32', 'socket', 'lga1700', 'tdp', '150')),

('Intel Core i9-13900K', 24999, 'cpu', 5, 'Флагман 13-го покоління для ігор та роботи', 
  JSON_OBJECT('cores', '24', 'threads', '32', 'socket', 'lga1700', 'tdp', '125')),

('Intel Core i7-13700K', 19999, 'cpu', 8, 'Потужний процесор для ігор та мультимедії', 
  JSON_OBJECT('cores', '16', 'threads', '24', 'socket', 'lga1700', 'tdp', '125')),

('Intel Core i5-13600K', 14999, 'cpu', 12, 'Оптимальний середньогамер для більшості завдань', 
  JSON_OBJECT('cores', '14', 'threads', '20', 'socket', 'lga1700', 'tdp', '125')),

('AMD Ryzen 9 7950X', 29999, 'cpu', 4, 'Потужний 16-ядерний процесор для роботи та ігор', 
  JSON_OBJECT('cores', '16', 'threads', '32', 'socket', 'am5', 'tdp', '105')),

('AMD Ryzen 9 7900X', 22999, 'cpu', 6, 'Топовний AMD з добрим рівнем цін-продуктивності', 
  JSON_OBJECT('cores', '12', 'threads', '24', 'socket', 'am5', 'tdp', '105')),

('AMD Ryzen 7 7700X', 17999, 'cpu', 10, 'Надійний процесор для ігор та роботи', 
  JSON_OBJECT('cores', '8', 'threads', '16', 'socket', 'am5', 'tdp', '105'));

-- ===== 🧠 ПАМ'ЯТЬ (RAM) =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('Kingston Fury RGB 32GB DDR5 6000MHz', 9999, 'ram', 20, 'Швидка пам\'ять з крутою підсвіткою', 
  JSON_OBJECT('capacity', '32', 'type', 'ddr5', 'speed', '6000')),

('Corsair Vengeance RGB 32GB DDR5 6000MHz', 10999, 'ram', 18, 'Преміум RGB пам\'ять від відомого бренду', 
  JSON_OBJECT('capacity', '32', 'type', 'ddr5', 'speed', '6000')),

('G.Skill Trident Z5 32GB DDR5 6000MHz', 9799, 'ram', 15, 'Надійна пам\'ять від легендарного виробника', 
  JSON_OBJECT('capacity', '32', 'type', 'ddr5', 'speed', '6000')),

('Kingston Fury RGB 16GB DDR5 5600MHz', 5499, 'ram', 30, 'Компактна пам\'ять для бюджетних систем', 
  JSON_OBJECT('capacity', '16', 'type', 'ddr5', 'speed', '5600')),

('Crucial P5 Plus 32GB DDR4 3200MHz', 4999, 'ram', 25, 'Старіша, але ще актуальна DDR4 пам\'ять', 
  JSON_OBJECT('capacity', '32', 'type', 'ddr4', 'speed', '3200'));

-- ===== 💾 НАКОПИЧУВАЧІ SSD =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('Samsung 990 Pro 4TB', 19999, 'ssd', 8, 'Найшвидший NVMe SSD з технологією PCI-e 4.0', 
  JSON_OBJECT('capacity', '4000', 'type', 'nvme-m2', 'speed', '7100')),

('WD Black SN850X 2TB', 12999, 'ssd', 12, 'Швидкий SSD від Western Digital', 
  JSON_OBJECT('capacity', '2000', 'type', 'nvme-m2', 'speed', '7100')),

('Crucial P5 Plus 1TB', 5999, 'ssd', 20, 'Майже класу TOP, по адекватній ціні', 
  JSON_OBJECT('capacity', '1000', 'type', 'nvme-m2', 'speed', '6600')),

('Kingston A3000 500GB', 2999, 'ssd', 25, 'Бюджетний NVMe для системи', 
  JSON_OBJECT('capacity', '500', 'type', 'nvme-m2', 'speed', '3500'));

-- ===== 📀 ЖОРСТКІ ДИСКИ HDD =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('WD Blue 4TB', 4999, 'hdd', 10, 'Надійний диск для зберігання даних', 
  JSON_OBJECT('capacity', '4000', 'rpm', '5400', 'cache', '256')),

('Seagate Barracuda 3TB', 3999, 'hdd', 15, 'Класичний диск для масивів', 
  JSON_OBJECT('capacity', '3000', 'rpm', '7200', 'cache', '256')),

('WD Red Pro 12TB', 18999, 'hdd', 3, 'Профійний диск для NAS систем', 
  JSON_OBJECT('capacity', '12000', 'rpm', '7200', 'cache', '256'));

-- ===== 🔌 МАТЕРИНСЬКІ ПЛАТИ (MOBO) =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('ASUS ROG STRIX Z790-E', 34999, 'mobo', 4, 'Топова ATX плата для Core i9 13-го поку', 
  JSON_OBJECT('socket', 'lga1700', 'form_factor', 'atx', 'ram_slots', '4')),

('MSI MPG B850E EDGE WIFI', 28999, 'mobo', 6, 'Преміум плата для Ryzen 7000', 
  JSON_OBJECT('socket', 'am5', 'form_factor', 'atx', 'ram_slots', '4')),

('ASUS TUF B850-PLUS WIFI', 22999, 'mobo', 8, 'Надійна середньогамова плата для AM5', 
  JSON_OBJECT('socket', 'am5', 'form_factor', 'atx', 'ram_slots', '4')),

('ASUS ROG STRIX B650E-I', 24999, 'mobo', 5, 'Компактна MINI-ITX для Ryzen 7000', 
  JSON_OBJECT('socket', 'am5', 'form_factor', 'mini-itx', 'ram_slots', '2'));

-- ===== ⚡ БЛОКИ ЖИВЛЕННЯ (PSU) =====
INSERT INTO products (name, price, category, stock, description, specs) VALUES
('Corsair RM1000e 1000W', 19999, 'psu', 6, 'Модульний блок 80+ Gold для топ системи', 
  JSON_OBJECT('power', '1000', 'type', 'modular', 'efficiency', '80gold')),

('EVGA SuperNOVA 850 G7', 16999, 'psu', 8, 'Відмінний модульний блок для вищення', 
  JSON_OBJECT('power', '850', 'type', 'modular', 'efficiency', '80gold')),

('Seasonic FOCUS GX-750', 14999, 'psu', 10, 'Високоякісний модульний 750W', 
  JSON_OBJECT('power', '750', 'type', 'modular', 'efficiency', '80gold')),

('be quiet! Straight Power 11 650W', 12999, 'psu', 12, 'Тихий надійний блок довопаса', 
  JSON_OBJECT('power', '650', 'type', 'semi-modular', 'efficiency', '80gold')),

('MSI MAG A650BN 650W', 8999, 'psu', 15, 'Бюджетний 80+ Bronze для середньої системи', 
  JSON_OBJECT('power', '650', 'type', 'non-modular', 'efficiency', 'no-cert'));

-- Перевірити вставку
SELECT id, name, category, price, specs FROM products ORDER BY id DESC LIMIT 10;
