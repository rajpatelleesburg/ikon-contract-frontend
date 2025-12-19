"use client";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import AdminCustomSignUpForm from "./AdminCustomSignUpForm";
import dynamic from "next/dynamic";

const Authenticator = dynamic(
  () =>
    import("@aws-amplify/ui-react").then((m) => m.Authenticator),
  { ssr: false }
);


//Amplify.configure(awsAdminConfig);

export default function AdminAuthWrapper({ children }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  //  SSR guard
  if (!mounted) return null;

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg animate-fade-in">
          <Authenticator
            components={{
              SignUp: {
                FormFields: (props) => (
                  <AdminCustomSignUpForm {...props} />
                ),
              },
            }}
            services={{
              async handleSignUp() {
                 // 👇 LAZY IMPORT — browser only
                const { Auth } = await import("aws-amplify");
                const form = globalThis.__adminForm || {};
                return Auth.signUp({
                  username: form.email,
                  password: form.password,
                  attributes: {
                    email: form.email,
                    given_name: form.given_name,
                    family_name: form.family_name,
                  },
                  autoSignIn: { enabled: true },
                });
              },
            }}
          >
            {(context) => {
              const { user, signOut } = context;

              if (user && router.pathname !== "/adminDashboard") {
                router.replace("/adminDashboard");
                return null;
              }

              return children({ user, signOut });
            }}
          </Authenticator>
        </div>
      </div>
    </>
  );
}