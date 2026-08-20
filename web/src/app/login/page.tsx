import type { Metadata } from "next";
import { LoginForm } from "@/components/community/login-form";

export const metadata: Metadata = { title: "Private access — The Commons" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === "string" ? params[key] : "";
  return (
    <LoginForm
      initialInvite={value("invite")}
      initialEmail={value("email")}
      initialError={value("error")}
    />
  );
}
