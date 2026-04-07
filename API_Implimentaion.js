const express = require('express');
const app = express();

app.get('/api/companies/:company_id/alerts/low-stock', async (req, res) => {
    try {
        const { company_id } = req.params;

        // check if company exists
        const company = await Company.findById(company_id);
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        // get all warehouses for this company
        const warehouses = await Warehouse.find({ company_id: company_id });
        if (!warehouses.length) {
            return res.status(404).json({ error: "No warehouses found for this company" });
        }

        // get warehouse ids
        const warehouseIds = warehouses.map(w => w._id);

        // find inventory where current stock is below threshold
        const lowStockItems = await Inventory.find({
            warehouse_id: { $in: warehouseIds },
            $expr: { $lt: ["$quantity", "$low_stock_threshold"] }
        }).populate('product_id').populate('warehouse_id');

        if (!lowStockItems.length) {
            return res.status(200).json({ alerts: [], total_alerts: 0 });
        }

        // get last 30 days date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // build alerts array
        const alerts = await Promise.all(lowStockItems.map(async (item) => {

            // get recent sales from inventory logs
            const recentSales = await InventoryLog.find({
                product_id: item.product_id._id,
                warehouse_id: item.warehouse_id._id,
                reason: 'sale',
                created_at: { $gte: thirtyDaysAgo }
            });

            // if no recent sales, skip this product
            if (!recentSales.length) return null;

            // calculate total sold in last 30 days
            const totalSold = recentSales.reduce((sum, log) => {
                return sum + Math.abs(log.quantity_changed);
            }, 0);

            // average daily sales
            const avgDailySales = totalSold / 30;

            // days until stockout
            const daysUntilStockout = avgDailySales > 0
                ? Math.floor(item.quantity / avgDailySales)
                : null;

            // get first supplier for this product
            const productSupplier = await ProductSupplier.findOne({
                product_id: item.product_id._id
            }).populate('supplier_id');

            return {
                product_id: item.product_id._id,
                product_name: item.product_id.name,
                sku: item.product_id.sku,
                warehouse_id: item.warehouse_id._id,
                warehouse_name: item.warehouse_id.name,
                current_stock: item.quantity,
                threshold: item.low_stock_threshold,
                days_until_stockout: daysUntilStockout,
                supplier: productSupplier ? {
                    id: productSupplier.supplier_id._id,
                    name: productSupplier.supplier_id.name,
                    contact_email: productSupplier.supplier_id.email
                } : null
            };
        }));

        // filter out nulls (products with no recent sales)
        const filteredAlerts = alerts.filter(alert => alert !== null);

        return res.status(200).json({
            alerts: filteredAlerts,
            total_alerts: filteredAlerts.length
        });

    } catch (error) {
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
});
