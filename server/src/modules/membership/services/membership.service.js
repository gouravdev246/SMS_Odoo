import prisma from "../../../config/prisma.js";
import { sendEmail } from "../../../common/utils/mailer.js";
import { addReminderJob, setReminderProcessor } from "../queues/membership-reminder.queue.js";

/**
 * Format a Date object into a readable date string.
 */
export const formatDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

/**
 * Calculate the number of days remaining until a renewal date.
 */
export const calculateDaysRemaining = (renewalDate, referenceDate = new Date()) => {
  if (!renewalDate) return 0;
  const renewal = new Date(renewalDate).getTime();
  const current = new Date(referenceDate).getTime();
  const diffMs = renewal - current;
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

/**
 * Find all users whose membership is expiring within the specified days (default: 2 days)
 * and who haven't already received an expiry reminder within the last 24 hours.
 */
export const findUsersExpiringSoon = async (daysPending = 2) => {
  const now = new Date();
  const targetExpiryWindow = new Date(now.getTime() + daysPending * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find users with renewalDate within [now, targetExpiryWindow]
  const expiringUsers = await prisma.user.findMany({
    where: {
      renewalDate: {
        gte: now,
        lte: targetExpiryWindow,
      },
      // Avoid sending duplicate reminders on the same day
      OR: [
        { lastReminderSent: null },
        { lastReminderSent: { lt: oneDayAgo } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      membership: true,
      renewalDate: true,
      amount: true,
      lastReminderSent: true,
    },
  });

  return expiringUsers.map((user) => ({
    ...user,
    daysRemaining: calculateDaysRemaining(user.renewalDate, now),
  }));
};

/**
 * Send an email notification reminding the user that their membership will expire soon.
 * Updates the user's `lastReminderSent` timestamp in the database after dispatching.
 */
export const sendMembershipExpiryEmail = async (jobData) => {
  const { userId, name, email, membership, renewalDate, daysRemaining } = jobData;

  const formattedDate = formatDateString(renewalDate);
  const daysText = daysRemaining <= 1 ? "1 day" : `${daysRemaining} days`;

  const subject = `Action Required: Your SMS Odoo ${membership} Membership Expires in ${daysText}`;

  const text = `Hello ${name},\n\nYour ${membership} membership at SMS Odoo will expire on ${formattedDate} (${daysText} remaining).\n\nPlease renew your membership to continue enjoying court bookings and club privileges.\n\nThank you,\nSMS Odoo Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1e3a8a; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">SMS Odoo - Membership Renewal Reminder</h2>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px;">Dear <strong>${name}</strong>,</p>
        <p>This is a friendly reminder that your <strong>${membership} Membership</strong> is scheduled to expire in <span style="color: #dc2626; font-weight: bold;">${daysText}</span> on <strong>${formattedDate}</strong>.</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Member Name:</strong> ${name}</p>
          <p style="margin: 4px 0;"><strong>Membership Tier:</strong> ${membership}</p>
          <p style="margin: 4px 0;"><strong>Expiry Date:</strong> ${formattedDate}</p>
          <p style="margin: 4px 0;"><strong>Time Remaining:</strong> ${daysText}</p>
        </div>

        <p>To avoid any interruption to your sports court reservations, club facilities, and membership benefits, please renew your membership at your earliest convenience.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="#" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Renew Membership
          </a>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
          If you have already renewed your membership recently, please disregard this notice. For assistance, contact club support.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 12px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        &copy; ${new Date().getFullYear()} SMS Odoo. All rights reserved.
      </div>
    </div>
  `;

  // Send the email via configured mailer
  await sendEmail({ to: email, subject, text, html });

  // Update lastReminderSent timestamp on the user record in database
  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastReminderSent: new Date() },
      });
    } catch (err) {
      console.warn(`Failed to update lastReminderSent for user ${userId}:`, err.message);
    }
  }

  return { success: true, email, userId };
};

/**
 * Scan database for expiring memberships and queue automated reminder emails.
 * Supports configurable days threshold (default: 2 days).
 */
export const processExpiringMemberships = async (daysPending = 2) => {
  const expiringUsers = await findUsersExpiringSoon(daysPending);

  const queuedResults = [];

  for (const user of expiringUsers) {
    const jobData = {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      membership: user.membership,
      renewalDate: user.renewalDate,
      daysRemaining: user.daysRemaining,
    };

    const queueResult = await addReminderJob(jobData);
    queuedResults.push({
      userId: user.id,
      email: user.email,
      daysRemaining: user.daysRemaining,
      queueResult,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    daysThreshold: daysPending,
    totalExpiringFound: expiringUsers.length,
    queuedRemindersCount: queuedResults.length,
    reminders: queuedResults,
  };
};

// Wire the email sender function as the default queue processor
setReminderProcessor(sendMembershipExpiryEmail);

// ============================================================================
// MEMBER SELF-SERVICE: PLANS, STATUS, RENEWAL & UPGRADE
// ============================================================================

export const MEMBERSHIP_PLANS = {
  GOLD: {
    tier: "GOLD",
    name: "Gold All-Access Membership",
    annualFee: 25000,
    renewalFee: 22000,
    courtDiscount: 20,
    shopDiscount: 30,
    cafeDiscount: 20,
    advanceBookingDays: 7,
    benefits: [
      "20% off all Court Bookings (Padel, Tennis, Badminton, Cricket)",
      "30% off Sports Gear & Apparel at Champions Pro Shop",
      "20% off Court-Side Bar & Cafeteria tabs",
      "7-Day advance court slot booking window",
      "Complimentary monthly racket re-gripping",
      "2 Monthly guest passes for friends & family",
    ],
  },
  SILVER: {
    tier: "SILVER",
    name: "Silver Regular Membership",
    annualFee: 15000,
    renewalFee: 13500,
    courtDiscount: 10,
    shopDiscount: 15,
    cafeDiscount: 10,
    advanceBookingDays: 4,
    benefits: [
      "10% off all Court Bookings",
      "15% off Pro Shop equipment and strings",
      "10% off Bar & Cafeteria orders",
      "4-Day advance court slot booking window",
      "Access to club social mixer tournaments",
      "Free locker usage during game sessions",
    ],
  },
  JUNIOR: {
    tier: "JUNIOR",
    name: "Junior Academy Membership",
    annualFee: 8000,
    renewalFee: 7200,
    courtDiscount: 15,
    shopDiscount: 11,
    cafeDiscount: 5,
    advanceBookingDays: 3,
    benefits: [
      "15% off court bookings during junior training hours",
      "11% off junior rackets, footwear, and equipment",
      "Priority registration for certified junior coaching clinics",
      "3-Day advance slot booking window",
      "Dedicated coaching assessment and quarterly progress report",
    ],
  },
};

export const getMembershipPlans = () => {
  return Object.values(MEMBERSHIP_PLANS);
};

export const getMemberMembershipStatus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      membership: true,
      renewalDate: true,
      amount: true,
      lastEntry: true,
    },
  });

  if (!user) {
    const error = new Error(`User with ID '${userId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  let status = "ACTIVE";
  let daysRemaining = 0;

  if (!user.renewalDate) {
    status = user.membership && user.membership !== "NONE" ? "ACTIVE" : "NONE";
  } else {
    const renewal = new Date(user.renewalDate);
    if (renewal < now) {
      status = "EXPIRED";
      daysRemaining = 0;
    } else {
      const diffMs = renewal.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      if (daysRemaining <= 5) {
        status = "EXPIRING_SOON";
      } else {
        status = "ACTIVE";
      }
    }
  }

  const plan = MEMBERSHIP_PLANS[user.membership] || null;

  return {
    user,
    status,
    daysRemaining,
    plan,
    plans: Object.values(MEMBERSHIP_PLANS),
  };
};

export const renewMembership = async ({ userId, paymentMethod = "VIRTUAL_CARD" }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error(`User with ID '${userId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const plan = MEMBERSHIP_PLANS[user.membership] || MEMBERSHIP_PLANS.SILVER;
  const renewalCost = plan.renewalFee || plan.annualFee;

  // If paying via Virtual Card, verify balance and debit
  if (paymentMethod === "VIRTUAL_CARD") {
    const currentBalance = Number(user.amount);
    if (currentBalance < renewalCost) {
      const error = new Error(
        `Insufficient virtual card balance (₹${currentBalance.toFixed(2)}). Renewal fee is ₹${renewalCost}. Please top up your wallet.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const now = new Date();
  let baseDate = now;
  if (user.renewalDate && new Date(user.renewalDate) > now) {
    baseDate = new Date(user.renewalDate);
  }

  // Extend by 365 days
  const newRenewalDate = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  const updatedUser = await prisma.$transaction(async (tx) => {
    let balanceAfter = Number(user.amount);

    if (paymentMethod === "VIRTUAL_CARD") {
      const decremented = await tx.user.update({
        where: { id: user.id },
        data: {
          amount: { decrement: renewalCost },
        },
      });
      balanceAfter = Number(decremented.amount);

      await tx.walletTransaction.create({
        data: {
          userID: user.id,
          phone: user.phone,
          type: "DEBIT",
          amount: renewalCost,
          balanceAfter,
          paymentMethod: "VIRTUAL_CARD",
          module: "MEMBERSHIP",
          description: `1-Year ${user.membership} Membership Renewal Fee`,
        },
      });
    }

    return await tx.user.update({
      where: { id: user.id },
      data: {
        renewalDate: newRenewalDate,
      },
    });
  });

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: `Membership Renewed: 1-Year ${user.membership} Plan Extended!`,
    text: `Hello ${user.name},\n\nYour ${user.membership} membership has been renewed successfully until ${formatDateString(newRenewalDate)}.\n\nThank you for playing with Champions Club!\n\nThe Champions Club Team`,
  });

  return {
    success: true,
    message: `Membership renewed successfully until ${formatDateString(newRenewalDate)}.`,
    newRenewalDate,
    membershipTier: updatedUser.membership,
    walletBalance: Number(updatedUser.amount),
  };
};

export const upgradeMembership = async ({ userId, targetTier, paymentMethod = "VIRTUAL_CARD" }) => {
  const normTier = (targetTier || "").toUpperCase();
  const plan = MEMBERSHIP_PLANS[normTier];

  if (!plan) {
    const error = new Error(`Invalid target tier '${targetTier}'. Allowed: GOLD, SILVER, JUNIOR`);
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error(`User with ID '${userId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  if (user.membership === normTier) {
    const error = new Error(`User already holds a ${normTier} membership.`);
    error.statusCode = 400;
    throw error;
  }

  const currentPlan = MEMBERSHIP_PLANS[user.membership];
  let upgradeCost = plan.annualFee;
  if (currentPlan && plan.annualFee > currentPlan.annualFee) {
    upgradeCost = plan.annualFee - currentPlan.annualFee;
  }

  if (paymentMethod === "VIRTUAL_CARD") {
    const currentBalance = Number(user.amount);
    if (currentBalance < upgradeCost) {
      const error = new Error(
        `Insufficient wallet balance (₹${currentBalance.toFixed(2)}). Upgrade fee is ₹${upgradeCost}. Please top up your wallet.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const newRenewalDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const updatedUser = await prisma.$transaction(async (tx) => {
    let balanceAfter = Number(user.amount);

    if (paymentMethod === "VIRTUAL_CARD") {
      const decremented = await tx.user.update({
        where: { id: user.id },
        data: {
          amount: { decrement: upgradeCost },
        },
      });
      balanceAfter = Number(decremented.amount);

      await tx.walletTransaction.create({
        data: {
          userID: user.id,
          phone: user.phone,
          type: "DEBIT",
          amount: upgradeCost,
          balanceAfter,
          paymentMethod: "VIRTUAL_CARD",
          module: "MEMBERSHIP",
          description: `Membership Tier Upgrade: ${user.membership} to ${normTier}`,
        },
      });
    }

    return await tx.user.update({
      where: { id: user.id },
      data: {
        membership: normTier,
        renewalDate: newRenewalDate,
      },
    });
  });

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: `Congratulations! You've Upgraded to ${normTier} Tier`,
    text: `Hello ${user.name},\n\nYour Champions Club membership has been upgraded to ${normTier}!\n\nNew Expiry Date: ${formatDateString(newRenewalDate)}\n\nEnjoy your increased court, shop, and cafe privileges.\n\nThe Champions Club Team`,
  });

  return {
    success: true,
    message: `Congratulations! Upgraded to ${normTier} membership successfully.`,
    newTier: normTier,
    newRenewalDate,
    walletBalance: Number(updatedUser.amount),
  };
};

/**
 * Direct purchase / subscription to ANY tier (GOLD, SILVER, JUNIOR).
 * Member can select any tier on the frontend and complete self-service purchase.
 * Supports Club Virtual Card wallet balance or Online/UPI payment methods.
 */
export const purchaseMembership = async ({ userId, tier, paymentMethod = "VIRTUAL_CARD" }) => {
  const normTier = (tier || "").toUpperCase();
  const plan = MEMBERSHIP_PLANS[normTier];

  if (!plan) {
    const error = new Error(`Invalid subscription tier '${tier}'. Allowed: GOLD, SILVER, JUNIOR`);
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const error = new Error(`User with ID '${userId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  const currentPlan = MEMBERSHIP_PLANS[user.membership];
  let purchaseCost = plan.annualFee;

  // If user already holds this tier, apply renewal rate
  if (user.membership === normTier) {
    purchaseCost = plan.renewalFee || plan.annualFee;
  } else if (currentPlan && plan.annualFee > currentPlan.annualFee) {
    // If upgrading from active lower tier, prorate difference
    purchaseCost = plan.annualFee - currentPlan.annualFee;
  }

  if (paymentMethod === "VIRTUAL_CARD") {
    const currentBalance = Number(user.amount);
    if (currentBalance < purchaseCost) {
      const error = new Error(
        `Insufficient wallet balance (₹${currentBalance.toFixed(2)}). Total payable is ₹${purchaseCost}. Please top up your wallet.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const now = new Date();
  let baseDate = now;
  // If user renews same active tier, extend from existing future renewal date
  if (user.membership === normTier && user.renewalDate && new Date(user.renewalDate) > now) {
    baseDate = new Date(user.renewalDate);
  }
  const newRenewalDate = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  const updatedUser = await prisma.$transaction(async (tx) => {
    let balanceAfter = Number(user.amount);

    if (paymentMethod === "VIRTUAL_CARD") {
      const decremented = await tx.user.update({
        where: { id: user.id },
        data: {
          amount: { decrement: purchaseCost },
        },
      });
      balanceAfter = Number(decremented.amount);

      await tx.walletTransaction.create({
        data: {
          userID: user.id,
          phone: user.phone,
          type: "DEBIT",
          amount: purchaseCost,
          balanceAfter,
          paymentMethod: "VIRTUAL_CARD",
          module: "MEMBERSHIP",
          description: `Subscription Purchase: ${normTier} Annual Plan`,
        },
      });
    }

    return await tx.user.update({
      where: { id: user.id },
      data: {
        membership: normTier,
        renewalDate: newRenewalDate,
      },
    });
  });

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: `Subscription Confirmed: Your ${normTier} Membership is Active!`,
    text: `Hello ${user.name},\n\nYour subscription to the ${normTier} plan has been activated successfully!\n\nNew Expiry Date: ${formatDateString(newRenewalDate)}\n\nEnjoy your exclusive court, shop, and cafe benefits.\n\nThe Champions Club Team`,
  });

  return {
    success: true,
    message: `Successfully subscribed to ${normTier} membership until ${formatDateString(newRenewalDate)}!`,
    membershipTier: normTier,
    newRenewalDate,
    walletBalance: Number(updatedUser.amount),
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      membership: updatedUser.membership,
      renewalDate: updatedUser.renewalDate,
      amount: Number(updatedUser.amount),
    },
  };
};
