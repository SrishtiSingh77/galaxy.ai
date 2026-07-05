import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes for Clerk Auth sign-in/sign-up and Trigger.dev endpoints
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/trigger(.*)"
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html|css|js|gif|svg|png|jpg|jpeg|webp|webp|mp4|webm|wav|mp3|m4a|aac|oga|ogg|pdf|txt|json)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
