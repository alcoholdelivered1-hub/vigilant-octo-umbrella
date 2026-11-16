import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function LoginRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} />;
}