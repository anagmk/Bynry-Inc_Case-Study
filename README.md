# Bynry-Inc_Case-Study

Inventory Management System for B2B SaaS


Part 1 - Code Review & Debugging-
https://github.com/anagmk/Bynry-Inc_Case-Study/blob/main/product_api.py
I found a few issues in this code.
Issue 1 - No input validation There is no input validation in this code. If a required field like sku is missing, the code will crash with a raw Python error instead of returning a proper error response to the client.
Issue 2 - SKU uniqueness not checked SKU is supposed to be unique across the platform, but the code never checks if it already exists. This could cause duplicate products and wrong inventory calculations.
Issue 3 - Two separate database commits There are two commits — one for creating the product and one for adding it to inventory. The problem is if the second commit fails, the product is already saved in the database but never recorded in inventory. So we end up with a product that has no stock record. I fixed this by removing the first commit and doing a single commit at the end after both the product and inventory are staged.
Issue 4 - No error handling There is no try/except block. Any unexpected error will crash the entire request with no meaningful response. I wrapped the logic in try/except with a rollback so if anything fails, all changes get cancelled cleanly.
Issue 5 - Wrong status code The original code returns 200 for a successful creation. But the correct REST API practice for creating a new resource is returning 201 Created.
Bonus observation I also noticed the price field is a bit ambiguous. It doesn't specify whether it's the price the company bought from the supplier or the selling price for customers. I made it optional for now and this would be something I'd clarify with the product team before finalizing.
Even though I rewrote the fix in my own structure, the logic stays the same — validation, uniqueness check, atomic transaction, error handling. The language changes but the backend thinking doesn't.






Part 2 - Database Design - https://github.com/anagmk/Bynry-Inc_Case-Study/blob/main/Database%20Design
I designed 8 tables for this inventory system. Each table has a specific responsibility.
Companies Stores all company related info — name, email, city, address. If it's a branch, branch name is also stored. Created_at tracks when the company was added.
Warehouses One company can have multiple warehouses, so I connected warehouse to its company using company_id as a foreign key. Each warehouse has its own name, email and city.
Products Stores what the product actually is — name, SKU, description, cost price and selling price. I separated cost price and selling price because the original code just mentioned price which was ambiguous. Also added an is_bundle flag to identify if a product is a bundle or a normal product.
Inventory Same product can exist in multiple warehouses with different quantities, so quantity can't live inside the products table. Inventory bridges products and warehouses — it stores which product, which warehouse, how many, and the low stock threshold for alerts.
Suppliers Stores supplier info — name, email, city, description. Just who the supplier is, nothing else.
Product Suppliers Same product can come from multiple suppliers and same supplier can provide multiple products. This table bridges them and also stores the cost price per supplier since different suppliers may offer different prices for the same product.
Bundle Items A bundle is a product that contains other products inside it. Since both the bundle and the items inside are products, both foreign keys point back to the products table. Added a check constraint so quantity can never be 0 or negative.
Inventory Logs Every time inventory changes — restock, sale, damage — it gets recorded here with the quantity changed, reason, and timestamp. This keeps the inventory table clean and gives a full history of stock movements.

Missing Requirements
Is price the buying price from supplier or selling price to customer, or both?
Who sets the low stock threshold — is it per product or per warehouse?
If a bundle is sold, does each item's stock reduce separately?
If a product has multiple suppliers, which one do we reorder from first?
Is there a maximum capacity per warehouse?
Do we need a users or roles table for who manages the system?
Do products have categories?
Is pricing always in one currency?


Part 3 - API Implementation
https://github.com/anagmk/Bynry-Inc_Case-Study/blob/main/API_Implimentaion.js
Endpoint:
GET /api/companies/:company_id/alerts/low-stock
Implementation explanation:
First I check if the company exists using company_id from the URL params. If company is not found I return 404 immediately instead of running unnecessary queries.
Then I fetch all warehouses belonging to that company and extract their IDs into an array. This array is used to find inventory records across all warehouses of that company.
Next I query the inventory table for items where current stock is below the low stock threshold. This handles multiple warehouses automatically since I'm checking all warehouse IDs at once.
For each low stock item I check the inventory logs for recent sales in the last 30 days. If a product has no recent sales it gets filtered out — no point alerting for products that aren't moving.
For products with recent sales I calculate average daily sales by dividing total sold by 30. Then days until stockout is calculated by dividing current stock by average daily sales.
Finally I fetch the first linked supplier for each product to include reorder contact info in the response.
Edge cases I handled:
Company not found → 404
No warehouses found → 404
No low stock items → empty alerts array
No recent sales → product skipped
No supplier linked → supplier returns null
Zero daily sales → days_until_stockout returns null to avoid divide by zero
Assumptions
I used Node.js and Express with MongoDB since the case study allowed any language or framework
Recent sales activity is defined as any sale recorded in the last 30 days in inventory logs
Low stock threshold is stored per product per warehouse in the inventory table
days_until_stockout is calculated as current stock divided by average daily sales over last 30 days
When a product has multiple suppliers only the first supplier is returned in the response
Bundle products follow the same low stock rules as normal products
All prices are stored in a single currency
