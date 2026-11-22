import prisma from "../../config/prisma.js";
import { sendEmail } from "../../common/utils/mailer.js";

/**
 * 1. Submit a Racket Stringing or Equipment Service Request (PRD Scene 3).
 * "A member's racket string snaps ten minutes before play..."
 *
 * @param {Object} params
 * @param {string} params.userID - Member UUID
 * @param {string} params.racketModel - e.g. "Yonex Astrox 88D Pro"
 * @param {'BADMINTON' | 'TENNIS' | 'PADEL_COURT' | 'CRICKET'} [params.sport='BADMINTON']
 * @param {string} params.stringName - e.g. "Yonex BG65 Ti"
 * @param {number} params.tensionLbs - e.g. 26.5
 * @param {'STANDARD' | 'EMERGENCY_EXPRESS'} [params.urgency='STANDARD']
 * @param {string} [params.notes] - Specific pattern or instructions
 * @param {'VIRTUAL_CARD' | 'UPI' | 'CARD' | 'CASH'} [params.paymentMethod='VIRTUAL_CARD']
 * @param {number} [params.customPrice]
 */
export const createStringingRequest = async ({
  userID,
  racketModel,
  sport = "BADMINTON",
  stringName,
  tensionLbs,
  urgency = "STANDARD",
  notes,
  paymentMethod = "VIRTUAL_CARD",
  customPrice,
}) => {
  if (!userID) {
    const error = new Error("User ID is required to log a stringing service request.");
    error.statusCode = 400;
    throw error;
  }

  if (!racketModel || !racketModel.trim()) {
    const error = new Error("Racket model is required (e.g. Yonex Astrox 88D Pro).");
    error.statusCode = 400;
    throw error;
  }

  if (!stringName || !stringName.trim()) {
    const error = new Error("String name/brand is required (e.g. Yonex BG65).");
    error.statusCode = 400;
    throw error;
  }

  const tension = Number(tensionLbs);
  if (isNaN(tension) || tension < 15 || tension > 70) {
    const error = new Error("Tension must be between 15 lbs and 70 lbs.");
    error.statusCode = 400;
    throw error;
  }

  const validUrgencies = ["STANDARD", "EMERGENCY_EXPRESS"];
  const normalizedUrgency = (urgency || "STANDARD").toUpperCase();
  if (!validUrgencies.includes(normalizedUrgency)) {
    const error = new Error(`Invalid urgency. Allowed: ${validUrgencies.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userID },
  });

  if (!user) {
    const error = new Error(`Member with ID '${userID}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Calculate pricing & turnaround
  // Emergency Express: 15-20 min turnaround (₹550), Standard: next day (₹350)
  const isEmergency = normalizedUrgency === "EMERGENCY_EXPRESS";
  const defaultPrice = isEmergency ? 550 : 350;
  const price = customPrice !== undefined && Number(customPrice) >= 0 ? Number(customPrice) : defaultPrice;

  const now = new Date();
  const estimatedReady = isEmergency
    ? new Date(now.getTime() + 20 * 60 * 1000) // 20 minutes for emergency court-side stringing
    : new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours standard

  const validPaymentMethods = ["VIRTUAL_CARD", "UPI", "CARD", "CASH", "ONLINE"];
  const method = (paymentMethod || "VIRTUAL_CARD").toUpperCase();
  if (!validPaymentMethods.includes(method)) {
    const error = new Error(`Invalid payment method. Allowed: ${validPaymentMethods.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  // Handle Virtual Card cardless debit if chosen
  let walletTransaction = null;
  if (method === "VIRTUAL_CARD") {
    const currentBalance = Number(user.amount);
    if (currentBalance < price) {
      const error = new Error(
        `Insufficient virtual card balance. Service fee: ₹${price.toFixed(2)}, Available: ₹${currentBalance.toFixed(2)}. Please top up your virtual card.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Atomic database transaction: debit balance + record stringing job card
  const result = await prisma.$transaction(async (tx) => {
    let balanceAfter = Number(user.amount);

    if (method === "VIRTUAL_CARD") {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          amount: { decrement: price },
        },
      });
      balanceAfter = Number(updatedUser.amount);

      walletTransaction = await tx.walletTransaction.create({
        data: {
          userID: user.id,
          phone: user.phone,
          type: "DEBIT",
          amount: price,
          balanceAfter,
          paymentMethod: "VIRTUAL_CARD",
          module: "SHOP",
          description: `${isEmergency ? "Emergency 15-min" : "Standard"} Racket Stringing (${racketModel})`,
        },
      });
    }

    const jobCard = await tx.racketStringing.create({
      data: {
        userID: user.id,
        racketModel: racketModel.trim(),
        sport: sport.toUpperCase() === "TENNIS" ? "TENNIS" : "BADMINTON",
        stringName: stringName.trim(),
        tensionLbs: tension,
        urgency: normalizedUrgency,
        price,
        paymentMethod: method,
        paymentStatus: "PAID",
        status: "RECEIVED",
        notes: notes ? notes.trim() : null,
        estimatedReady,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            membership: true,
          },
        },
      },
    });

    return { jobCard, walletTransaction, balanceAfter };
  });

  // Send confirmation email to member
  await sendEmail({
    to: user.email,
    subject: `${isEmergency ? "⚡ EMERGENCY " : ""}Racket Stringing Job Card: ${racketModel} (${tension} lbs)`,
    text: `Hello ${user.name},\n\nYour racket stringing service request for ${racketModel} has been logged at the Champions Club Pro Shop.\n\nTension: ${tension} lbs\nString: ${stringName}\nUrgency: ${normalizedUrgency}\nEstimated Ready: ${estimatedReady.toLocaleTimeString()}\nFee: ₹${price} (${method})\n\nWe will notify you immediately once your racket is strung and ready for pickup!\n\nChampions Club Pro Shop`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${isEmergency ? "#b91c1c" : "#0f766e"}; color: #ffffff; padding: 18px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">${isEmergency ? "⚡ Emergency Express" : "Standard"} Racket Stringing Job Card</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>Your racket has been received at the Champions Club Pro Shop.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px; font-weight: bold;">Job Card ID:</td><td>${result.jobCard.id}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Racket:</td><td>${racketModel}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">String:</td><td>${stringName}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Tension:</td><td><strong>${tension} lbs</strong></td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Urgency:</td><td><span style="background-color: ${isEmergency ? "#fee2e2" : "#ccfbf1"}; color: ${isEmergency ? "#991b1b" : "#0f766e"}; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${normalizedUrgency}</span></td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Estimated Ready:</td><td><strong>${estimatedReady.toLocaleString()}</strong></td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Service Fee:</td><td>₹${price.toFixed(2)} (${method})</td></tr>
          </table>
          <p>Our professional stringer will take care of your racket. You will receive an immediate notification as soon as it is strung and ready at the counter.</p>
        </div>
      </div>
    `,
  });

  return {
    message: isEmergency
      ? "Emergency express stringing job card created! Estimated turnaround: 15-20 minutes."
      : "Standard racket stringing request logged successfully.",
    jobCard: result.jobCard,
    walletTransaction: result.walletTransaction,
    walletBalance: result.balanceAfter,
  };
};

/**
 * 2. Get All Stringing Requests with Filters & Pagination.
 */
export const getAllStringingRequests = async ({
  status,
  urgency,
  sport,
  userID,
  page = 1,
  limit = 20,
} = {}) => {
  const where = {};
  if (status) where.status = status.toUpperCase();
  if (urgency) where.urgency = urgency.toUpperCase();
  if (sport) where.sport = sport.toUpperCase();
  if (userID) where.userID = userID;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * take;

  const [requests, total] = await Promise.all([
    prisma.racketStringing.findMany({
      where,
      skip,
      take,
      orderBy: [
        { urgency: "desc" }, // Emergency express requests listed first!
        { receivedAt: "desc" },
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            membership: true,
          },
        },
        stringerStaff: {
          select: {
            id: true,
            name: true,
            role: true,
            phone: true,
          },
        },
      },
    }),
    prisma.racketStringing.count({ where }),
  ]);

  return {
    requests,
    pagination: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
};

/**
 * 3. Get Single Stringing Request by ID.
 */
export const getStringingById = async (id) => {
  const request = await prisma.racketStringing.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          membership: true,
        },
      },
      stringerStaff: {
        select: {
          id: true,
          name: true,
          role: true,
          designation: true,
        },
      },
    },
  });

  if (!request) {
    const error = new Error(`Stringing request with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return request;
};

/**
 * 4. Update Stringing Job Status (Stringer / Shop Staff).
 * Lifecycle: RECEIVED -> IN_PROGRESS -> READY_FOR_PICKUP -> COLLECTED.
 *
 * @param {Object} params
 * @param {string} params.id - Stringing Job ID
 * @param {'IN_PROGRESS' | 'READY_FOR_PICKUP' | 'COLLECTED' | 'CANCELLED'} params.status
 * @param {string} [params.stringerStaffId] - Staff member executing the stringing
 * @param {string} [params.notes]
 */
export const updateStringingStatus = async ({ id, status, stringerStaffId, notes }) => {
  const existing = await prisma.racketStringing.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing) {
    const error = new Error(`Stringing request with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const validStatuses = ["RECEIVED", "IN_PROGRESS", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"];
  const targetStatus = (status || "").toUpperCase();
  if (!validStatuses.includes(targetStatus)) {
    const error = new Error(`Invalid status '${status}'. Allowed: ${validStatuses.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const updateData = {
    status: targetStatus,
  };

  if (notes) {
    updateData.notes = existing.notes ? `${existing.notes} | ${notes}` : notes;
  }

  if (stringerStaffId) {
    updateData.stringerStaffId = stringerStaffId;
  }

  if (targetStatus === "READY_FOR_PICKUP") {
    updateData.completedAt = new Date();
  } else if (targetStatus === "COLLECTED") {
    updateData.collectedAt = new Date();
  }

  const updated = await prisma.racketStringing.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      stringerStaff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  // Automated notification when racket is READY_FOR_PICKUP
  if (targetStatus === "READY_FOR_PICKUP") {
    await sendEmail({
      to: existing.user.email,
      subject: `🎾 Your Racket is Ready for Pickup: ${existing.racketModel}`,
      text: `Hello ${existing.user.name},\n\nGreat news! Your racket (${existing.racketModel}) has been strung at ${existing.tensionLbs} lbs with ${existing.stringName} and is now READY FOR PICKUP at the Pro Shop counter.\n\nEnjoy your game!\n\nChampions Club Pro Shop`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #15803d; color: #ffffff; padding: 18px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">🎾 Your Racket is Ready for Pickup!</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear <strong>${existing.user.name}</strong>,</p>
            <p>Your racket stringing service is complete and ready for pickup at the Pro Shop counter.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Racket:</strong> ${existing.racketModel}</p>
              <p style="margin: 4px 0;"><strong>String:</strong> ${existing.stringName}</p>
              <p style="margin: 4px 0;"><strong>Tension:</strong> ${existing.tensionLbs} lbs</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> <span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: bold;">READY FOR PICKUP</span></p>
            </div>
            <p>Please present your phone number at the counter to collect your racket before your match.</p>
          </div>
        </div>
      `,
    });
  }

  return {
    message: `Stringing job status updated to ${targetStatus}.`,
    jobCard: updated,
  };
};
