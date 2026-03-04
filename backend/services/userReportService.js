const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Order = require('../models/Order');

const REPORT_DIR = path.join(__dirname, '..', 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'users_report.xlsx');

// Header style shared across sheets
const HEADER_STYLE = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D7D46' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
    },
};

/**
 * Generate (or regenerate) the users_report.xlsx file.
 * Returns the absolute path to the generated file.
 */
async function generateUserReport() {
    // Ensure reports directory exists
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    // ── Fetch data ──────────────────────────────────────────────
    const users = await User.find({}).select('-password').lean();
    const shops = await Shop.find({}).lean();
    const orders = await Order.find({}).lean();

    // Build lookup maps
    const shopByOwner = {};
    for (const shop of shops) {
        shopByOwner[shop.ownerId.toString()] = shop;
    }

    // Count orders per buyer
    const orderCountByBuyer = {};
    const orderAmountByBuyer = {};
    for (const order of orders) {
        const bid = order.buyerId.toString();
        orderCountByBuyer[bid] = (orderCountByBuyer[bid] || 0) + 1;
        orderAmountByBuyer[bid] = (orderAmountByBuyer[bid] || 0) + order.totalAmount;
    }

    const buyers = users.filter((u) => u.role === 'buyer');
    const sellers = users.filter((u) => u.role === 'seller');

    // ── Build workbook ──────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smarter BlinkIt';
    workbook.created = new Date();

    // ── Buyers sheet ────────────────────────────────────────────
    const buyerSheet = workbook.addWorksheet('Buyers', {
        properties: { tabColor: { argb: 'FF4CAF50' } },
    });

    buyerSheet.columns = [
        { header: '#', key: 'sno', width: 6 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Address', key: 'address', width: 35 },
        { header: 'Face ID Enrolled', key: 'faceId', width: 18 },
        { header: 'Total Orders', key: 'totalOrders', width: 14 },
        { header: 'Total Spent (₹)', key: 'totalSpent', width: 16 },
        { header: 'Account Status', key: 'status', width: 16 },
        { header: 'Account Created', key: 'createdAt', width: 22 },
        { header: 'Last Updated', key: 'updatedAt', width: 22 },
    ];

    // Apply header style
    buyerSheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, HEADER_STYLE);
    });
    buyerSheet.getRow(1).height = 24;

    buyers.forEach((buyer, i) => {
        const uid = buyer._id.toString();
        buyerSheet.addRow({
            sno: i + 1,
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone || '—',
            address: buyer.location?.address || '—',
            faceId: buyer.faceDescriptor && buyer.faceDescriptor.length > 0 ? 'Yes' : 'No',
            totalOrders: orderCountByBuyer[uid] || 0,
            totalSpent: orderAmountByBuyer[uid] ? `₹${orderAmountByBuyer[uid].toFixed(2)}` : '₹0.00',
            status: buyer.isActive ? 'Active' : 'Inactive',
            createdAt: buyer.createdAt ? new Date(buyer.createdAt).toLocaleString('en-IN') : '—',
            updatedAt: buyer.updatedAt ? new Date(buyer.updatedAt).toLocaleString('en-IN') : '—',
        });
    });

    // Alternate row shading for Buyers
    buyerSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
            });
        }
    });

    // ── Sellers sheet ───────────────────────────────────────────
    const sellerSheet = workbook.addWorksheet('Sellers', {
        properties: { tabColor: { argb: 'FF2196F3' } },
    });

    sellerSheet.columns = [
        { header: '#', key: 'sno', width: 6 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phone', width: 16 },
        { header: 'Shop Name', key: 'shopName', width: 24 },
        { header: 'Shop Category', key: 'shopCategory', width: 18 },
        { header: 'Shop Address', key: 'shopAddress', width: 35 },
        { header: 'Shop Verified', key: 'shopVerified', width: 15 },
        { header: 'Shop Open', key: 'shopOpen', width: 12 },
        { header: 'Shop Rating', key: 'shopRating', width: 13 },
        { header: 'Total Shop Orders', key: 'totalShopOrders', width: 18 },
        { header: 'Face ID Enrolled', key: 'faceId', width: 18 },
        { header: 'Account Status', key: 'status', width: 16 },
        { header: 'Account Created', key: 'createdAt', width: 22 },
        { header: 'Last Updated', key: 'updatedAt', width: 22 },
    ];

    sellerSheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, HEADER_STYLE);
    });
    sellerSheet.getRow(1).height = 24;

    sellers.forEach((seller, i) => {
        const shop = shopByOwner[seller._id.toString()];
        sellerSheet.addRow({
            sno: i + 1,
            name: seller.name,
            email: seller.email,
            phone: seller.phone || '—',
            shopName: shop?.name || '—',
            shopCategory: shop?.category || '—',
            shopAddress: shop?.location?.address || '—',
            shopVerified: shop?.isVerified ? 'Yes' : 'No',
            shopOpen: shop?.isOpen ? 'Yes' : 'No',
            shopRating: shop?.rating ?? '—',
            totalShopOrders: shop?.totalOrders ?? 0,
            faceId: seller.faceDescriptor && seller.faceDescriptor.length > 0 ? 'Yes' : 'No',
            status: seller.isActive ? 'Active' : 'Inactive',
            createdAt: seller.createdAt ? new Date(seller.createdAt).toLocaleString('en-IN') : '—',
            updatedAt: seller.updatedAt ? new Date(seller.updatedAt).toLocaleString('en-IN') : '—',
        });
    });

    // Alternate row shading for Sellers
    sellerSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
            });
        }
    });

    // ── Summary sheet ───────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Summary', {
        properties: { tabColor: { argb: 'FFFF9800' } },
    });

    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, HEADER_STYLE);
    });
    summarySheet.getRow(1).height = 24;

    const faceEnrolledCount = users.filter((u) => u.faceDescriptor && u.faceDescriptor.length > 0).length;

    summarySheet.addRows([
        { metric: 'Total Users', value: users.length },
        { metric: 'Total Buyers', value: buyers.length },
        { metric: 'Total Sellers', value: sellers.length },
        { metric: 'Face ID Enrolled Users', value: faceEnrolledCount },
        { metric: 'Total Shops', value: shops.length },
        { metric: 'Total Orders', value: orders.length },
        { metric: 'Report Generated At', value: new Date().toLocaleString('en-IN') },
    ]);

    // ── Write file ──────────────────────────────────────────────
    await workbook.xlsx.writeFile(REPORT_PATH);
    console.log(`📊 User report generated → ${REPORT_PATH}`);
    return REPORT_PATH;
}

module.exports = { generateUserReport, REPORT_PATH };
