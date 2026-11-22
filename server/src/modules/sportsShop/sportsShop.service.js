
import prisma from "../../config/prisma.js";
import { sendEmail } from "../../common/utils/mailer.js";

// 1. Get all products
export const getAllProducts = async (category) => {
  const products = await prisma.product.findMany({
    where: category
      ? {
          category: {
            equals: category.trim(),
            mode: "insensitive",
          },
        }
      : undefined,
  });

  return products.map((product) => ({
    ...product,
    isLowStock: product.inStock <= 5,
  }));
};

// 2. Get product by ID
export const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    return null;
  }

  return {
    ...product,
    isLowStock: product.inStock <= 5,
  };
};

// 3. Create a product
export const createProduct = async (productData) => {
  const { name, category, buyPrice, rentPrice, size, inStock } = productData;

  if (!name || !category || buyPrice === undefined || buyPrice === null) {
    throw new Error("Name, category, and buyPrice are required");
  }

  if (Number(buyPrice) < 0) {
    throw new Error("buyPrice cannot be negative");
  }

  if (inStock !== undefined && Number(inStock) < 0) {
    throw new Error("inStock cannot be negative");
  }

  const newProduct = await prisma.product.create({
    data: {
      name: name.trim(),
      category: category.trim(),
      buyPrice: Number(buyPrice),
      rentPrice: rentPrice !== undefined && rentPrice !== null ? Number(rentPrice) : null,
      size: size ? size.trim() : null,
      inStock: inStock !== undefined ? parseInt(inStock, 10) : 0,
    },
  });

  return {
    ...newProduct,
    isLowStock: newProduct.inStock <= 5,
  };
};

// 4. Update product stock (for admin inventory management)
export const updateProductStock = async (id, inStock) => {
  if (inStock === undefined || inStock === null || parseInt(inStock, 10) < 0) {
    throw new Error("Valid non-negative inStock quantity is required");
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      inStock: parseInt(inStock, 10),
    },
  });

  return {
    ...updatedProduct,
    isLowStock: updatedProduct.inStock <= 5,
  };
};

// 5. Member Checkout & Purchase
export const processCheckout = async (checkoutData) => {
  const { userID, items, fulfillmentType, paymentMethod } = checkoutData;

  if (!userID) {
    throw new Error("User ID is required to process checkout");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Cart must contain at least one item");
  }

  // A. Fetch member details from User table
  const user = await prisma.user.findUnique({
    where: { id: userID },
  });

  if (!user) {
    throw new Error("Member not found");
  }

  // B. Calculate member discount rate
  const isExpired = user.renewalDate ? new Date(user.renewalDate) < new Date() : false;
  let discountRate = 0;

  if (!isExpired) {
    if (user.membership === "GOLD") {
      discountRate = 0.30;
    } else if (user.membership === "SILVER") {
      discountRate = 0.15;
    }else if (user.membership === "JUNIOR") {
        discountRate = 0.11;
    }
  }

  // C. Fetch all requested products and verify stock
  const productIds = items.map((item) => item.productID);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const validatedLineItems = [];

  for (const item of items) {
    const product = productMap.get(item.productID);

    if (!product) {
      throw new Error(`Product not found with ID: ${item.productID}`);
    }

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid quantity for product "${product.name}"`);
    }

    if (product.inStock < qty) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${product.inStock}, Requested: ${qty}`
      );
    }

    const unitPrice = Number(product.buyPrice);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    validatedLineItems.push({
      productID: product.id,
      name: product.name,
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
    });
  }

  const discountAmount = Math.round(subtotal * discountRate * 100) / 100;
  const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

  // Check virtual card balance if chosen
  const currentBalance = Number(user.amount || 0);
  if (paymentMethod === "VIRTUAL_CARD" && currentBalance < finalTotal) {
    const error = new Error(
      `Insufficient wallet balance (₹${currentBalance.toFixed(2)}). Order total is ₹${finalTotal.toFixed(2)}. Please top up your wallet.`
    );
    error.statusCode = 400;
    throw error;
  }

  const summaryStrings = validatedLineItems.map(
    (item) => `${item.name} x ${item.quantity}`
  );

  // D. Atomic Database Transaction: Deduct stock + deduct wallet (if VIRTUAL_CARD) + create purchase + create line items
  const result = await prisma.$transaction(async (tx) => {
    let balanceAfter = currentBalance;

    if (paymentMethod === "VIRTUAL_CARD") {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          amount: { decrement: finalTotal },
        },
      });
      balanceAfter = Number(updatedUser.amount);

      await tx.walletTransaction.create({
        data: {
          userID: user.id,
          phone: user.phone,
          type: "DEBIT",
          amount: finalTotal,
          balanceAfter,
          paymentMethod: "VIRTUAL_CARD",
          module: "SHOP",
          description: `Champions Club Pro Shop Purchase (${summaryStrings.join(", ")})`,
        },
      });
    }

    // 1. Decrement stock for every product in the cart
    for (const item of validatedLineItems) {
      await tx.product.update({
        where: { id: item.productID },
        data: {
          inStock: {
            decrement: item.quantity,
          },
        },
      });
    }

    // 2. Generate pickup verification code for Click & Collect
    const isDelivery = fulfillmentType === "DELIVERY";
    const pickupCode = isDelivery ? null : String(Math.floor(1000 + Math.random() * 9000));
    const deliveryAddress = isDelivery ? (checkoutData.deliveryAddress || "Member registered address") : null;

    // 3. Create the purchase record and line items
    const createdPurchase = await tx.sportShopPurchase.create({
      data: {
        userID: user.id,
        name: user.name,
        phone: user.phone,
        items: summaryStrings,
        status: "ORDER_PLACED",
        fulfillmentType: isDelivery ? "DELIVERY" : "PICKUP",
        pickupCode,
        deliveryAddress,
        discount: discountAmount,
        totalAmount: finalTotal,
        orderItems: {
          create: validatedLineItems.map((item) => ({
            productID: item.productID,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return { purchase: createdPurchase, balanceAfter };
  });

  const purchase = result.purchase;

  // Send purchase confirmation email
  await sendEmail({
    to: user.email,
    subject: `Order Confirmation: Champions Club Pro Shop (₹${purchase.totalAmount})`,
    text: `Hello ${user.name},\n\nYour sports shop order has been placed successfully!\n\nOrder ID: ${purchase.id}\nFulfillment: ${purchase.fulfillmentType}\n${purchase.pickupCode ? `Pickup PIN: ${purchase.pickupCode}\n` : ""}${purchase.deliveryAddress ? `Delivery Address: ${purchase.deliveryAddress}\n` : ""}Total Paid: ₹${purchase.totalAmount}\n\nThank you,\nChampions Club Pro Shop`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f766e; color: #ffffff; padding: 18px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Pro Shop Order Placed</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>Thank you for ordering with the Champions Club Pro Shop.</p>
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Order ID:</strong> ${purchase.id}</p>
            <p style="margin: 4px 0;"><strong>Fulfillment Mode:</strong> ${purchase.fulfillmentType}</p>
            ${purchase.pickupCode ? `<p style="margin: 4px 0; font-size: 18px; color: #0f766e;"><strong>Counter Pickup PIN: ${purchase.pickupCode}</strong></p>` : ""}
            ${purchase.deliveryAddress ? `<p style="margin: 4px 0;"><strong>Delivery Destination:</strong> ${purchase.deliveryAddress}</p>` : ""}
            <p style="margin: 4px 0;"><strong>Final Amount:</strong> ₹${purchase.totalAmount.toFixed(2)}</p>
          </div>
          <p>We will notify you as soon as your order is packed!</p>
        </div>
      </div>
    `,
  });

  return {
    ...purchase,
    subtotal,
    appliedDiscountPercentage: discountRate * 100,
    walletBalance: result.balanceAfter,
  };
};

// 6. Get member order history
export const getUserPurchases = async (userID) => {
  return await prisma.sportShopPurchase.findMany({
    where: { userID },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      purchaseDate: "desc",
    },
  });
};

// 7. Get all shop orders (Admin Dashboard)
export const getAllPurchases = async () => {
  return await prisma.sportShopPurchase.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          membership: true,
        },
      },
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      purchaseDate: "desc",
    },
  });
};

// 8. Cancel an order (Before READY status) and restore stock
export const cancelPurchase = async (orderID, userID) => {
  const order = await prisma.sportShopPurchase.findUnique({
    where: { id: orderID },
    include: {
      orderItems: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Ensure security: only order owner or admin can cancel
  if (userID && order.userID !== userID) {
    throw new Error("Unauthorized to cancel this order");
  }

  if (order.status === "CANCELLED") {
    throw new Error("Order is already cancelled");
  }

  if (order.status !== "PENDING") {
    throw new Error(`Cannot cancel order once status is "${order.status}". Only PENDING orders can be cancelled.`);
  }

  // Atomic transaction to restore stock and update status
  return await prisma.$transaction(async (tx) => {
    // 1. Restore stock to product table
    for (const item of order.orderItems) {
      await tx.product.update({
        where: { id: item.productID },
        data: {
          inStock: {
            increment: item.quantity,
          },
        },
      });
    }

    // 2. Mark order as CANCELLED
    return await tx.sportShopPurchase.update({
      where: { id: orderID },
      data: {
        status: "CANCELLED",
      },
      include: {
        orderItems: true,
      },
    });
  });
};

// 9. Update Order Fulfillment Status (Staff / Admin)
// Pipeline: ORDER_PLACED -> PACKED -> READY_FOR_PICKUP / OUT_FOR_DELIVERY -> COMPLETED
export const updateOrderStatus = async ({ purchaseId, status, pickupCode, trackingNotes }) => {
  const purchase = await prisma.sportShopPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      user: true,
      orderItems: { include: { product: true } },
    },
  });

  if (!purchase) {
    const error = new Error(`Order with ID '${purchaseId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const validStatuses = [
    "PENDING",
    "ORDER_PLACED",
    "PACKED",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ];
  const targetStatus = (status || "").toUpperCase();
  if (!validStatuses.includes(targetStatus)) {
    const error = new Error(`Invalid status '${status}'. Allowed: ${validStatuses.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  // If customer is picking up order at counter and status is being marked COMPLETED:
  if (targetStatus === "COMPLETED" && purchase.fulfillmentType === "PICKUP" && purchase.pickupCode) {
    if (pickupCode && String(pickupCode).trim() !== String(purchase.pickupCode).trim()) {
      const error = new Error(
        `Invalid pickup verification code '${pickupCode}'. Customer must present the 4-digit PIN provided on their order receipt.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const updateData = {
    status: targetStatus,
  };

  if (trackingNotes) {
    updateData.trackingNotes = purchase.trackingNotes
      ? `${purchase.trackingNotes} | ${trackingNotes}`
      : trackingNotes;
  }

  if (targetStatus === "COMPLETED") {
    updateData.fulfilledAt = new Date();
  }

  const updated = await prisma.sportShopPurchase.update({
    where: { id: purchaseId },
    data: updateData,
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      orderItems: { include: { product: true } },
    },
  });

  // Automated email alert when READY_FOR_PICKUP or OUT_FOR_DELIVERY
  if (targetStatus === "READY_FOR_PICKUP") {
    await sendEmail({
      to: purchase.user.email,
      subject: `🛍️ Your Pro Shop Order is Ready for Pickup! (PIN: ${purchase.pickupCode})`,
      text: `Hello ${purchase.user.name},\n\nYour order #${purchase.id} is packed and ready for collection at the Champions Club Pro Shop counter!\n\nPickup PIN: ${purchase.pickupCode}\n\nPlease present this PIN at the counter to collect your items.\n\nChampions Club Pro Shop`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f766e; color: #ffffff; padding: 18px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">🛍️ Order Ready for Pickup!</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear <strong>${purchase.user.name}</strong>,</p>
            <p>Your items have been packed and are waiting for you at the Champions Club Pro Shop counter.</p>
            <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">Present this code at the counter:</p>
              <h1 style="margin: 8px 0; font-size: 32px; letter-spacing: 4px; color: #0f766e;">${purchase.pickupCode}</h1>
            </div>
            <p>Order ID: ${purchase.id}</p>
          </div>
        </div>
      `,
    });
  } else if (targetStatus === "OUT_FOR_DELIVERY") {
    await sendEmail({
      to: purchase.user.email,
      subject: `🚚 Your Pro Shop Order is Out for Delivery!`,
      text: `Hello ${purchase.user.name},\n\nYour order #${purchase.id} is on its way to ${purchase.deliveryAddress}!\n\nChampions Club Pro Shop`,
    });
  }

  return {
    message: `Order status updated to ${targetStatus}.`,
    order: updated,
  };
};

// 10. Proactive Low-Stock Reorder Alerts (Scene 3)
// "The club sells rackets, balls, shoes... and should always know what is in stock and when something is running low."
export const getLowStockAlerts = async (threshold) => {
  const products = await prisma.product.findMany({
    orderBy: { inStock: "asc" },
  });

  const lowStockItems = [];

  for (const p of products) {
    const limit = threshold !== undefined ? parseInt(threshold, 10) : p.minStockThreshold;
    if (p.inStock <= limit) {
      const isCritical = p.inStock <= 2;
      lowStockItems.push({
        id: p.id,
        name: p.name,
        category: p.category,
        inStock: p.inStock,
        minStockThreshold: p.minStockThreshold,
        alertLevel: isCritical ? "CRITICAL" : "LOW",
        suggestedReorderQuantity: Math.max(10, (p.minStockThreshold * 3) - p.inStock),
        actionRequired: isCritical ? "Immediate Restock Required" : "Reorder Recommended",
      });
    }
  }

  return {
    thresholdApplied: threshold || "per-product threshold (default 5)",
    totalLowStockCount: lowStockItems.length,
    criticalCount: lowStockItems.filter((i) => i.alertLevel === "CRITICAL").length,
    lowStockItems,
  };
};

// 11. Quick Restock Inventory (Shop / Inventory Manager)
export const restockProduct = async ({ productId, quantity, supplierNotes }) => {
  const addQty = parseInt(quantity, 10);
  if (isNaN(addQty) || addQty <= 0) {
    const error = new Error("Restock quantity must be a positive integer.");
    error.statusCode = 400;
    throw error;
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    const error = new Error(`Product with ID '${productId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      inStock: {
        increment: addQty,
      },
    },
  });

  return {
    message: `Successfully restocked ${addQty} unit(s) of "${product.name}".`,
    previousStock: product.inStock,
    newStock: updatedProduct.inStock,
    product: updatedProduct,
    supplierNotes: supplierNotes || null,
  };
};
