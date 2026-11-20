-- =====================================================================
-- Batloung Farm Distribution System  |  Part A: database + sample data
-- Run:  mysql -u root -p < database/schema.sql
-- =====================================================================
DROP DATABASE IF EXISTS batloung_farm;
CREATE DATABASE batloung_farm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

CREATE TABLE Suppliers (
    supplier_id    INT AUTO_INCREMENT PRIMARY KEY,
    business_name  VARCHAR(120) NOT NULL UNIQUE,
    contact_person VARCHAR(100) NOT NULL,
    phone          VARCHAR(20)  NOT NULL UNIQUE,
    province       ENUM('Gauteng','Free State','KwaZulu-Natal','Western Cape',
                        'Eastern Cape','Limpopo','Mpumalanga','North West') NOT NULL,
    address        VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Fruits (
    fruit_id    INT AUTO_INCREMENT PRIMARY KEY,
    fruit_name  VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    status      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE Vendors (
    vendor_id         INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name       VARCHAR(100) NOT NULL,
    phone_number      VARCHAR(20)  NOT NULL UNIQUE,
    location          VARCHAR(120) NOT NULL,
    registration_date DATE NOT NULL DEFAULT (CURRENT_DATE)
);

CREATE TABLE Purchases (
    purchase_id   INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id   INT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id)
        REFERENCES Suppliers(supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE Purchase_Details (
    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id    INT NOT NULL,
    fruit_id       INT NOT NULL,
    quantity       INT NOT NULL CHECK (quantity > 0),
    unit_cost      DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
    packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
    CONSTRAINT fk_pd_purchase FOREIGN KEY (purchase_id) REFERENCES Purchases(purchase_id) ON DELETE CASCADE,
    CONSTRAINT fk_pd_fruit    FOREIGN KEY (fruit_id)    REFERENCES Fruits(fruit_id)
);

CREATE TABLE Sales (
    sale_id        INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id      INT NOT NULL,
    sale_date      DATE NOT NULL,
    payment_status ENUM('PAID','PARTIALLY_PAID','UNPAID') NOT NULL DEFAULT 'UNPAID',
    payment_method ENUM('CASH','MOBILE_MONEY','CREDIT') NOT NULL,
    amount_paid    DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    CONSTRAINT fk_sale_vendor FOREIGN KEY (vendor_id) REFERENCES Vendors(vendor_id)
);

CREATE TABLE Sales_Details (
    sales_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id        INT NOT NULL,
    fruit_id       INT NOT NULL,
    packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
    quantity       INT NOT NULL CHECK (quantity > 0),
    unit_price     DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    CONSTRAINT fk_sd_sale  FOREIGN KEY (sale_id)  REFERENCES Sales(sale_id) ON DELETE CASCADE,
    CONSTRAINT fk_sd_fruit FOREIGN KEY (fruit_id) REFERENCES Fruits(fruit_id)
);

-- One row per fruit AND packaging size. selling_price lives here so every
-- packaging size has its own price and the API can total a sale automatically.
CREATE TABLE Stock (
    stock_id           INT AUTO_INCREMENT PRIMARY KEY,
    fruit_id           INT NOT NULL,
    packaging_size     ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    selling_price      DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id) REFERENCES Fruits(fruit_id) ON DELETE CASCADE,
    CONSTRAINT uq_stock_fruit_pkg UNIQUE (fruit_id, packaging_size)
);

-- ---------------------------- SAMPLE DATA ----------------------------
INSERT INTO Suppliers (business_name, contact_person, phone, province, address) VALUES
('Gauteng Fresh Produce','Thabo Nkosi','+27110001111','Gauteng','12 Fruit Rd, Johannesburg'),
('Free State Orchards','Anna Botha','+27510002222','Free State','45 Farm Ln, Bloemfontein'),
('KZN Banana Co','Sipho Dlamini','+27310003333','KwaZulu-Natal','8 Palm St, Durban'),
('Cape Grape Growers','Johan van Wyk','+27210004444','Western Cape','22 Vine Ave, Cape Town'),
('Limpopo Mango Ltd','Mpho Sithole','+27150005555','Limpopo','9 Mango Rd, Polokwane'),
('Eastern Cape Citrus','Lindiwe Mbeki','+27430006666','Eastern Cape','3 Citrus Way, Gqeberha');

INSERT INTO Fruits (fruit_name, description, status) VALUES
('Apple','Fresh red apples','ACTIVE'),
('Banana','Yellow ripe bananas','ACTIVE'),
('Orange','Sweet oranges','ACTIVE'),
('Mango','Ripe mangoes','ACTIVE'),
('Grapes','Green seedless grapes','ACTIVE');

INSERT INTO Vendors (vendor_name, phone_number, location, registration_date) VALUES
('Maseru Street Vendors','+26650001111','Maseru CBD','2025-01-15'),
('Leribe Market','+26650002222','Leribe','2025-02-10'),
('Mafeteng Traders','+26650003333','Mafeteng','2025-03-05'),
('Mohale Fruit Stand','+26650004444','Mohale''s Hoek','2025-03-20');

-- Opening stock + per-size selling prices (small < medium < large)
INSERT INTO Stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES
(1,'SMALL', 50, 14.00),(1,'MEDIUM', 70, 19.00),(1,'LARGE',100, 25.00),
(2,'SMALL', 80,  6.00),(2,'MEDIUM',150, 10.00),(2,'LARGE', 60, 15.00),
(3,'SMALL', 60,  6.00),(3,'MEDIUM', 90, 10.00),(3,'LARGE', 40, 14.00),
(4,'SMALL', 40, 14.00),(4,'MEDIUM', 50, 22.00),(4,'LARGE', 30, 32.00),
(5,'SMALL', 20, 16.00),(5,'MEDIUM', 35, 22.00),(5,'LARGE', 80, 30.00);

INSERT INTO Purchases (supplier_id, purchase_date, total_amount) VALUES (1,'2025-04-01',0),(4,'2025-04-05',0);
INSERT INTO Purchase_Details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
(1,1,100,8.50,'LARGE'),(1,2,150,5.00,'MEDIUM'),
(2,5,80,12.00,'LARGE'),(2,3,60,4.00,'SMALL');
UPDATE Purchases p SET total_amount =
  (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM Purchase_Details d WHERE d.purchase_id = p.purchase_id);

INSERT INTO Sales (vendor_id, sale_date, payment_status, payment_method, amount_paid, total_amount) VALUES
(1,'2025-04-10','PAID','CASH',1700.00,1700.00),
(2,'2025-04-12','PARTIALLY_PAID','MOBILE_MONEY',300.00,600.00),
(3,'2025-04-15','UNPAID','CREDIT',0.00,500.00);
INSERT INTO Sales_Details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
(1,1,'LARGE',40,25.00),(1,2,'MEDIUM',70,10.00),
(2,5,'LARGE',20,30.00),
(3,3,'MEDIUM',50,10.00);
