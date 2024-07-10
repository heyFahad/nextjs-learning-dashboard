import { authConfig } from '@/auth.config';
import NextAuth from 'next-auth';

// We're creating this separate NextAuth with the authConfig because bcrypt does not work in middleware if we directly import the auth from auth.ts
export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
