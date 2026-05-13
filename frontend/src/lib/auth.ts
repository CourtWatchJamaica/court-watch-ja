import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
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
