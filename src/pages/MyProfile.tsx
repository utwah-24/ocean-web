import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function MyProfile() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }

    console.log('[MyProfile] User object:', user);
    console.log('[MyProfile] Checking for seller_id or sellerId fields');
    
    // Check for seller_id in various possible fields
    const sellerId = (user as any).seller_id || (user as any).sellerId || (user as any).seller_ID || user.id;
    
    console.log('[MyProfile] Using seller ID:', sellerId);
    
    // Simply redirect to the seller profile page with the seller ID
    // The SellerProfile component will handle fetching the data
    navigate(`/sellers/${sellerId}`, { replace: true });
  }, [isAuthenticated, user, navigate]);

  // Show nothing while redirecting
  return null;
}

