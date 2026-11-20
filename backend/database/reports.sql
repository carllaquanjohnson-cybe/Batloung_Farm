-- Part D: SQL reporting queries  (the API runs these same queries)
USE batloung_farm;

-- 1. Five most frequently sold fruits (by boxes sold)
SELECT f.fruit_name, SUM(sd.quantity) AS boxes_sold, COUNT(DISTINCT sd.sale_id) AS times_sold
FROM Sales_Details sd JOIN Fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY boxes_sold DESC LIMIT 5;

-- 2. Total sales revenue in a date range
SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS sales_count
FROM Sales WHERE sale_date BETWEEN '2025-04-01' AND '2025-04-30';

-- 3. Vendor who purchased the highest number of boxes
SELECT v.vendor_id, v.vendor_name, SUM(sd.quantity) AS total_boxes
FROM Vendors v JOIN Sales s ON s.vendor_id = v.vendor_id
JOIN Sales_Details sd ON sd.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name ORDER BY total_boxes DESC LIMIT 1;

-- 4. Current stock by fruit and packaging size
SELECT f.fruit_name, st.packaging_size, st.available_quantity, st.selling_price
FROM Stock st JOIN Fruits f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE');

-- Outstanding balance per vendor
SELECT v.vendor_name, COALESCE(SUM(s.total_amount - s.amount_paid),0) AS outstanding
FROM Vendors v LEFT JOIN Sales s ON s.vendor_id = v.vendor_id
GROUP BY v.vendor_id, v.vendor_name ORDER BY outstanding DESC;
