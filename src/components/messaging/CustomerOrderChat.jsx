import React from 'react';
import OrderChat from '@/components/messaging/OrderChat';

export default function CustomerOrderChat({ orderId, orderNumber, customerName }) {
  return <div className="mt-3 pt-3 border-t"><OrderChat orderId={orderId} orderNumber={orderNumber} senderRole="customer" senderName={customerName} chatLabel="Driver" filterRole="driver" /></div>;
}