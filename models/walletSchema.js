const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    walletHistory: [
      {
        transactionId: {
          type: String,
          required: true,
          default: () => uuidv4(),
        },
        transactionType: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
          enum: [
            "Refund",
            "Wallet Recharge",
            "Add to Wallet",
            "Returned",
            "Purchase",
            "Initial balance",
            "Cancelled",
            "Signup bonus",
          ],
          required: true, 
        },
        orderId: { 
          type: String,
          required: false, 
        },
      },
    ],
  },
  { timestamps: true }
);

walletSchema.index({ userId: 1 });
walletSchema.index({ "walletHistory.transactionId": 1 });

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;

















































































// const mongoose = require("mongoose");
// const { Schema } = mongoose;
// const { v4: uuidv4 } = require("uuid");

// const walletSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     balance: {
//       type: Number,
//       default: 0,
//     },
//     walletHistory: [
//       {
//         transactionId: {
//           type: String,
//           required: true,
//           default: () => uuidv4(),
//         },
//         transactionType: {
//           type: String,
//           enum: ["credit", "debit"],
//           required: true,
//         },
//         amount: {
//           type: Number,
//           required: true,
//         },
//         date: {
//           type: Date,
//           default: Date.now,
//         },
//         description: {
//           type: String,
//           enum: [
//             "Refund",
//             "Wallet Recharge",
//             "Add to Wallet",
//             "Returned",
//             "Purchase",
//             "Initial balance",
//             "Cancelled",
//             "Signup bonus",
//           ],
//         },
//       },
//     ],
//   },
//   { timestamps: true }
// );

// walletSchema.index({ userId: 1 });
// walletSchema.index({ "walletHistory.transactionId": 1 });

// const Wallet = mongoose.model("Wallet", walletSchema);
// module.exports = Wallet;
