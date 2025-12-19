// src/pages/_app.js
"use client";

import "../styles/globals.css";
import "@aws-amplify/ui-react/styles.css";

import { useRouter } from "next/router";
import { useEffect } from "react";
import { Amplify } from "aws-amplify";

import AuthWrapper from "../components/AuthWrapper";
import AdminAuthWrapper from "../components/AdminAuthWrapper";

import awsConfig from "../lib/awsConfig";
import awsAdminConfig from "../lib/awsAdminConfig";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const path = router.pathname;

  const isAdminRoute = path === "/admin" || path === "/adminDashboard";

  useEffect(() => {
    const poolKey = isAdminRoute ? "admin" : "agent";

    // ✅ configure only in browser
    if (window.__currentAmplifyPool !== poolKey) {
      Amplify.configure(isAdminRoute ? awsAdminConfig : awsConfig);
      window.__currentAmplifyPool = poolKey;
    }
  }, [isAdminRoute]);

  const Wrapper = isAdminRoute ? AdminAuthWrapper : AuthWrapper;

  return (
    <Wrapper>
      {({ user, signOut }) => (
        <Component {...pageProps} user={user} signOut={signOut} />
      )}
    </Wrapper>
  );
}