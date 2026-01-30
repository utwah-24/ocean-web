import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { formatPrice } from '../utils/formatPrice';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import './Checkout.css';

export function Checkout() {
  const { items, getTotalPrice, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<'online' | 'escrow' | 'cash_on_delivery'>('online');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [escrowFeeResponsibility, setEscrowFeeResponsibility] = useState<'buyer' | 'seller'>('buyer');

  const deliveryFee = 5000; // Fixed delivery fee or calculate based on location
  const subtotal = getTotalPrice();
  const total = subtotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      alert('Please login to place an order');
      navigate('/login');
      return;
    }

    if (items.length === 0) {
      alert('Your cart is empty');
      navigate('/cart');
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare order items
      const orderItems = items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      // Create order payload
      const orderData: any = {
        order_items: orderItems,
        buyer_id: user.id,
        total_amount: total,
        delivery_fee: deliveryFee,
        payment_type: paymentType,
      };

      // Add optional fields based on payment type
      if (paymentType === 'online' && phoneNumber) {
        orderData.msisdn = phoneNumber;
        orderData.provider = 'vodacom'; // or detect from phone number
      }

      if (paymentType === 'escrow') {
        orderData.escrow_fee_responsibility = escrowFeeResponsibility;
      }

      // Create the order
      const orderResponse = await apiService.createOrder(orderData);

      if (!orderResponse.success) {
        throw new Error(orderResponse.message || 'Failed to create order');
      }

      const orderId = orderResponse.orderId;

      // Handle payment based on type
      if (paymentType === 'online') {
        if (!phoneNumber) {
          throw new Error('Phone number is required for online payment');
        }

        // Request payment
        const paymentResponse = await apiService.requestPayment({
          amount: total,
          msisdn: phoneNumber,
          order_id: orderId,
          description: `Payment for order #${orderId}`,
        });

        if (paymentResponse.success) {
          alert(
            `Order created successfully!\n\n` +
            `Order ID: ${orderId}\n` +
            `Payment Reference: ${paymentResponse.referenceId}\n\n` +
            `Please check your phone to complete the payment.`
          );
          clearCart();
          navigate('/');
        } else {
          throw new Error(paymentResponse.message || 'Failed to process payment');
        }
      } else if (paymentType === 'escrow') {
        alert(
          `Order created successfully with Escrow payment!\n\n` +
          `Order ID: ${orderId}\n\n` +
          `Funds will be held in escrow until delivery is confirmed.`
        );
        clearCart();
        navigate('/');
      } else if (paymentType === 'cash_on_delivery') {
        alert(
          `Order created successfully!\n\n` +
          `Order ID: ${orderId}\n\n` +
          `Please prepare cash for payment upon delivery.`
        );
        clearCart();
        navigate('/');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process order';
      alert(`Order failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <h2>Please login to checkout</h2>
          <button onClick={() => navigate('/login')} className="login-redirect-btn">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <h2>Your cart is empty</h2>
          <button onClick={() => navigate('/')} className="shop-redirect-btn">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">Checkout</h1>

        <div className="checkout-content">
          {/* Order Summary */}
          <div className="checkout-order-summary">
            <h2>Order Summary</h2>
            <div className="checkout-items">
              {items.map((item) => (
                <div key={item.product.id} className="checkout-item">
                  <img
                    src={getImageUrl(item.product.image)}
                    alt={item.product.name}
                    className="checkout-item-image"
                    onError={handleImageError}
                  />
                  <div className="checkout-item-info">
                    <h4>{item.product.name}</h4>
                    <p>Quantity: {item.quantity}</p>
                    <p className="checkout-item-price">
                      {formatPrice(parseFloat(item.product.price) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-totals">
              <div className="checkout-total-row">
                <span>Subtotal:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="checkout-total-row">
                <span>Delivery Fee:</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
              <div className="checkout-total-row total">
                <span>Total:</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="checkout-form-section">
            <form onSubmit={handleSubmitOrder} className="checkout-form">
              <h2>Payment & Delivery Details</h2>

              {/* Payment Type Selection */}
              <div className="form-group">
                <label>Payment Method</label>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentType"
                      value="online"
                      checked={paymentType === 'online'}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                    />
                    <span>Online Payment (Mobile Money)</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentType"
                      value="escrow"
                      checked={paymentType === 'escrow'}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                    />
                    <span>Escrow Payment</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentType"
                      value="cash_on_delivery"
                      checked={paymentType === 'cash_on_delivery'}
                      onChange={(e) => setPaymentType(e.target.value as any)}
                    />
                    <span>Cash on Delivery</span>
                  </label>
                </div>
              </div>

              {/* Phone Number for Online Payment */}
              {paymentType === 'online' && (
                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number (for payment)</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g., 255712345678"
                    required
                    className="form-input"
                  />
                  <small>Enter your mobile money number</small>
                </div>
              )}

              {/* Escrow Fee Responsibility */}
              {paymentType === 'escrow' && (
                <div className="form-group">
                  <label>Who pays the escrow fee?</label>
                  <div className="payment-options">
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="escrowFee"
                        value="buyer"
                        checked={escrowFeeResponsibility === 'buyer'}
                        onChange={(e) => setEscrowFeeResponsibility(e.target.value as any)}
                      />
                      <span>Buyer</span>
                    </label>
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="escrowFee"
                        value="seller"
                        checked={escrowFeeResponsibility === 'seller'}
                        onChange={(e) => setEscrowFeeResponsibility(e.target.value as any)}
                      />
                      <span>Seller</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              <div className="form-group">
                <label htmlFor="deliveryAddress">Delivery Address</label>
                <textarea
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter your delivery address"
                  required
                  className="form-textarea"
                  rows={3}
                />
              </div>

              {/* Delivery Notes */}
              <div className="form-group">
                <label htmlFor="deliveryNotes">Delivery Notes (Optional)</label>
                <textarea
                  id="deliveryNotes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any special instructions for delivery"
                  className="form-textarea"
                  rows={2}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="place-order-btn"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing Order...' : 'Place Order'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="back-to-cart-btn"
                disabled={isProcessing}
              >
                Back to Cart
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

