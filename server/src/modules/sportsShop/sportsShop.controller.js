
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProductStock,
  processCheckout,
  getUserPurchases,
  getAllPurchases,
  cancelPurchase,
  updateOrderStatus,
  getLowStockAlerts,
  restockProduct,
} from "./sportsShop.service.js";
import {
  createStringingRequest,
  getAllStringingRequests,
  getStringingById,
  updateStringingStatus,
} from "./stringing.service.js";

// 1. Get all products
export const getProducts = async (req, res) => {
  try {
    const { category } = req.query;

    const products = await getAllProducts(category);

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// 2. Get product by ID
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

// 3. Create product
export const addProduct = async (req, res) => {
  try {
    const product = await createProduct(req.body);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

// 4. Update stock quantity
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { inStock } = req.body;

    const updatedProduct = await updateProductStock(id, inStock);

    return res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating stock:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update stock",
    });
  }
};

// 5. Checkout / Place order
export const checkout = async (req, res) => {
  try {
    const order = await processCheckout(req.body);

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
      walletBalance: order.walletBalance,
    });
  } catch (error) {
    console.error("Error processing checkout:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to process checkout",
    });
  }
};

// 6. Get order history for a member
export const getMemberOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await getUserPurchases(userId);

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};

// 7. Get all orders (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await getAllPurchases();

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching all orders:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

// 8. Cancel an order
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const cancelledOrder = await cancelPurchase(id, userId);

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully and stock restored",
      data: cancelledOrder,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel order",
    });
  }
};

// 9. Update Order Fulfillment Status (Staff / Admin)
// PATCH /api/shop/orders/:id/status or /api/shop/orders/:id/fulfill
export const updateOrderStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pickupCode, trackingNotes } = req.body;

    const result = await updateOrderStatus({
      purchaseId: id,
      status,
      pickupCode,
      trackingNotes,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// 10. Proactive Low-Stock Reorder Alerts (Scene 3)
// GET /api/shop/inventory/low-stock
export const getLowStockAlertsHandler = async (req, res) => {
  try {
    const { threshold } = req.query;
    const alerts = await getLowStockAlerts(threshold);

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error("Get low stock alerts error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 11. Quick Restock Inventory (Shop / Inventory Manager)
// POST /api/shop/products/:id/restock or POST /api/shop/inventory/restock
export const restockProductHandler = async (req, res) => {
  try {
    const productId = req.params.id || req.body.productId;
    const { quantity, supplierNotes } = req.body;

    const result = await restockProduct({
      productId,
      quantity,
      supplierNotes,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Restock product error:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// 12. Submit Racket Stringing / Equipment Service Request
// POST /api/shop/stringing
export const createStringingHandler = async (req, res) => {
  try {
    const userID = req.body.userID || req.user?.id;
    const {
      racketModel,
      sport,
      stringName,
      tensionLbs,
      urgency,
      notes,
      paymentMethod,
      customPrice,
    } = req.body;

    const result = await createStringingRequest({
      userID,
      racketModel,
      sport,
      stringName,
      tensionLbs,
      urgency,
      notes,
      paymentMethod,
      customPrice,
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Create stringing request error:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// 13. List Stringing Requests
// GET /api/shop/stringing
export const getAllStringingHandler = async (req, res) => {
  try {
    const { status, urgency, sport, userID, page, limit } = req.query;

    const result = await getAllStringingRequests({
      status,
      urgency,
      sport,
      userID,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get all stringing requests error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 14. Get Stringing Job Card Details
// GET /api/shop/stringing/:id
export const getStringingByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const jobCard = await getStringingById(id);

    return res.status(200).json({
      success: true,
      data: jobCard,
    });
  } catch (error) {
    console.error("Get stringing by ID error:", error);
    return res.status(error.statusCode || 404).json({
      success: false,
      message: error.message,
    });
  }
};

// 15. Update Stringing Status (Stringer Staff / Pro Shop)
// PATCH /api/shop/stringing/:id/status
export const updateStringingStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, stringerStaffId, notes } = req.body;

    const result = await updateStringingStatus({
      id,
      status,
      stringerStaffId,
      notes,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update stringing status error:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};
