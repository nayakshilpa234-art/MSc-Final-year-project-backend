import React from 'react';
import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';

const BookingReceiptTemplate = React.forwardRef(({ booking }, ref) => {
    if (!booking) return null;

    const invoiceNumber = booking.invoiceNumber || `INV-${booking._id.substring(0, 8).toUpperCase()}`;
    const transactionId = booking.transactionId || (booking.payment && booking.payment.transactionId) || `TXN-${booking._id.substring(booking._id.length - 8).toUpperCase()}`;
    
    // Formatting helpers
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const price = booking.totalCost || 0;
    const gst = Math.round(price * 0.05); // Assume 5% GST included or added
    const baseCost = price - gst;

    return (
        <div 
            ref={ref} 
            style={{ 
                width: '800px', 
                padding: '40px', 
                background: 'white', 
                color: '#1e293b', 
                fontFamily: 'Arial, sans-serif',
                position: 'absolute', // keep it offscreen
                top: '-9999px',
                left: '-9999px'
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#2563eb', fontSize: '28px', fontWeight: '900' }}>AI Tourist Assistant</h1>
                    <p style={{ margin: '5px 0 0', color: '#64748b' }}>Your Premium Travel Partner</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>BOOKING RECEIPT</h2>
                    <p style={{ margin: '5px 0 0', fontSize: '14px', fontWeight: 'bold' }}>Status: <span style={{ color: '#10b981' }}>CONFIRMED ✅</span></p>
                </div>
            </div>

            {/* Meta Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '14px' }}>
                <div>
                    <div><strong>Booking ID:</strong> {booking._id}</div>
                    <div><strong>Invoice No:</strong> {invoiceNumber}</div>
                    <div><strong>Transaction ID:</strong> {transactionId}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div><strong>Payment Date:</strong> {formatDate(booking.createdAt || new Date())}</div>
                    <div><strong>Payment Method:</strong> {booking.payment?.method || 'Online'}</div>
                </div>
            </div>

            {/* Two Column Layout for Details */}
            <div style={{ display: 'flex', gap: '40px', marginBottom: '30px' }}>
                {/* Left Col: Traveler & Trip Details */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', color: '#334155' }}>Traveler Details</h3>
                    <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                        <div><strong>Name:</strong> {booking.name}</div>
                        <div><strong>Email:</strong> {booking.email}</div>
                        <div><strong>Phone:</strong> {booking.phone}</div>
                        <div><strong>Travelers:</strong> {booking.adults || 1} Adults, {booking.children || 0} Children</div>
                    </div>

                    <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', color: '#334155' }}>Destination & Package</h3>
                    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                        <div><strong>Destination:</strong> {booking.destination?.name || booking.destination || 'Custom Destination'}</div>
                        <div><strong>Package Type:</strong> {booking.bookingType || 'Standard'} Package</div>
                        <div><strong>Travel Date:</strong> {formatDate(booking.travelDate)}</div>
                    </div>
                </div>

                {/* Right Col: Logistics & Pricing */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', color: '#334155' }}>Inclusions</h3>
                    <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                        <div><strong>Hotel:</strong> {booking.stay?.type || 'Standard Room'}</div>
                        <div><strong>Meal Plan:</strong> {booking.food?.type || 'Breakfast Included'}</div>
                        <div><strong>Transport:</strong> {booking.transport?.type || 'Not Included'}</div>
                    </div>

                    <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', color: '#334155' }}>Payment Summary</h3>
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Base Package Cost:</span> <span>₹{baseCost.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>GST (5%):</span> <span>₹{gst.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#10b981' }}>
                            <span>Discount Applied:</span> <span>- ₹0</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>
                            <span>Final Amount Paid:</span> <span>₹{price.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Code and Barcode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Scan for Booking Status</span>
                    <QRCode value={booking._id} size={90} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Booking Reference Barcode</span>
                    <Barcode value={invoiceNumber} height={50} width={1.5} fontSize={14} background="transparent" />
                </div>
            </div>

            {/* Policies */}
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.5', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '30px' }}>
                    <div style={{ flex: 1 }}>
                        <strong>Cancellation Policy:</strong> Free cancellation up to 48 hours before the travel date. A 50% fee applies for cancellations within 48 hours.
                    </div>
                    <div style={{ flex: 1 }}>
                        <strong>Refund Policy:</strong> Refunds will be processed within 5-7 business days to the original payment method.
                    </div>
                    <div style={{ flex: 1 }}>
                        <strong>Terms & Conditions:</strong> Please carry a valid ID proof during travel. Standard hotel check-in time is 2 PM.
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '12px', color: '#94a3b8' }}>
                <p><strong>Customer Support:</strong> support@aitourist.com | +91 1800-123-4567 | www.aitourist.com</p>
                <p style={{ fontStyle: 'italic', marginTop: '10px' }}>"Thank you for choosing AI Tourist Assistant. We wish you a wonderful journey!"</p>
            </div>
        </div>
    );
});

export default BookingReceiptTemplate;
