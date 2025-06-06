const Messages = {
  INTERNAL_SERVER_ERROR: "Something went wrong on the server",
  BAD_REQUEST: "Invalid request data",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "You do not have permission to perform this action",
  NOT_FOUND: "The requested resource was not found",
  UNAUTHORIZED_ACCESS:'Unauthorised access',

  // User-related
  USER_NOT_FOUND: "User not found",
  USER_NOT_LOGEDIN:'user not logged in',
  EMAIL_NOT_FOUND:'Email not found',
  USER_ALREADY_EXISTS: "User already exists",
  EMAIL_EXIST:'User with this email already exists',
  LOGIN_REQUIRED: "Please log in to continue",
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_BLOCKED_BY_ADMIN:'User is blocked by admin',
  INVALID_OTP:'Invalid OTP please try again',
  FAILED_OTP:'Failed to send otp',
  OTP_VERIFIED:'OTP verified successfully',
  OTP_SUCCESS:'OTP sent successfully',
  PASSWORD_NOT_MATCH:'Password donot match',
  SESSION_EXPIRED:'session expired',

  // Product-related
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_OUT_OF_STOCK: "This product is out of stock",
  PRODUCT_BLOCKED: "This product is currently blocked",
  INSUFFICIENT_STOCK: "Not enough stock available",
  INVALID_PRODUCT_ID:'invalid product id',

  // Wishlist / Cart
  WISHLIST_ADD_SUCCESS: "Product added to wishlist",
  WISHLIST_REMOVE_SUCCESS: "Product removed from wishlist",
  CART_ADD_SUCCESS: "Product added to cart",
  CART_REMOVE_SUCCESS: "Product removed from cart",
  CART_NOT_FOUND:'Cart not found',
  CART_EMPTY:'cart is empty',

  // Address / Orders
  ADDRESS_NOT_FOUND: "Address not found",
  ORDER_PLACED_SUCCESS: "Your order has been placed successfully",
  ORDER_NOT_FOUND: "Order not found",
  ADDRESS_DELETE:'Address deleted successfully',

  // Common
  ACTION_SUCCESS: "Action completed successfully",
  ACTION_FAILED: "Action could not be completed",


  //payment
  PAYMENT_SUCCESS:'payment verified successfully',
  PAYMENT_FAILED:'payment verification failed',

  //ORDER
  ORDER_SUCCESS:'order placed successfully',
  COD_ORDER_SUCCESS:'COD order placed successfully',
  WALLET_ORDER_SUCCESS:'Order placed successfully using wallet',
  RAZORPAY_ORDER_SUCCESS:'Razorpay order created',
 INSUFFICIENT_BALANCE:'insufficient balance ',
 invalID_PAYMENT_METHOD:'invalid payment method',
 ERROR_IN_PLACEORDER:'Error in placing order',
 FAILED_REFUND:'Failed fo process refund',
 INVALID_ORDER_ID:'invalid order id or item id',
 //COUPON
 COUPON_NOT_FOUND:'Coupon not found',
 COUPON_EXPIRED:'coupon has expired',
 COUPON_LIMIT_REACHED:'Coupon limit reached',
 COUPON_SUCCESS:'Coupon applied successfully',
 COUPON_REMOVE_SUCCESS:'coupon removed successfully',

 //RAZORPAY
 RAZORPAY_CONFIGURATION:'Razorpay configuration missing',
 INVALID_RAZORPAY_SIGNATURE:'Invalid razorpay signature',
 INVALID_AMOUNT:'Invalid amount',
 INVALID_CREDENTIALS:'Invalid credentials',

 //CATEGORY
 CATEGORY_NOT_FOUND:'Category not found',
 //OFFER
 OFFER_ADD:'Offer added succcessfully',
 OFFER_REMOVE:'Offer removed successfully'

};


module.exports = Messages;
