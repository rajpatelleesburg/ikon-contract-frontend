"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import { Auth } from "aws-amplify";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";

//import awsAdminConfig from "../lib/awsAdminConfig";
import AdminCustomSignUpForm from "./AdminCustomSignUpForm";

//Amplify.configure(awsAdminConfig);

export default function AdminAuthWrapper({ children }) {
  const router = useRouter();

  return (
    <>
      <Toaster position="top-center" />

      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg animate-fade-in">
          <Authenticator
            components={{
              SignUp: { FormFields: (props) => <AdminCustomSignUpForm {...props} /> },
            }}
            services={{
              async handleSignUp() {
                const form = globalThis.__adminForm || {};

                const given   = (form.given_name ?? "").trim();
                const fam     = (form.family_name ?? "").trim();
                const email   = (form.email ?? "").trim().toLowerCase();
                const password = form.password;

                // Username MUST be email for this pool
                const username = email;

                return Auth.signUp({
                  username,
                  password,
                  attributes: {
                    email,
                    given_name: given,
                    family_name: fam,
                  },
                  autoSignIn: { enabled: true },
                });
              },
            }}
          >
            {(context) => {
              const { user, signOut } = context;

              if (user) {
                // After login/sign-up, send admin to /adminDashboard
                if (router.pathname !== "/adminDashboard") {
                  router.replace("/adminDashboard");
                  return null;
                }
                return children({ user, signOut });
              }

              return children({ user: null, signOut: () => {} });
            }}
          </Authenticator>
        </div>
      </div>
    </>
  );
}