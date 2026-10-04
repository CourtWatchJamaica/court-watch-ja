import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

const providers = [
  ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
  ...(process.env.AUTH_APPLE_ID
    ? [Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET! })]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      // The backend links OAuth logins to accounts by email, so only accept
      // providers that assert the email is verified.
      if (account?.provider === "google") {
        return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      }
      if (account?.provider === "apple") {
        const v = (profile as { email_verified?: boolean | string } | undefined)?.email_verified;
        return v === true || v === "true";
      }
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        token.oauthEmail = (profile as { email?: string })?.email ?? token.email;
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as Record<string, unknown>).provider = token.provider;
      return session;
    },
  },
});
