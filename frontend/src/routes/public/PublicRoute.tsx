import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserAuth } from '../../context-reducer/UserAuthContext';
import { useGetAllConversationsQuery } from '@/redux/api/conversationApi';
import Loading from '@/pages/Loading';
import { useCheckSiteVerificationQuery } from '@/redux/api/securityApi';
import { useGetPublicAdminSettingsQuery } from '@/redux/api/admin/settingsApi';

const PublicRoute = ({ children }: any): JSX.Element => {
    const { user }: any = useUserAuth();
    const { data: conversations, isLoading }: any = useGetAllConversationsQuery(user?._id, { 
    skip: !user?._id 
  });
  const {
    data: featureSettings,
    isLoading: isCheckingFeatureSettings,
  } = useGetPublicAdminSettingsQuery(undefined);
  const siteSecurityEnabled =
    featureSettings?.features?.site_security_check !== false;
  
  // Check site verification against server cookie (not localStorage)
  const { data: verifyData, isLoading: isCheckingVerification } =
    useCheckSiteVerificationQuery(undefined, {
      skip: isCheckingFeatureSettings || !siteSecurityEnabled,
    });
  const isVerified = verifyData?.verified === true;

  // If user is logged in, redirect to their conversations
  if (user) {
    // Show loading while fetching conversations
    if (isLoading) {
      return <Loading />;
    }
    
    // Redirect to first conversation if exists
    const firstConvId = conversations?.[0]?._id;
    if (firstConvId) {
      return <Navigate to={`/e2ee/t/${firstConvId}`} replace />;
    }
    
    // If no conversations, stay on empty chat state
    // Don't redirect to / as that would cause a loop
    return <Navigate to="/e2ee/t/empty" replace />;
  }

  if (isCheckingFeatureSettings) return <Loading />;
  
  // While checking verification with server, show loader
  if (siteSecurityEnabled && isCheckingVerification) return <Loading />;

  // If user is not verified, redirect to home (verification page)
  if (siteSecurityEnabled && !isVerified) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PublicRoute;