declare module "react-native-razorpay" {
  type CheckoutOptions = Record<string, unknown>;
  const RazorpayCheckout: {
    open(options: CheckoutOptions): Promise<{
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }>;
  };
  export default RazorpayCheckout;
}
