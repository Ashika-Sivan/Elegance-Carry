const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: [
      {
        addressType: {
          type: String,
          required: true,
          enum: ['home', 'office', 'other']
        },
        name: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        landMark: {
          type: String,
          required: true,
        },
        // district: {
        //   type: String,
        //   required: true,
        // },
        state: {
          type: String,
          required: true,
          enum: [
            'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
            'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
            'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
            'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
            'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
            'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep', 'Delhi',
            'Puducherry'
          ],
        }
        ,
        pincode: {
          type: Number,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        altPhone: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;